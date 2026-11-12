// Estrutura do sistema: login, menu e navegacao entre as telas.
import { iniciar, usuario, modo, entrar, sair, criarUsuario, precisaPrimeiroUsuario, aoMudarDados } from './dados.js';
import { h, fecharModal, modalAberto, erroForm, alerta } from './util.js';
import { rotulo } from './regras.js';
import { criarTelas } from './telas.js';

const MENU = [
  ['inicio', 'Início'], ['produtos', 'Produtos'], ['fornecedores', 'Fornecedores'],
  ['colaboradores', 'Colaboradores'], ['entradas', 'Entradas'], ['saidas', 'Saídas'],
  ['estoque', 'Estoque'], ['analise', 'Análise de compras'], ['checklist', 'Check list'],
  ['usuarios', 'Usuários'],
];

const app = document.getElementById('app');
let atual = 'inicio';
let pendente = false;

const telas = criarTelas({ navegar, renderTela });

function navegar(nome) {
  atual = nome;
  renderApp();
  window.scrollTo(0, 0);
}

const faixaDemo = () => modo() === 'demo'
  ? `<div class="faixa-demo">Modo demonstração: os dados ficam salvos apenas neste navegador. Para usar de verdade, configure o Firebase (veja o arquivo LEIA-ME).</div>` : '';

async function renderLogin(erro) {
  let primeiro = false;
  try { primeiro = await precisaPrimeiroUsuario(); }
  catch (e) { erro = erro || new Error('Não foi possível conectar ao banco de dados. Verifique a internet e a configuração do Firebase.'); }
  const campos = `
    <label class="campo"><span>Nome</span><input name="nome" required autocomplete="given-name"></label>
    <label class="campo"><span>Sobrenome</span><input name="sobrenome" required autocomplete="family-name"></label>
    <label class="campo"><span>Senha</span><input name="senha" type="password" required minlength="6" autocomplete="${primeiro ? 'new-password' : 'current-password'}"></label>`;
  app.innerHTML = `${faixaDemo()}
    <div class="login">
      <h1>Sistema de Estoque</h1>
      ${primeiro
        ? `<p>Primeiro acesso. Crie o usuário inicial do sistema.</p>
           <form data-form="primeiro-usuario">${campos}
             <label class="campo"><span>Repita a senha</span><input name="senha2" type="password" required minlength="6" autocomplete="new-password"></label>
             <div class="erro-form" ${erro ? '' : 'hidden'}>${h(erro ? erro.message : '')}</div>
             <button type="submit" class="btn btn-primario btn-largo">Criar usuário e entrar</button>
           </form>`
        : `<p>Digite seu nome, sobrenome e senha para entrar.</p>
           <form data-form="login">${campos}
             <div class="erro-form" ${erro ? '' : 'hidden'}>${h(erro ? erro.message : '')}</div>
             <button type="submit" class="btn btn-primario btn-largo">Entrar</button>
           </form>`}
    </div>`;
}

function renderApp(erro) {
  if (!usuario()) { renderLogin(erro); return; }
  app.innerHTML = `${faixaDemo()}
    <div class="layout">
      <nav class="menu" aria-label="Menu principal">
        <div class="menu-titulo">Sistema de Estoque</div>
        ${MENU.map(([id, nome]) => `<button type="button" class="menu-item ${id === atual ? 'ativo' : ''}" data-ir="${id}">${nome}</button>`).join('')}
        <div class="menu-usuario">
          <span>${h(rotulo(usuario()))}</span>
          <button type="button" class="btn btn-menu" data-acao="sair">Sair do sistema</button>
        </div>
      </nav>
      <main id="tela" class="tela"></main>
    </div>`;
  renderTela();
}

function renderTela() {
  const alvo = document.getElementById('tela');
  if (!alvo || !usuario()) return;
  const t = telas[atual];
  alvo.className = `tela area-${t.area || 'azul'}`;
  alvo.innerHTML = `<h1 class="tela-titulo">${t.titulo}</h1>${t.render()}`;
  pendente = false;
}

// Quando os dados mudam (inclusive por outro usuario), atualiza a tela.
// Se houver uma janela aberta, espera fechar para nao atrapalhar quem esta digitando.
aoMudarDados(() => {
  if (!usuario()) return;
  if (modalAberto()) { pendente = true; return; }
  renderTela();
});
document.addEventListener('modal-fechado', () => { if (usuario()) renderTela(); });

function mostrarErro(e) {
  console.error(e);
  alerta('Não foi possível concluir', e && e.message ? e.message : 'Ocorreu um erro. Tente de novo.');
}

const acoesGlobais = {
  'fechar-modal': () => fecharModal(),
  sair: async () => { await sair(); atual = 'inicio'; },
};

const formsGlobais = {
  async login(v, f) {
    erroForm(f, '');
    try { await entrar(v.nome, v.sobrenome, v.senha); }
    catch (e) { erroForm(f, e.message); }
  },
  async 'primeiro-usuario'(v, f) {
    erroForm(f, '');
    if (v.senha !== v.senha2) return erroForm(f, 'As duas senhas digitadas são diferentes.');
    try { await criarUsuario(v.nome, v.sobrenome, v.senha, true); }
    catch (e) { erroForm(f, e.message === 'DUPLICADO' ? 'Já existe um usuário com este nome e sobrenome.' : e.message); }
  },
};

document.addEventListener('click', async ev => {
  const ir = ev.target.closest('[data-ir]');
  if (ir) { fecharModal(); navegar(ir.dataset.ir); return; }
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  const fn = acoesGlobais[el.dataset.acao] || (usuario() && telas[atual].acoes && telas[atual].acoes[el.dataset.acao]);
  if (!fn) return;
  try { await fn(el.dataset, el); } catch (e) { mostrarErro(e); }
});

document.addEventListener('submit', async ev => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const fn = formsGlobais[f.dataset.form] || (usuario() && telas[atual].forms && telas[atual].forms[f.dataset.form]);
  if (!fn) return;
  const botao = f.querySelector('[type=submit]');
  if (botao) botao.disabled = true;
  try { await fn(Object.fromEntries(new FormData(f)), f); }
  catch (e) { if (f.querySelector('.erro-form') && f.isConnected) erroForm(f, e.message || 'Ocorreu um erro.'); else mostrarErro(e); }
  finally { if (botao) botao.disabled = false; }
});

function aoAlterarCampo(ev) {
  const el = ev.target.closest('[data-mudou]');
  if (!el || !usuario()) return;
  const fn = telas[atual].mudou && telas[atual].mudou[el.dataset.mudou];
  if (fn) fn(el);
}
document.addEventListener('change', aoAlterarCampo);
document.addEventListener('input', ev => { if (ev.target.matches('input[data-ao-digitar]')) aoAlterarCampo(ev); });

iniciar(erro => renderApp(erro)).catch(e => {
  console.error(e);
  app.innerHTML = `<div class="login"><h1>Sistema de Estoque</h1>
    <div class="erro-form">Não foi possível iniciar o sistema. Verifique a conexão com a internet e a configuração do Firebase.</div></div>`;
});
