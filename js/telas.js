// Telas do sistema. Cada tela tem: titulo, area (cor), render(), acoes, forms e mudou.
import { dados, usuario, adicionar, atualizar, criarUsuario, chaveNome } from './dados.js';
import { DESTINOS, porId, ativos, rotulo, nomeDe, ordenar, maisRecentes, rotuloDestino, saldos, saldo, abaixoDoMinimo, analiseMes, mesLocal } from './regras.js';
import { h, agora, fmtDataHora, fmtData, fmtMoeda, fmtNum, soDigitos, fmtCnpj, fmtCpf, abrirModal, fecharModal, confirmar, alerta, erroForm, aviso } from './util.js';

export function criarTelas(ctx) {
  const PASSO = 100;
  const est = {
    entradas: { produto: '', excluidas: false, limite: PASSO },
    saidas: { produto: '', excluidas: false, limite: PASSO },
    analise: { mes: mesLocal(agora()) },
    hc: { id: '', de: '', ate: '', produto: '' },
    checklist: { excluidos: false },
  };

  // ---------- Pecas de tela ----------
  const tabela = (cab, linhas, vazio) => linhas.length
    ? `<div class="tabela-rolagem"><table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table></div>`
    : `<p class="vazio">${vazio}</p>`;
  const campo = (titulo, html, dica = '') =>
    `<label class="campo"><span>${titulo}</span>${html}${dica ? `<small>${dica}</small>` : ''}</label>`;
  const opcoes = (lista, sel, vazio = 'Selecione...') =>
    `<option value="">${vazio}</option>` + lista.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${h(rotulo(x))}</option>`).join('');
  const botoesForm = texto => `<div class="erro-form" hidden></div>
    <div class="acoes"><button type="button" class="btn btn-secundario" data-acao="fechar-modal">Cancelar</button>
    <button type="submit" class="btn btn-primario">${texto}</button></div>`;
  const situacao = x => x.ativo === false ? '<span class="etiqueta etiqueta-inativo">Inativo</span>' : '<span class="etiqueta etiqueta-ok">Ativo</span>';
  const botaoAtivo = (col, x) => x.ativo === false
    ? `<button type="button" class="btn btn-pequeno" data-acao="alternar" data-col="${col}" data-id="${x.id}">Reativar</button>`
    : `<button type="button" class="btn btn-pequeno" data-acao="alternar" data-col="${col}" data-id="${x.id}">Inativar</button>`;
  // Lista para selecao: so ativos, mais o item ja escolhido (quando se edita um registro antigo).
  const paraSelecao = (col, idAtual) => ordenar(dados[col].filter(x => x.ativo !== false || x.id === idAtual));
  const ativosPrimeiro = lista => [...lista].sort((a, b) =>
    (a.ativo === false) - (b.ativo === false) || rotulo(a).localeCompare(rotulo(b), 'pt-BR'));

  async function alternar(d) {
    const x = porId(d.col, d.id);
    const nome = rotulo(x);
    if (x.ativo === false) {
      await atualizar(d.col, d.id, { ativo: true });
      aviso(`${nome} foi reativado.`);
    } else {
      const ok = await confirmar(`Inativar ${nome}?`,
        'O cadastro deixa de aparecer nas listas de seleção, mas todo o histórico é mantido. Você pode reativar quando quiser.', 'Inativar', true);
      if (!ok) return;
      await atualizar(d.col, d.id, { ativo: false });
      aviso(`${nome} foi inativado.`);
    }
    ctx.renderTela();
  }

  async function registrarAlteracao(tipo, registroId, acao, alteracoes) {
    await adicionar('auditoria', { tipo, registroId, acao, alteracoes, usuarioId: usuario().id, dataHora: agora() });
  }

  function verAlteracoes(d) {
    const lista = maisRecentes(dados.auditoria.filter(a => a.registroId === d.id));
    abrirModal(`<h2>Alterações deste registro</h2>
      ${tabela(['Data e hora', 'Quem fez', 'O que foi feito'], lista.map(a => `<tr>
        <td>${fmtDataHora(a.dataHora)}</td><td>${h(nomeDe('usuarios', a.usuarioId))}</td>
        <td>${a.acao === 'exclusao' ? 'Excluiu o registro' : (a.alteracoes || []).map(x => `${h(x.campo)}: de <b>${h(x.de)}</b> para <b>${h(x.para)}</b>`).join('<br>')}</td>
      </tr>`), 'Este registro nunca foi alterado.')}
      <div class="acoes"><button type="button" class="btn btn-primario" data-acao="fechar-modal">Fechar</button></div>`, 'modal-grande');
  }

  const temAlteracao = id => dados.auditoria.some(a => a.registroId === id);

  // =====================================================================
  // INICIO
  // =====================================================================
  const inicio = {
    titulo: 'Início', area: 'azul',
    render() {
      const baixos = abaixoDoMinimo();
      return `
        <section class="cartao cartao-roxo">
          <h2>Produtos com estoque baixo</h2>
          ${tabela(['Produto', 'Em estoque', 'Estoque mínimo'], baixos.map(x => `<tr>
            <td>${h(x.produto.nome)}</td><td class="num"><b>${fmtNum(x.saldo)}</b></td><td class="num">${fmtNum(x.produto.estoqueMinimo)}</td></tr>`),
            'Nenhum produto está abaixo do estoque mínimo.')}
        </section>
        <h2>O que você quer fazer?</h2>
        <div class="atalhos">
          <button type="button" class="atalho atalho-verde" data-ir="entradas">Registrar entrada de produto</button>
          <button type="button" class="atalho atalho-marrom" data-ir="saidas">Registrar saída de produto</button>
          <button type="button" class="atalho atalho-azul" data-ir="estoque">Ver o estoque</button>
          <button type="button" class="atalho atalho-roxo" data-ir="analise">Ver o que precisa comprar</button>
          <button type="button" class="atalho atalho-marrom" data-ir="checklist">Fazer check list de envio</button>
        </div>`;
    },
  };

  // =====================================================================
  // PRODUTOS (RF04 a RF08)
  // =====================================================================
  function formProduto(p) {
    const forn = ordenar(ativos('fornecedores'));
    abrirModal(`<h2>${p ? 'Editar produto' : 'Cadastrar produto'}</h2>
      <form data-form="produto" data-id="${p ? p.id : ''}">
        ${campo('Nome do produto', `<input name="nome" required maxlength="80" value="${h(p ? p.nome : '')}">`)}
        ${campo('Estoque mínimo', `<input name="estoqueMinimo" type="number" min="0" step="1" required value="${p ? h(p.estoqueMinimo) : ''}">`,
          'Quantidade mínima que deve ter no estoque. Abaixo dela, o sistema avisa.')}
        <fieldset class="campo"><legend>Fornecedores deste produto</legend>
          ${forn.length ? forn.map(f => `<label class="marcar"><input type="checkbox" name="forn" value="${f.id}" ${p && (p.fornecedores || []).includes(f.id) ? 'checked' : ''}> ${h(f.nome)}</label>`).join('')
            : '<small>Nenhum fornecedor cadastrado ainda. Você pode vincular depois.</small>'}
        </fieldset>
        ${botoesForm('Salvar produto')}
      </form>`);
  }

  function historicoProduto(d) {
    const p = porId('produtos', d.id);
    const mov = maisRecentes([
      ...dados.entradas.filter(e => e.produtoId === p.id && !e.excluido).map(e => ({ ...e, tipo: 'Entrada' })),
      ...dados.saidas.filter(s => s.produtoId === p.id && !s.excluido).map(s => ({ ...s, tipo: 'Saída' })),
    ]);
    abrirModal(`<h2>Histórico de ${h(p.nome)}</h2>
      <p>Cadastrado em ${fmtDataHora(p.criadoEm)} por ${h(nomeDe('usuarios', p.criadoPor))}. Em estoque agora: <b>${fmtNum(saldo(p.id))}</b>.</p>
      ${tabela(['Data e hora', 'Tipo', 'Quantidade', 'Valor unitário', 'Fornecedor ou quem recebeu', 'Destino', 'Lançado por'], mov.map(m => `<tr>
        <td>${fmtDataHora(m.dataHora)}</td>
        <td><span class="etiqueta ${m.tipo === 'Entrada' ? 'etiqueta-entrada' : 'etiqueta-saida'}">${m.tipo}</span></td>
        <td class="num">${fmtNum(m.quantidade)}</td>
        <td class="num">${m.tipo === 'Entrada' ? fmtMoeda(m.valorUnitario) : ''}</td>
        <td>${h(m.tipo === 'Entrada' ? nomeDe('fornecedores', m.fornecedorId) : nomeDe('colaboradores', m.colaboradorId))}</td>
        <td>${m.tipo === 'Saída' ? h(rotuloDestino(m)) : ''}</td>
        <td>${h(nomeDe('usuarios', m.usuarioId))}</td></tr>`), 'Este produto ainda não tem entradas nem saídas.')}
      <div class="acoes"><button type="button" class="btn btn-primario" data-acao="fechar-modal">Fechar</button></div>`, 'modal-grande');
  }

  const produtos = {
    titulo: 'Produtos', area: 'azul',
    render() {
      const m = saldos();
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Cadastrar produto</button></div>
        ${tabela(['Produto', 'Em estoque', 'Estoque mínimo', 'Fornecedores', 'Cadastrado em', 'Situação', 'Ações'],
          ativosPrimeiro(dados.produtos).map(p => `<tr class="${p.ativo === false ? 'inativo' : ''}">
            <td><b>${h(p.nome)}</b></td><td class="num">${fmtNum(m.get(p.id) || 0)}</td><td class="num">${fmtNum(p.estoqueMinimo)}</td>
            <td>${(p.fornecedores || []).map(id => h(nomeDe('fornecedores', id))).join(', ')}</td>
            <td>${fmtData(p.criadoEm)}</td><td>${situacao(p)}</td>
            <td class="botoes"><button type="button" class="btn btn-pequeno" data-acao="editar" data-id="${p.id}">Editar</button>
              <button type="button" class="btn btn-pequeno" data-acao="historico" data-id="${p.id}">Ver histórico</button>${botaoAtivo('produtos', p)}</td></tr>`),
          'Nenhum produto cadastrado. Clique em "Cadastrar produto" para começar.')}`;
    },
    acoes: {
      novo: () => formProduto(null),
      editar: d => formProduto(porId('produtos', d.id)),
      historico: historicoProduto,
      alternar,
    },
    forms: {
      async produto(v, f) {
        const nome = v.nome.trim();
        if (!nome) return erroForm(f, 'Informe o nome do produto.');
        const minimo = Math.max(0, Math.round(Number(v.estoqueMinimo) || 0));
        const marcados = [...f.querySelectorAll('[name=forn]:checked')].map(x => x.value);
        const id = f.dataset.id;
        if (id) {
          const p = porId('produtos', id);
          const inativos = (p.fornecedores || []).filter(fid => (porId('fornecedores', fid) || {}).ativo === false);
          await atualizar('produtos', id, { nome, estoqueMinimo: minimo, fornecedores: [...new Set([...marcados, ...inativos])] });
        } else {
          await adicionar('produtos', { nome, estoqueMinimo: minimo, fornecedores: marcados, ativo: true, criadoEm: agora(), criadoPor: usuario().id });
        }
        fecharModal(); aviso('Produto salvo.');
      },
    },
  };

  // =====================================================================
  // FORNECEDORES (RF09 a RF14)
  // =====================================================================
  const produtosDoFornecedor = fid => ordenar(dados.produtos.filter(p => (p.fornecedores || []).includes(fid)));

  function formFornecedor(x) {
    const prods = ordenar(ativos('produtos'));
    const v = k => h(x ? x[k] : '');
    abrirModal(`<h2>${x ? 'Editar fornecedor' : 'Cadastrar fornecedor'}</h2>
      <form data-form="fornecedor" data-id="${x ? x.id : ''}">
        ${campo('Nome do fornecedor', `<input name="nome" required maxlength="100" value="${v('nome')}">`)}
        ${campo('CNPJ', `<input name="cnpj" required inputmode="numeric" maxlength="18" value="${h(x ? fmtCnpj(x.cnpj) : '')}">`, 'Digite os 14 números do CNPJ.')}
        ${campo('Telefone (opcional)', `<input name="telefone" inputmode="tel" maxlength="30" value="${v('telefone')}">`)}
        ${campo('E-mail (opcional)', `<input name="email" type="email" maxlength="100" value="${v('email')}">`)}
        ${campo('Endereço (opcional)', `<input name="endereco" maxlength="200" value="${v('endereco')}">`)}
        ${campo('Observações (opcional)', `<textarea name="observacoes" rows="3" maxlength="500">${v('observacoes')}</textarea>`)}
        <fieldset class="campo"><legend>Produtos que este fornecedor vende</legend>
          ${prods.length ? prods.map(p => `<label class="marcar"><input type="checkbox" name="prod" value="${p.id}" ${x && (p.fornecedores || []).includes(x.id) ? 'checked' : ''}> ${h(p.nome)}</label>`).join('')
            : '<small>Nenhum produto cadastrado ainda. Você pode vincular depois.</small>'}
        </fieldset>
        ${botoesForm('Salvar fornecedor')}
      </form>`);
  }

  function historicoFornecedor(d) {
    const x = porId('fornecedores', d.id);
    const ent = maisRecentes(dados.entradas.filter(e => e.fornecedorId === x.id && !e.excluido));
    abrirModal(`<h2>Histórico de ${h(x.nome)}</h2>
      <p>Cadastrado em ${fmtDataHora(x.criadoEm)}. Entradas de produtos deste fornecedor:</p>
      ${tabela(['Data e hora', 'Produto', 'Quantidade', 'Valor unitário', 'Lançado por'], ent.map(e => `<tr>
        <td>${fmtDataHora(e.dataHora)}</td><td>${h(nomeDe('produtos', e.produtoId))}</td><td class="num">${fmtNum(e.quantidade)}</td>
        <td class="num">${fmtMoeda(e.valorUnitario)}</td><td>${h(nomeDe('usuarios', e.usuarioId))}</td></tr>`), 'Este fornecedor ainda não tem entradas.')}
      <div class="acoes"><button type="button" class="btn btn-primario" data-acao="fechar-modal">Fechar</button></div>`, 'modal-grande');
  }

  const fornecedores = {
    titulo: 'Fornecedores', area: 'azul',
    render() {
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Cadastrar fornecedor</button></div>
        ${tabela(['Fornecedor', 'CNPJ', 'Telefone', 'Produtos', 'Situação', 'Ações'],
          ativosPrimeiro(dados.fornecedores).map(x => `<tr class="${x.ativo === false ? 'inativo' : ''}">
            <td><b>${h(x.nome)}</b></td><td>${h(fmtCnpj(x.cnpj))}</td><td>${h(x.telefone)}</td>
            <td>${produtosDoFornecedor(x.id).map(p => h(p.nome)).join(', ')}</td><td>${situacao(x)}</td>
            <td class="botoes"><button type="button" class="btn btn-pequeno" data-acao="editar" data-id="${x.id}">Editar</button>
              <button type="button" class="btn btn-pequeno" data-acao="historico" data-id="${x.id}">Ver histórico</button>${botaoAtivo('fornecedores', x)}</td></tr>`),
          'Nenhum fornecedor cadastrado. Clique em "Cadastrar fornecedor" para começar.')}`;
    },
    acoes: {
      novo: () => formFornecedor(null),
      editar: d => formFornecedor(porId('fornecedores', d.id)),
      historico: historicoFornecedor,
      alternar,
    },
    forms: {
      async fornecedor(v, f) {
        const nome = v.nome.trim();
        const cnpj = soDigitos(v.cnpj);
        if (!nome) return erroForm(f, 'Informe o nome do fornecedor.');
        if (cnpj.length !== 14) return erroForm(f, 'O CNPJ precisa ter 14 números.');
        const reg = { nome, cnpj, telefone: v.telefone.trim(), email: v.email.trim(), endereco: v.endereco.trim(), observacoes: v.observacoes.trim() };
        let id = f.dataset.id;
        const marcados = new Set([...f.querySelectorAll('[name=prod]:checked')].map(x => x.value));
        if (id) await atualizar('fornecedores', id, reg);
        else id = await adicionar('fornecedores', { ...reg, ativo: true, criadoEm: agora(), criadoPor: usuario().id });
        // Atualiza o vinculo nos produtos ativos (RF11).
        for (const p of ativos('produtos')) {
          const tem = (p.fornecedores || []).includes(id);
          if (marcados.has(p.id) && !tem) await atualizar('produtos', p.id, { fornecedores: [...(p.fornecedores || []), id] });
          if (!marcados.has(p.id) && tem) await atualizar('produtos', p.id, { fornecedores: p.fornecedores.filter(x => x !== id) });
        }
        fecharModal(); aviso('Fornecedor salvo.');
      },
    },
  };

  // =====================================================================
  // COLABORADORES (RF29 a RF34)
  // =====================================================================
  function formColaborador(x) {
    const v = k => h(x ? x[k] : '');
    abrirModal(`<h2>${x ? 'Editar colaborador' : 'Cadastrar colaborador'}</h2>
      <form data-form="colaborador" data-id="${x ? x.id : ''}">
        ${campo('Nome', `<input name="nome" required maxlength="60" value="${v('nome')}">`)}
        ${campo('Sobrenome', `<input name="sobrenome" required maxlength="80" value="${v('sobrenome')}">`)}
        ${campo('Telefone para contato', `<input name="telefone" required inputmode="tel" maxlength="30" value="${v('telefone')}">`)}
        ${campo('CPF (opcional)', `<input name="cpf" inputmode="numeric" maxlength="14" value="${h(x ? fmtCpf(x.cpf) : '')}">`)}
        ${campo('E-mail (opcional)', `<input name="email" type="email" maxlength="100" value="${v('email')}">`)}
        ${botoesForm('Salvar colaborador')}
      </form>`);
  }

  function historicoColaborador(d) {
    est.hc = { id: d.id, de: '', ate: '', produto: '' };
    const x = porId('colaboradores', d.id);
    const prods = ordenar(dados.produtos);
    abrirModal(`<h2>Histórico de ${h(rotulo(x))}</h2>
      <div class="filtros">
        ${campo('A partir de (data e hora)', `<input type="datetime-local" data-mudou="hcFiltro" data-k="de">`)}
        ${campo('Até (data e hora)', `<input type="datetime-local" data-mudou="hcFiltro" data-k="ate">`)}
        ${campo('Produto', `<select data-mudou="hcFiltro" data-k="produto">${opcoes(prods, '', 'Todos os produtos')}</select>`)}
      </div>
      <div id="hc-corpo"></div>
      <div class="acoes"><button type="button" class="btn btn-primario" data-acao="fechar-modal">Fechar</button></div>`, 'modal-grande');
    renderHc();
  }

  function renderHc() {
    const alvo = document.getElementById('hc-corpo');
    if (!alvo) return;
    const f = est.hc;
    const de = f.de ? new Date(f.de).getTime() : -Infinity;
    const ate = f.ate ? new Date(f.ate).getTime() + 59999 : Infinity;
    const lista = maisRecentes(dados.saidas.filter(s => {
      if (s.excluido || s.colaboradorId !== f.id) return false;
      const t = new Date(s.dataHora).getTime();
      return t >= de && t <= ate && (!f.produto || s.produtoId === f.produto);
    }));
    const porProduto = new Map();
    for (const s of lista) {
      const r = porProduto.get(s.produtoId) || { qtd: 0, vezes: 0 };
      r.qtd += Number(s.quantidade); r.vezes += 1;
      porProduto.set(s.produtoId, r);
    }
    const ranking = [...porProduto.entries()].sort((a, b) => b[1].qtd - a[1].qtd);
    alvo.innerHTML = `
      <h3>Produtos que mais retira do estoque</h3>
      ${tabela(['Produto', 'Quantidade retirada', 'Número de retiradas'], ranking.map(([pid, r]) => `<tr>
        <td>${h(nomeDe('produtos', pid))}</td><td class="num"><b>${fmtNum(r.qtd)}</b></td><td class="num">${fmtNum(r.vezes)}</td></tr>`),
        'Nenhuma retirada encontrada para este filtro.')}
      <h3>Todas as retiradas</h3>
      ${tabela(['Data e hora', 'Produto', 'Quantidade', 'Destino', 'Lançado por'], lista.map(s => `<tr>
        <td>${fmtDataHora(s.dataHora)}</td><td>${h(nomeDe('produtos', s.produtoId))}</td><td class="num">${fmtNum(s.quantidade)}</td>
        <td>${h(rotuloDestino(s))}</td><td>${h(nomeDe('usuarios', s.usuarioId))}</td></tr>`), 'Nenhuma retirada encontrada para este filtro.')}`;
  }

  const colaboradores = {
    titulo: 'Colaboradores', area: 'azul',
    render() {
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Cadastrar colaborador</button></div>
        ${tabela(['Colaborador', 'Telefone', 'CPF', 'E-mail', 'Situação', 'Ações'],
          ativosPrimeiro(dados.colaboradores).map(x => `<tr class="${x.ativo === false ? 'inativo' : ''}">
            <td><b>${h(rotulo(x))}</b></td><td>${h(x.telefone)}</td><td>${h(fmtCpf(x.cpf))}</td><td>${h(x.email)}</td><td>${situacao(x)}</td>
            <td class="botoes"><button type="button" class="btn btn-pequeno" data-acao="editar" data-id="${x.id}">Editar</button>
              <button type="button" class="btn btn-pequeno" data-acao="historico" data-id="${x.id}">Ver histórico</button>${botaoAtivo('colaboradores', x)}</td></tr>`),
          'Nenhum colaborador cadastrado. Clique em "Cadastrar colaborador" para começar.')}`;
    },
    acoes: {
      novo: () => formColaborador(null),
      editar: d => formColaborador(porId('colaboradores', d.id)),
      historico: historicoColaborador,
      alternar,
    },
    mudou: { hcFiltro(el) { est.hc[el.dataset.k] = el.value; renderHc(); } },
    forms: {
      async colaborador(v, f) {
        const reg = { nome: v.nome.trim(), sobrenome: v.sobrenome.trim(), telefone: v.telefone.trim(), cpf: soDigitos(v.cpf), email: v.email.trim() };
        if (!reg.nome || !reg.sobrenome || !reg.telefone) return erroForm(f, 'Nome, sobrenome e telefone são obrigatórios.');
        if (reg.cpf && reg.cpf.length !== 11) return erroForm(f, 'O CPF precisa ter 11 números. Se não souber, deixe em branco.');
        const id = f.dataset.id;
        if (id) await atualizar('colaboradores', id, reg);
        else await adicionar('colaboradores', { ...reg, ativo: true, criadoEm: agora(), criadoPor: usuario().id });
        fecharModal(); aviso('Colaborador salvo.');
      },
    },
  };

  // =====================================================================
  // ENTRADAS (RF15 a RF18)
  // =====================================================================
  function formEntrada(e, produtoPre) {
    const pid = e ? e.produtoId : (produtoPre || '');
    abrirModal(`<h2>${e ? 'Editar entrada' : 'Registrar entrada de produto'}</h2>
      <form data-form="entrada" data-id="${e ? e.id : ''}" data-produto="${e ? e.produtoId : ''}">
        ${campo('Produto', `<select name="produtoId" required data-mudou="comparar" ${e ? 'disabled' : ''}>${opcoes(paraSelecao('produtos', pid), pid)}</select>`,
          e ? 'O produto não pode ser trocado. Se foi lançado errado, exclua esta entrada e registre outra.' : '')}
        ${campo('Fornecedor', `<select name="fornecedorId" required>${opcoes(paraSelecao('fornecedores', e ? e.fornecedorId : ''), e ? e.fornecedorId : '')}</select>`)}
        ${campo('Quantidade', `<input name="quantidade" type="number" min="1" step="1" required value="${e ? h(e.quantidade) : ''}">`)}
        ${campo('Valor de cada unidade (R$)', `<input name="valorUnitario" type="number" min="0" step="0.01" required data-mudou="comparar" data-ao-digitar value="${e ? h(e.valorUnitario) : ''}">`)}
        <div id="comparacao" class="comparacao"></div>
        ${e ? '' : '<p class="dica">A data e a hora são registradas automaticamente.</p>'}
        ${botoesForm('Salvar entrada')}
      </form>`);
    comparar();
  }

  // Compara o valor digitado com as entradas anteriores do mesmo produto (RF16).
  function comparar() {
    const alvo = document.getElementById('comparacao');
    if (!alvo) return;
    const f = alvo.closest('form');
    const pid = f.dataset.produto || f.querySelector('[name=produtoId]').value;
    if (!pid) { alvo.innerHTML = ''; return; }
    const ant = maisRecentes(dados.entradas.filter(x => x.produtoId === pid && !x.excluido && x.id !== f.dataset.id)).slice(0, 5);
    if (!ant.length) { alvo.innerHTML = '<p>Este produto ainda não tem entradas anteriores para comparar.</p>'; return; }
    const digitado = f.querySelector('[name=valorUnitario]').value;
    let frase = '';
    if (digitado !== '') {
      const dif = Number(digitado) - Number(ant[0].valorUnitario);
      frase = Math.abs(dif) < 0.005 ? '<p class="igual">Mesmo valor da última entrada.</p>'
        : dif > 0 ? `<p class="mais">${fmtMoeda(dif)} mais caro que a última entrada (${fmtMoeda(ant[0].valorUnitario)}).</p>`
          : `<p class="menos">${fmtMoeda(-dif)} mais barato que a última entrada (${fmtMoeda(ant[0].valorUnitario)}).</p>`;
    }
    alvo.innerHTML = `<h3>Valores das últimas entradas deste produto</h3>${frase}
      ${tabela(['Data', 'Fornecedor', 'Valor unitário'], ant.map(x => `<tr><td>${fmtData(x.dataHora)}</td>
        <td>${h(nomeDe('fornecedores', x.fornecedorId))}</td><td class="num">${fmtMoeda(x.valorUnitario)}</td></tr>`), '')}`;
  }

  const filtroMov = (chave) => `<div class="filtros">
      ${campo('Mostrar apenas o produto', `<select data-mudou="filtroProduto">${opcoes(ordenar(dados.produtos), est[chave].produto, 'Todos os produtos')}</select>`)}
      <label class="marcar"><input type="checkbox" data-mudou="filtroExcluidas" ${est[chave].excluidas ? 'checked' : ''}> Mostrar também as excluídas</label>
    </div>`;
  const listaMov = chave => maisRecentes(dados[chave].filter(x =>
    (est[chave].excluidas || !x.excluido) && (!est[chave].produto || x.produtoId === est[chave].produto)));
  const botoesMov = x => x.excluido
    ? `<span class="etiqueta etiqueta-inativo">Excluída</span><button type="button" class="btn btn-pequeno" data-acao="alteracoes" data-id="${x.id}">Ver alterações</button>`
    : `<button type="button" class="btn btn-pequeno" data-acao="editar" data-id="${x.id}">Editar</button>
       <button type="button" class="btn btn-pequeno" data-acao="excluir" data-id="${x.id}">Excluir</button>
       ${temAlteracao(x.id) ? `<button type="button" class="btn btn-pequeno" data-acao="alteracoes" data-id="${x.id}">Ver alterações</button>` : ''}`;
  const mostrarMais = (chave, total) => total > est[chave].limite
    ? `<div class="barra"><button type="button" class="btn btn-secundario" data-acao="mais">Mostrar registros mais antigos</button></div>` : '';
  const mudouMov = chave => ({
    filtroProduto(el) { est[chave].produto = el.value; est[chave].limite = PASSO; ctx.renderTela(); },
    filtroExcluidas(el) { est[chave].excluidas = el.checked; ctx.renderTela(); },
  });

  const entradas = {
    titulo: 'Entradas', area: 'verde',
    render() {
      const lista = listaMov('entradas');
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Registrar entrada de produto</button></div>
        <h2>Histórico de entradas</h2>${filtroMov('entradas')}
        ${tabela(['Data e hora', 'Produto', 'Fornecedor', 'Quantidade', 'Valor unitário', 'Lançado por', 'Ações'],
          lista.slice(0, est.entradas.limite).map(e => `<tr class="${e.excluido ? 'inativo' : ''}">
            <td>${fmtDataHora(e.dataHora)}</td><td><b>${h(nomeDe('produtos', e.produtoId))}</b></td><td>${h(nomeDe('fornecedores', e.fornecedorId))}</td>
            <td class="num">${fmtNum(e.quantidade)}</td><td class="num">${fmtMoeda(e.valorUnitario)}</td><td>${h(nomeDe('usuarios', e.usuarioId))}</td>
            <td class="botoes">${botoesMov(e)}</td></tr>`), 'Nenhuma entrada registrada.')}
        ${mostrarMais('entradas', lista.length)}`;
    },
    acoes: {
      novo() {
        if (!ativos('produtos').length) return alerta('Cadastre um produto primeiro', 'Para registrar uma entrada é preciso ter pelo menos um produto cadastrado.');
        if (!ativos('fornecedores').length) return alerta('Cadastre um fornecedor primeiro', 'Para registrar uma entrada é preciso ter pelo menos um fornecedor cadastrado.');
        formEntrada(null);
      },
      editar: d => formEntrada(porId('entradas', d.id)),
      alteracoes: verAlteracoes,
      mais() { est.entradas.limite += PASSO; ctx.renderTela(); },
      async excluir(d) {
        const e = porId('entradas', d.id);
        const nome = nomeDe('produtos', e.produtoId);
        if (saldo(e.produtoId) - Number(e.quantidade) < 0)
          return alerta('Não é possível excluir esta entrada', `Parte destas unidades de ${nome} já saiu do estoque. Se a entrada for excluída, o estoque fica negativo.`);
        const ok = await confirmar('Excluir esta entrada?', `Entrada de ${fmtNum(e.quantidade)} unidades de ${nome}. O estoque será diminuído e a exclusão ficará registrada com o seu nome.`, 'Excluir entrada', true);
        if (!ok) return;
        await atualizar('entradas', e.id, { excluido: true });
        await registrarAlteracao('entrada', e.id, 'exclusao', []);
        aviso('Entrada excluída.'); ctx.renderTela();
      },
    },
    mudou: { ...mudouMov('entradas'), comparar },
    forms: {
      async entrada(v, f) {
        const qtd = Number(v.quantidade), valor = Number(v.valorUnitario);
        if (!Number.isInteger(qtd) || qtd < 1) return erroForm(f, 'A quantidade precisa ser um número inteiro maior que zero.');
        if (!(valor >= 0) || v.valorUnitario === '') return erroForm(f, 'Informe o valor de cada unidade.');
        if (!v.fornecedorId) return erroForm(f, 'Escolha o fornecedor.');
        const id = f.dataset.id;
        if (id) {
          const a = porId('entradas', id);
          if (saldo(a.produtoId) - Number(a.quantidade) + qtd < 0)
            return erroForm(f, 'Não é possível diminuir tanto esta entrada: parte das unidades já saiu e o estoque ficaria negativo.');
          const alt = [];
          if (a.fornecedorId !== v.fornecedorId) alt.push({ campo: 'Fornecedor', de: nomeDe('fornecedores', a.fornecedorId), para: nomeDe('fornecedores', v.fornecedorId) });
          if (Number(a.quantidade) !== qtd) alt.push({ campo: 'Quantidade', de: fmtNum(a.quantidade), para: fmtNum(qtd) });
          if (Number(a.valorUnitario) !== valor) alt.push({ campo: 'Valor unitário', de: fmtMoeda(a.valorUnitario), para: fmtMoeda(valor) });
          if (alt.length) {
            await atualizar('entradas', id, { fornecedorId: v.fornecedorId, quantidade: qtd, valorUnitario: valor });
            await registrarAlteracao('entrada', id, 'edicao', alt);
          }
        } else {
          if (!v.produtoId) return erroForm(f, 'Escolha o produto.');
          await adicionar('entradas', { produtoId: v.produtoId, fornecedorId: v.fornecedorId, quantidade: qtd, valorUnitario: valor, dataHora: agora(), usuarioId: usuario().id });
        }
        // Vincula o fornecedor ao produto, se ainda nao estiver vinculado (RF08).
        const p = porId('produtos', id ? porId('entradas', id).produtoId : v.produtoId);
        if (p && !(p.fornecedores || []).includes(v.fornecedorId))
          await atualizar('produtos', p.id, { fornecedores: [...(p.fornecedores || []), v.fornecedorId] });
        fecharModal(); aviso('Entrada salva.');
      },
    },
  };

  // =====================================================================
  // SAIDAS (RF19 a RF23)
  // =====================================================================
  function formSaida(s) {
    const pid = s ? s.produtoId : '';
    const dest = s ? s.destino : 'consumo';
    abrirModal(`<h2>${s ? 'Editar saída' : 'Registrar saída de produto'}</h2>
      <form data-form="saida" data-id="${s ? s.id : ''}" data-produto="${pid}">
        ${campo('Produto', `<select name="produtoId" required data-mudou="saldoSaida" ${s ? 'disabled' : ''}>${opcoes(paraSelecao('produtos', pid), pid)}</select>`,
          s ? 'O produto não pode ser trocado. Se foi lançado errado, exclua esta saída e registre outra.' : '')}
        <div id="saldo-saida" class="saldo-saida"></div>
        ${campo('Quantidade', `<input name="quantidade" type="number" min="1" step="1" required value="${s ? h(s.quantidade) : ''}">`)}
        <fieldset class="campo"><legend>Para onde o produto vai?</legend>
          ${Object.entries(DESTINOS).map(([k, t]) => `<label class="marcar"><input type="radio" name="destino" value="${k}" data-mudou="destinoSaida" ${k === dest ? 'checked' : ''}> ${t}</label>`).join('')}
          <input name="destinoOutro" id="destino-outro" maxlength="120" placeholder="Escreva qual é o outro uso" value="${h(s ? s.destinoOutro : '')}" ${dest === 'outro' ? '' : 'hidden'}>
        </fieldset>
        ${campo('Quem está recebendo o produto', `<select name="colaboradorId" required>${opcoes(paraSelecao('colaboradores', s ? s.colaboradorId : ''), s ? s.colaboradorId : '')}</select>`)}
        ${s ? '' : `<p class="dica">A saída fica registrada em nome de ${h(rotulo(usuario()))}, com data e hora automáticas.</p>`}
        ${botoesForm('Salvar saída')}
      </form>`);
    saldoSaida();
  }

  function saldoSaida() {
    const alvo = document.getElementById('saldo-saida');
    if (!alvo) return;
    const f = alvo.closest('form');
    const pid = f.dataset.produto || f.querySelector('[name=produtoId]').value;
    alvo.innerHTML = pid ? `Em estoque agora: <b>${fmtNum(saldo(pid))}</b>` : '';
  }

  // Bloqueio da saida maior que o saldo (RF21).
  function popupFalta(pid, disponivel) {
    abrirModal(`<div class="faixa-erro">Produto em falta no estoque</div>
      <p>Não é possível registrar esta saída. O produto <b>${h(nomeDe('produtos', pid))}</b> tem apenas <b>${fmtNum(disponivel)}</b> em estoque.</p>
      <p>É preciso cadastrar a entrada do produto antes de dar a saída.</p>
      <div class="acoes"><button type="button" class="btn btn-primario" data-acao="ir-entrada" data-produto="${pid}">Ir para a entrada de produto</button></div>`, 'modal-erro');
  }

  const saidas = {
    titulo: 'Saídas', area: 'marrom',
    render() {
      const lista = listaMov('saidas');
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Registrar saída de produto</button></div>
        <h2>Histórico de saídas</h2>${filtroMov('saidas')}
        ${tabela(['Data e hora', 'Produto', 'Quantidade', 'Destino', 'Quem recebeu', 'Lançado por', 'Ações'],
          lista.slice(0, est.saidas.limite).map(s => `<tr class="${s.excluido ? 'inativo' : ''}">
            <td>${fmtDataHora(s.dataHora)}</td><td><b>${h(nomeDe('produtos', s.produtoId))}</b></td><td class="num">${fmtNum(s.quantidade)}</td>
            <td>${h(rotuloDestino(s))}</td><td>${h(nomeDe('colaboradores', s.colaboradorId))}</td><td>${h(nomeDe('usuarios', s.usuarioId))}</td>
            <td class="botoes">${botoesMov(s)}</td></tr>`), 'Nenhuma saída registrada.')}
        ${mostrarMais('saidas', lista.length)}`;
    },
    acoes: {
      novo() {
        if (!ativos('produtos').length) return alerta('Cadastre um produto primeiro', 'Para registrar uma saída é preciso ter pelo menos um produto cadastrado.');
        if (!ativos('colaboradores').length) return alerta('Cadastre um colaborador primeiro', 'Toda saída precisa informar o colaborador que está recebendo o produto.');
        formSaida(null);
      },
      editar: d => formSaida(porId('saidas', d.id)),
      alteracoes: verAlteracoes,
      mais() { est.saidas.limite += PASSO; ctx.renderTela(); },
      'ir-entrada'(d) { fecharModal(); ctx.navegar('entradas'); formEntrada(null, d.produto); },
      async excluir(d) {
        const s = porId('saidas', d.id);
        const ok = await confirmar('Excluir esta saída?', `Saída de ${fmtNum(s.quantidade)} unidades de ${nomeDe('produtos', s.produtoId)}. As unidades voltam para o estoque e a exclusão ficará registrada com o seu nome.`, 'Excluir saída', true);
        if (!ok) return;
        await atualizar('saidas', s.id, { excluido: true });
        await registrarAlteracao('saida', s.id, 'exclusao', []);
        aviso('Saída excluída.'); ctx.renderTela();
      },
    },
    mudou: {
      ...mudouMov('saidas'),
      saldoSaida,
      destinoSaida(el) { const o = document.getElementById('destino-outro'); o.hidden = el.value !== 'outro'; if (!o.hidden) o.focus(); },
    },
    forms: {
      async saida(v, f) {
        const qtd = Number(v.quantidade);
        if (!Number.isInteger(qtd) || qtd < 1) return erroForm(f, 'A quantidade precisa ser um número inteiro maior que zero.');
        if (!v.colaboradorId) return erroForm(f, 'Escolha o colaborador que está recebendo o produto.');
        const destino = DESTINOS[v.destino] ? v.destino : 'consumo';
        const destinoOutro = destino === 'outro' ? (v.destinoOutro || '').trim() : '';
        const id = f.dataset.id;
        if (id) {
          const a = porId('saidas', id);
          const disponivel = saldo(a.produtoId) + Number(a.quantidade);
          if (qtd > disponivel) return popupFalta(a.produtoId, disponivel);
          const alt = [];
          if (Number(a.quantidade) !== qtd) alt.push({ campo: 'Quantidade', de: fmtNum(a.quantidade), para: fmtNum(qtd) });
          const novo = { ...a, destino, destinoOutro };
          if (rotuloDestino(a) !== rotuloDestino(novo)) alt.push({ campo: 'Destino', de: rotuloDestino(a), para: rotuloDestino(novo) });
          if (a.colaboradorId !== v.colaboradorId) alt.push({ campo: 'Quem recebeu', de: nomeDe('colaboradores', a.colaboradorId), para: nomeDe('colaboradores', v.colaboradorId) });
          if (alt.length) {
            await atualizar('saidas', id, { quantidade: qtd, destino, destinoOutro, colaboradorId: v.colaboradorId });
            await registrarAlteracao('saida', id, 'edicao', alt);
          }
        } else {
          if (!v.produtoId) return erroForm(f, 'Escolha o produto.');
          const disponivel = saldo(v.produtoId);
          if (qtd > disponivel) return popupFalta(v.produtoId, disponivel);
          await adicionar('saidas', { produtoId: v.produtoId, quantidade: qtd, destino, destinoOutro, colaboradorId: v.colaboradorId, dataHora: agora(), usuarioId: usuario().id });
        }
        fecharModal(); aviso('Saída salva.');
      },
    },
  };

  // =====================================================================
  // ESTOQUE (RF24)
  // =====================================================================
  const estoque = {
    titulo: 'Estoque', area: 'azul',
    render() {
      const m = saldos();
      return `<p>Quantidade atual de cada produto, calculada pelas entradas e saídas.</p>
        ${tabela(['Produto', 'Em estoque', 'Estoque mínimo', 'Situação'], ordenar(ativos('produtos')).map(p => {
          const s = m.get(p.id) || 0, min = Number(p.estoqueMinimo || 0);
          const et = s <= 0 ? '<span class="etiqueta etiqueta-erro">Sem estoque</span>'
            : s < min ? '<span class="etiqueta etiqueta-baixo">Abaixo do mínimo</span>' : '<span class="etiqueta etiqueta-ok">Em ordem</span>';
          return `<tr><td><b>${h(p.nome)}</b></td><td class="num"><b>${fmtNum(s)}</b></td><td class="num">${fmtNum(min)}</td><td>${et}</td></tr>`;
        }), 'Nenhum produto cadastrado.')}`;
    },
  };

  // =====================================================================
  // ANALISE DE COMPRAS (RF25 a RF28)
  // =====================================================================
  const analise = {
    titulo: 'Análise de compras', area: 'roxo',
    render() {
      const linhas = analiseMes(est.analise.mes);
      const comprar = linhas.filter(l => l.comprar > 0).sort((a, b) => b.comprar - a.comprar);
      const sairam = linhas.filter(l => l.total > 0).sort((a, b) => b.total - a.total);
      return `<div class="filtros">${campo('Mês analisado', `<input type="month" data-mudou="mes" value="${est.analise.mes}">`)}</div>
        <section class="cartao cartao-roxo">
          <h2>O que comprar para o próximo mês</h2>
          ${tabela(['Produto', 'Em estoque agora', 'Estoque mínimo', 'Consumo do mês', 'Quantidade a comprar'], comprar.map(l => `<tr>
            <td><b>${h(l.produto.nome)}</b></td><td class="num">${fmtNum(l.saldo)}</td><td class="num">${fmtNum(l.minimo)}</td>
            <td class="num">${fmtNum(l.consumo)}</td><td class="num destaque">${fmtNum(l.comprar)}</td></tr>`),
            'Nenhum produto precisa ser comprado. O estoque está acima do mínimo e do consumo do mês.')}
          <p class="dica">Um produto entra nesta lista quando o estoque está abaixo do mínimo ou abaixo do consumo do mês. A quantidade a comprar é o maior valor entre o mínimo e o consumo, menos o que há em estoque. Descartes não entram no consumo.</p>
        </section>
        <h2>Produtos que mais saíram no mês</h2>
        ${tabela(['Posição', 'Produto', 'Consumo', 'Descarte', 'Total que saiu'], sairam.map((l, i) => `<tr>
          <td>${i + 1}º</td><td><b>${h(l.produto.nome)}</b></td><td class="num">${fmtNum(l.consumo)}</td>
          <td class="num">${fmtNum(l.descarte)}</td><td class="num"><b>${fmtNum(l.total)}</b></td></tr>`), 'Nenhuma saída registrada neste mês.')}`;
    },
    mudou: { mes(el) { if (el.value) { est.analise.mes = el.value; ctx.renderTela(); } } },
  };

  // =====================================================================
  // CHECK LIST DE ENVIO (RF35 a RF39)
  // =====================================================================
  const linhaItem = () => `<div class="item-linha">
      <select name="itemProduto" required aria-label="Produto">${opcoes(ordenar(ativos('produtos')), '', 'Escolha o produto...')}</select>
      <input name="itemQtd" type="number" min="1" step="1" required placeholder="Quantidade" aria-label="Quantidade">
      <button type="button" class="btn btn-pequeno" data-acao="cl-remover">Remover</button>
    </div>`;

  function formChecklist() {
    abrirModal(`<h2>Novo check list de envio</h2>
      <form data-form="checklist">
        ${campo('Cliente', `<input name="cliente" required maxlength="120">`)}
        ${campo('Local de destino', `<input name="local" required maxlength="160">`)}
        ${campo('Quem vai levar os produtos', `<select name="colaboradorId" required>${opcoes(ordenar(ativos('colaboradores')), '')}</select>`)}
        <fieldset class="campo"><legend>Produtos que serão levados</legend>
          <div id="cl-itens">${linhaItem()}</div>
          <button type="button" class="btn btn-secundario" data-acao="cl-adicionar">Adicionar mais um produto</button>
        </fieldset>
        <p class="dica">O check list serve só para conferência do envio. Ele não dá baixa no estoque.</p>
        ${botoesForm('Salvar e ver a folha')}
      </form>`, 'modal-grande');
  }

  function folha(c) {
    return `<div class="folha">
      <h1>Check list de envio</h1>
      <p class="folha-sub">Nº ${h(c.numero)} · Feito em ${fmtDataHora(c.dataHora)}</p>
      <table class="folha-dados">
        <tr><th>Cliente</th><td>${h(c.cliente)}</td></tr>
        <tr><th>Local de destino</th><td>${h(c.local)}</td></tr>
      </table>
      <table class="folha-itens">
        <thead><tr><th class="cx">Conferido</th><th>Produto</th><th class="qt">Quantidade</th></tr></thead>
        <tbody>${c.itens.map(i => `<tr><td class="cx"><span class="caixa"></span></td><td>${h(nomeDe('produtos', i.produtoId))}</td><td class="qt">${fmtNum(i.quantidade)}</td></tr>`).join('')}</tbody>
      </table>
      <p class="folha-termo">Os abaixo assinados conferiram os itens desta lista e se responsabilizam pelo envio completo dos produtos ao cliente.</p>
      <div class="assinaturas">
        <div><div class="linha"></div><b>${h(nomeDe('usuarios', c.usuarioId))}</b><span>Responsável pelo check list</span></div>
        <div><div class="linha"></div><b>${h(nomeDe('colaboradores', c.colaboradorId))}</b><span>Quem vai levar os produtos</span></div>
      </div>
    </div>`;
  }

  function verChecklist(id) {
    const c = porId('checklists', id);
    abrirModal(`${folha(c)}
      <div class="acoes"><button type="button" class="btn btn-secundario" data-acao="fechar-modal">Fechar</button>
      <button type="button" class="btn btn-primario" data-acao="cl-imprimir" data-id="${c.id}">Imprimir a folha</button></div>`, 'modal-grande');
  }

  const checklist = {
    titulo: 'Check list de envio', area: 'marrom',
    render() {
      const lista = maisRecentes(dados.checklists.filter(c => est.checklist.excluidos || !c.excluido));
      return `<div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Fazer novo check list</button></div>
        <h2>Histórico de check lists</h2>
        <div class="filtros"><label class="marcar"><input type="checkbox" data-mudou="clExcluidos" ${est.checklist.excluidos ? 'checked' : ''}> Mostrar também os excluídos</label></div>
        ${tabela(['Nº', 'Data e hora', 'Cliente', 'Local de destino', 'Produtos', 'Quem levou', 'Feito por', 'Ações'], lista.map(c => `<tr class="${c.excluido ? 'inativo' : ''}">
          <td class="num">${h(c.numero)}</td><td>${fmtDataHora(c.dataHora)}</td><td><b>${h(c.cliente)}</b></td><td>${h(c.local)}</td>
          <td class="num">${c.itens.length}</td><td>${h(nomeDe('colaboradores', c.colaboradorId))}</td><td>${h(nomeDe('usuarios', c.usuarioId))}</td>
          <td class="botoes">${c.excluido
            ? `<span class="etiqueta etiqueta-inativo">Excluído</span><span class="dica">por ${h(nomeDe('usuarios', c.excluidoPor))} em ${fmtDataHora(c.excluidoEm)}</span>`
            : `<button type="button" class="btn btn-pequeno" data-acao="ver" data-id="${c.id}">Ver e imprimir</button>
               <button type="button" class="btn btn-pequeno" data-acao="excluir" data-id="${c.id}">Excluir</button>`}</td></tr>`),
          'Nenhum check list feito ainda.')}`;
    },
    mudou: { clExcluidos(el) { est.checklist.excluidos = el.checked; ctx.renderTela(); } },
    acoes: {
      novo() {
        if (!ativos('produtos').length) return alerta('Cadastre um produto primeiro', 'Para fazer um check list é preciso ter pelo menos um produto cadastrado.');
        if (!ativos('colaboradores').length) return alerta('Cadastre um colaborador primeiro', 'O check list precisa informar o colaborador que vai levar os produtos.');
        formChecklist();
      },
      ver: d => verChecklist(d.id),
      async excluir(d) {
        const c = porId('checklists', d.id);
        const ok = await confirmar(`Excluir o check list nº ${c.numero}?`,
          `Check list do cliente ${c.cliente}. Ele sai da lista e a exclusão fica registrada com o seu nome. O estoque não muda.`, 'Excluir check list', true);
        if (!ok) return;
        await atualizar('checklists', c.id, { excluido: true, excluidoPor: usuario().id, excluidoEm: agora() });
        aviso('Check list excluído.'); ctx.renderTela();
      },
      'cl-adicionar'() { document.getElementById('cl-itens').insertAdjacentHTML('beforeend', linhaItem()); },
      'cl-remover'(d, el) {
        const itens = document.querySelectorAll('#cl-itens .item-linha');
        if (itens.length > 1) el.closest('.item-linha').remove();
      },
      'cl-imprimir'(d) {
        document.getElementById('folha-impressao').innerHTML = folha(porId('checklists', d.id));
        window.print();
      },
    },
    forms: {
      async checklist(v, f) {
        const itens = [...f.querySelectorAll('.item-linha')].map(l => ({
          produtoId: l.querySelector('[name=itemProduto]').value,
          quantidade: Number(l.querySelector('[name=itemQtd]').value),
        }));
        if (!itens.length || itens.some(i => !i.produtoId || !Number.isInteger(i.quantidade) || i.quantidade < 1))
          return erroForm(f, 'Escolha o produto e informe a quantidade em todas as linhas.');
        if (!v.cliente.trim() || !v.local.trim() || !v.colaboradorId) return erroForm(f, 'Preencha o cliente, o local de destino e quem vai levar.');
        const numero = dados.checklists.reduce((n, c) => Math.max(n, Number(c.numero) || 0), 0) + 1;
        const id = await adicionar('checklists', { numero, cliente: v.cliente.trim(), local: v.local.trim(), colaboradorId: v.colaboradorId, itens, usuarioId: usuario().id, dataHora: agora() });
        aviso('Check list salvo.');
        verChecklist(id);
      },
    },
  };

  // =====================================================================
  // USUARIOS (RF01 a RF03)
  // =====================================================================
  const DUPLICADO = 'Já existe um usuário cadastrado com este nome e sobrenome. O sistema não permite dois usuários iguais.';

  const usuarios = {
    titulo: 'Usuários', area: 'azul',
    render() {
      return `<p>Usuários são as pessoas que entram no sistema com nome, sobrenome e senha.</p>
        <div class="barra"><button type="button" class="btn btn-primario" data-acao="novo">Cadastrar usuário</button></div>
        ${tabela(['Usuário', 'Cadastrado em'], ordenar(dados.usuarios).map(u => `<tr><td><b>${h(rotulo(u))}</b></td><td>${fmtDataHora(u.criadoEm)}</td></tr>`), '')}`;
    },
    acoes: {
      novo() {
        abrirModal(`<h2>Cadastrar usuário</h2>
          <form data-form="usuario">
            ${campo('Nome', `<input name="nome" required maxlength="60" autocomplete="off">`)}
            ${campo('Sobrenome', `<input name="sobrenome" required maxlength="80" autocomplete="off">`)}
            ${campo('Senha', `<input name="senha" type="password" required minlength="6" autocomplete="new-password">`, 'Pelo menos 6 caracteres.')}
            ${campo('Repita a senha', `<input name="senha2" type="password" required minlength="6" autocomplete="new-password">`)}
            ${botoesForm('Cadastrar usuário')}
          </form>`);
      },
    },
    forms: {
      async usuario(v, f) {
        erroForm(f, '');
        if (v.senha !== v.senha2) return erroForm(f, 'As duas senhas digitadas são diferentes.');
        const chave = chaveNome(v.nome, v.sobrenome);
        if (dados.usuarios.some(u => u.chave === chave)) return erroForm(f, DUPLICADO);
        try { await criarUsuario(v.nome, v.sobrenome, v.senha, false); }
        catch (e) { return erroForm(f, e.message === 'DUPLICADO' ? DUPLICADO : e.message); }
        fecharModal(); aviso('Usuário cadastrado.');
      },
    },
  };

  return { inicio, produtos, fornecedores, colaboradores, entradas, saidas, estoque, analise, checklist, usuarios };
}
