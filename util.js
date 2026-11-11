// Funcoes de apoio: formatacao, janelas (modais) e avisos.

export const h = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const agora = () => new Date().toISOString();
export const fmtDataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export const fmtData = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
export const fmtMoeda = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtNum = v => Number(v || 0).toLocaleString('pt-BR');
export const soDigitos = v => String(v || '').replace(/\D/g, '');

export function fmtCnpj(v) {
  const d = soDigitos(v);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v;
}
export function fmtCpf(v) {
  const d = soDigitos(v);
  return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (v || '');
}

// ---------- Janelas ----------
const fundo = () => document.getElementById('modal-fundo');

export function abrirModal(html, classe = '') {
  const f = fundo();
  f.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true">${html}</div>`;
  f.hidden = false;
  document.body.classList.add('com-modal');
  const alvo = f.querySelector('input:not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea, button');
  if (alvo) alvo.focus();
}

export function fecharModal() {
  const f = fundo();
  if (f.hidden) return;
  f.hidden = true;
  f.innerHTML = '';
  document.body.classList.remove('com-modal');
  document.dispatchEvent(new Event('modal-fechado'));
}

export const modalAberto = () => !fundo().hidden;

export function confirmar(titulo, texto, rotulo = 'Confirmar', perigo = false) {
  return new Promise(resolver => {
    abrirModal(`<h2>${h(titulo)}</h2><p>${h(texto)}</p>
      <div class="acoes">
        <button type="button" class="btn btn-secundario" data-r="0">Cancelar</button>
        <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-r="1">${h(rotulo)}</button>
      </div>`);
    fundo().querySelectorAll('[data-r]').forEach(b => {
      b.onclick = () => { fecharModal(); resolver(b.dataset.r === '1'); };
    });
  });
}

export function alerta(titulo, texto) {
  return new Promise(resolver => {
    abrirModal(`<div class="faixa-erro">${h(titulo)}</div><p>${h(texto)}</p>
      <div class="acoes"><button type="button" class="btn btn-primario" data-r="1">Entendi</button></div>`, 'modal-erro');
    fundo().querySelector('[data-r]').onclick = () => { fecharModal(); resolver(); };
  });
}

// Mensagem de erro dentro do formulario, sem perder o que foi digitado.
export function erroForm(form, msg) {
  const caixa = form.querySelector('.erro-form');
  if (!caixa) return;
  caixa.textContent = msg;
  caixa.hidden = !msg;
  if (msg) caixa.scrollIntoView({ block: 'nearest' });
}

// Aviso rapido de sucesso, no alto da tela.
export function aviso(msg) {
  const area = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = msg;
  area.innerHTML = '';
  area.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
