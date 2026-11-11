// Regras de negocio: saldo de estoque e analise de compras.
import { dados } from './dados.js';

export const DESTINOS = { consumo: 'Consumo interno', descarte: 'Descarte', outro: 'Outro uso' };

export const porId = (col, id) => dados[col].find(x => x.id === id);
export const ativos = col => dados[col].filter(x => x.ativo !== false);

export const rotulo = x => x ? (x.sobrenome ? `${x.nome} ${x.sobrenome}` : x.nome) : '(não encontrado)';
export const nomeDe = (col, id) => rotulo(porId(col, id));
export const ordenar = lista => [...lista].sort((a, b) => rotulo(a).localeCompare(rotulo(b), 'pt-BR'));
export const maisRecentes = lista => [...lista].sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));

export const rotuloDestino = s =>
  s.destino === 'outro' && s.destinoOutro ? `Outro uso: ${s.destinoOutro}` : (DESTINOS[s.destino] || '');

// Saldo de todos os produtos: entradas menos saidas. Registros excluidos nao contam.
// Toda saida baixa o saldo, inclusive descarte (RF24).
export function saldos() {
  const m = new Map(dados.produtos.map(p => [p.id, 0]));
  for (const e of dados.entradas) if (!e.excluido) m.set(e.produtoId, (m.get(e.produtoId) || 0) + Number(e.quantidade));
  for (const s of dados.saidas) if (!s.excluido) m.set(s.produtoId, (m.get(s.produtoId) || 0) - Number(s.quantidade));
  return m;
}
export const saldo = produtoId => saldos().get(produtoId) || 0;

// Produtos ativos com saldo abaixo do estoque minimo.
export function abaixoDoMinimo() {
  const m = saldos();
  return ordenar(ativos('produtos'))
    .map(p => ({ produto: p, saldo: m.get(p.id) || 0 }))
    .filter(x => x.saldo < Number(x.produto.estoqueMinimo || 0));
}

// Analise de compras de um mes ("AAAA-MM").
// consumo = saidas de consumo interno e outro uso; descarte fica separado e nao gera compra (RF27).
// Compra indicada quando o saldo esta abaixo do minimo OU abaixo do consumo do mes (RF26).
// Quantidade = maior valor entre minimo e consumo, menos o saldo atual (RF28).
export function analiseMes(mes) {
  const m = saldos();
  const linhas = new Map(ativos('produtos').map(p => [p.id, {
    produto: p, consumo: 0, descarte: 0, saldo: m.get(p.id) || 0, minimo: Number(p.estoqueMinimo || 0), comprar: 0,
  }]));
  for (const s of dados.saidas) {
    if (s.excluido || mesLocal(s.dataHora) !== mes) continue;
    const l = linhas.get(s.produtoId);
    if (!l) continue;
    if (s.destino === 'descarte') l.descarte += Number(s.quantidade);
    else l.consumo += Number(s.quantidade);
  }
  const lista = [...linhas.values()];
  for (const l of lista) {
    l.total = l.consumo + l.descarte;
    if (l.saldo < l.minimo || l.saldo < l.consumo) l.comprar = Math.max(l.minimo, l.consumo) - l.saldo;
  }
  return lista;
}

export function mesLocal(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
