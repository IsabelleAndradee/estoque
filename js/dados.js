// Camada de dados: Firebase (Auth + Firestore) ou modo demonstracao (navegador).
import { firebaseConfig } from './firebase-config.js';

const COLECOES = ['usuarios', 'produtos', 'fornecedores', 'colaboradores', 'entradas', 'saidas', 'auditoria', 'checklists'];
const VERSAO_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const DOMINIO = '@usuarios.example.com'; // dominio interno, usado so para montar o login no Firebase
const CHAVE_DEMO = 'estoque-demo-v1';

export const dados = Object.fromEntries(COLECOES.map(c => [c, []]));

let usuarioAtual = null;
let modoAtual = 'demo';
let fb = null;
let aoMudar = () => {};
let aoAuth = () => {};
let cancelar = [];
let criandoPrimeiro = false;
let senhasDemo = {};

export const usuario = () => usuarioAtual;
export const modo = () => modoAtual;
export const aoMudarDados = fn => { aoMudar = fn; };

const configurado = () =>
  !!firebaseConfig && typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.length > 10 && !firebaseConfig.apiKey.startsWith('COLE');

// Chave unica do usuario: nome e sobrenome sem acentos, em minusculas.
export function chaveNome(nome, sobrenome) {
  return `${nome} ${sobrenome}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}
const emailDe = (nome, sobrenome) => chaveNome(nome, sobrenome) + DOMINIO;

function erroAmigavel(e) {
  const c = e && e.code;
  if (c === 'auth/email-already-in-use') return new Error('DUPLICADO');
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(c))
    return new Error('Nome, sobrenome ou senha incorretos.');
  if (c === 'auth/weak-password') return new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (c === 'auth/too-many-requests') return new Error('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  if (c === 'auth/network-request-failed' || c === 'unavailable') return new Error('Sem conexão com a internet. Verifique e tente de novo.');
  if (c === 'permission-denied') return new Error('Sem permissão para acessar os dados. Verifique as regras do Firestore.');
  return e instanceof Error ? e : new Error(String(e));
}

// ---------- Inicio ----------
export async function iniciar(callbackAuth) {
  aoAuth = callbackAuth;
  if (configurado()) {
    modoAtual = 'firebase';
    const [app, auth, fs] = await Promise.all([
      import(VERSAO_SDK + 'firebase-app.js'),
      import(VERSAO_SDK + 'firebase-auth.js'),
      import(VERSAO_SDK + 'firebase-firestore.js'),
    ]);
    const inst = app.initializeApp(firebaseConfig);
    fb = { app, auth, fs, a: auth.getAuth(inst), d: fs.getFirestore(inst) };
    auth.onAuthStateChanged(fb.a, async u => {
      if (criandoPrimeiro) return;
      let erro = null;
      try { await definirUsuario(u ? u.uid : null); } catch (e) { erro = erroAmigavel(e); }
      aoAuth(erro);
    });
  } else {
    carregarDemo();
    let erro = null;
    try { await definirUsuario(sessionStorage.getItem(CHAVE_DEMO + '-sessao')); } catch (e) { erro = null; }
    aoAuth(erro);
  }
}

function pararAssinaturas() {
  cancelar.forEach(fn => fn());
  cancelar = [];
}

function assinarTudo() {
  pararAssinaturas();
  return Promise.all(COLECOES.map(col => new Promise((ok, falha) => {
    let primeiro = true;
    cancelar.push(fb.fs.onSnapshot(fb.fs.collection(fb.d, col), snap => {
      dados[col] = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      if (primeiro) { primeiro = false; ok(); } else aoMudar();
    }, falha));
  })));
}

async function definirUsuario(uid) {
  if (!uid) {
    pararAssinaturas();
    usuarioAtual = null;
    if (modoAtual === 'firebase') COLECOES.forEach(c => { dados[c] = []; });
    return;
  }
  if (modoAtual === 'firebase') {
    try { await assinarTudo(); }
    catch (e) { pararAssinaturas(); await fb.auth.signOut(fb.a); throw e; }
  }
  usuarioAtual = dados.usuarios.find(u => u.id === uid) || null;
  if (!usuarioAtual) {
    if (modoAtual === 'firebase') { pararAssinaturas(); await fb.auth.signOut(fb.a); }
    else sessionStorage.removeItem(CHAVE_DEMO + '-sessao');
    throw new Error('Este usuário não está cadastrado no sistema.');
  }
}

// ---------- Acesso ----------
export async function precisaPrimeiroUsuario() {
  if (modoAtual === 'demo') return dados.usuarios.length === 0;
  const s = await fb.fs.getDoc(fb.fs.doc(fb.d, 'config', 'setup'));
  return !s.exists();
}

export async function entrar(nome, sobrenome, senha) {
  if (modoAtual === 'demo') {
    const chave = chaveNome(nome, sobrenome);
    const u = dados.usuarios.find(x => x.chave === chave);
    if (!u || senhasDemo[u.id] !== senha) throw new Error('Nome, sobrenome ou senha incorretos.');
    sessionStorage.setItem(CHAVE_DEMO + '-sessao', u.id);
    await definirUsuario(u.id);
    aoAuth(null);
    return;
  }
  try { await fb.auth.signInWithEmailAndPassword(fb.a, emailDe(nome, sobrenome), senha); }
  catch (e) { throw erroAmigavel(e); }
}

export async function sair() {
  if (modoAtual === 'demo') {
    sessionStorage.removeItem(CHAVE_DEMO + '-sessao');
    await definirUsuario(null);
    aoAuth(null);
    return;
  }
  await fb.auth.signOut(fb.a);
}

// Cria um usuario. "primeiro" = usuario inicial do sistema (ja entra logado).
export async function criarUsuario(nome, sobrenome, senha, primeiro = false) {
  nome = nome.trim(); sobrenome = sobrenome.trim();
  const chave = chaveNome(nome, sobrenome);
  if (!chave) throw new Error('Informe nome e sobrenome.');
  if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (dados.usuarios.some(u => u.chave === chave)) throw new Error('DUPLICADO');
  const registro = { nome, sobrenome, chave, criadoEm: new Date().toISOString(), criadoPor: usuarioAtual ? usuarioAtual.id : '' };

  if (modoAtual === 'demo') {
    const id = novoId();
    dados.usuarios.push({ id, ...registro });
    senhasDemo[id] = senha;
    salvarDemo();
    if (primeiro) { sessionStorage.setItem(CHAVE_DEMO + '-sessao', id); await definirUsuario(id); aoAuth(null); }
    else aoMudar();
    return id;
  }

  const { auth, fs, app } = fb;
  try {
    if (primeiro) {
      criandoPrimeiro = true;
      try {
        const cred = await auth.createUserWithEmailAndPassword(fb.a, emailDe(nome, sobrenome), senha);
        await fs.setDoc(fs.doc(fb.d, 'usuarios', cred.user.uid), registro);
        await fs.setDoc(fs.doc(fb.d, 'config', 'setup'), { inicializado: true, em: registro.criadoEm });
        criandoPrimeiro = false;
        await definirUsuario(cred.user.uid);
        aoAuth(null);
        return cred.user.uid;
      } finally { criandoPrimeiro = false; }
    }
    // Usa uma segunda conexao para nao deslogar quem esta cadastrando.
    const sec = app.initializeApp(firebaseConfig, 'cadastro-' + Date.now());
    try {
      const secAuth = auth.getAuth(sec);
      const cred = await auth.createUserWithEmailAndPassword(secAuth, emailDe(nome, sobrenome), senha);
      await fs.setDoc(fs.doc(fb.d, 'usuarios', cred.user.uid), registro);
      await auth.signOut(secAuth);
      return cred.user.uid;
    } finally { await app.deleteApp(sec); }
  } catch (e) { throw erroAmigavel(e); }
}

// ---------- Gravacao ----------
export async function adicionar(col, obj) {
  if (modoAtual === 'demo') {
    const id = novoId();
    dados[col].push({ id, ...obj });
    salvarDemo(); aoMudar();
    return id;
  }
  try { return (await fb.fs.addDoc(fb.fs.collection(fb.d, col), obj)).id; }
  catch (e) { throw erroAmigavel(e); }
}

export async function atualizar(col, id, parcial) {
  if (modoAtual === 'demo') {
    const x = dados[col].find(r => r.id === id);
    if (x) Object.assign(x, parcial);
    salvarDemo(); aoMudar();
    return;
  }
  try { await fb.fs.updateDoc(fb.fs.doc(fb.d, col, id), parcial); }
  catch (e) { throw erroAmigavel(e); }
}

// ---------- Modo demonstracao ----------
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function carregarDemo() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_DEMO) || 'null');
    if (bruto) {
      COLECOES.forEach(c => { dados[c] = bruto.dados[c] || []; });
      senhasDemo = bruto.senhas || {};
    }
  } catch (e) { /* armazenamento indisponivel: segue vazio */ }
}

function salvarDemo() {
  try { localStorage.setItem(CHAVE_DEMO, JSON.stringify({ dados, senhas: senhasDemo })); }
  catch (e) { /* sem armazenamento: dados ficam so na memoria */ }
}
