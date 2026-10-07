/* Bolha Venda — triagem do vendedor após a explosão (T17). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, S = BV.state;
  const TV = (BV.triagemVendedor = {});
  let root;
  const T = {
    tab: 'todos', q: '', sel: {},
    items: [
      { id: 1, nome: 'Carlos Silva', ps: 'Bolhista#4F2A', cotas: 1, st: 'aguard', end: 'Rua das Flores, 120, apto 31 · Pinheiros · São Paulo/SP · 05422-010' },
      { id: 2, nome: 'Mercadão Distribuidora Ltda', ps: 'Mercadão#11C0', cotas: 10, st: 'aguard', end: 'Av. Paulista, 1000, cj. 42 · Bela Vista · São Paulo/SP · 01310-100' },
      { id: 3, nome: 'Ana Paula Ribeiro', ps: 'Ana#A3F1', cotas: 1, st: 'env', sub: 'QB123456789BR · previsão 04/12', end: 'Rua Bela Cintra, 450 · Consolação · São Paulo/SP · 01415-000' },
      { id: 4, nome: 'João Mendes', ps: 'Bolhista#77B0', cotas: 1, st: 'caso', sub: 'Não recebi · aberto em 05/12', end: 'Rua do Ouvidor, 12 · Centro · Rio de Janeiro/RJ · 20040-030' },
      { id: 5, nome: 'Pedro Lima', ps: 'Pedro#E7B2', cotas: 1, st: 'ent', sub: 'Entregue em 02/12', end: 'Av. Ipiranga, 200 · República · São Paulo/SP · 01046-010' },
      { id: 6, nome: 'Loja2B Comércio ME', ps: 'Loja2B#5C21', cotas: 5, st: 'aguard', end: 'Rua Augusta, 1500 · Consolação · São Paulo/SP · 01304-001' },
      { id: 7, nome: 'Juliana Costa', ps: 'Bolhista#C4E8', cotas: 1, st: 'aguard', end: 'Rua Haddock Lobo, 595 · Cerqueira César · São Paulo/SP · 01414-001' },
      { id: 8, nome: 'Rafael Souza', ps: 'Bolhista#1A9F', cotas: 1, st: 'env', sub: 'JD0098812 · previsão 05/12', end: 'Rua Oscar Freire, 300 · Jardins · São Paulo/SP · 01426-000' },
      { id: 9, nome: 'Marina Alves', ps: 'Bolhista#62AA', cotas: 1, st: 'ent', sub: 'Entregue em 01/12', end: 'Rua Teodoro Sampaio, 800 · Pinheiros · São Paulo/SP · 05406-000' }
    ]
  };
  const TABS = [['todos', 'Todos'], ['aguard', 'Aguardando'], ['atraso', 'Atrasados'], ['env', 'Enviados'], ['ent', 'Entregues'], ['arrep', 'Arrependimento'], ['caso', 'Casos'], ['concl', 'Concluídos']];
  const META = { aguard: ['Aguardando envio', 'pill--amber-soft'], env: ['Enviado', 'pill--info'], ent: ['Entregue', 'pill--ok'], caso: ['Caso aberto', 'pill--danger-soft'] };
  const count = (k) => (k === 'todos' ? T.items.length : T.items.filter((i) => i.st === k).length);
  const visible = () => {
    const q = T.q.trim().toLowerCase();
    return T.items.filter((i) => (T.tab === 'todos' || i.st === T.tab) && (!q || (i.nome + ' ' + i.ps).toLowerCase().indexOf(q) >= 0));
  };

  TV.render = () => {
    root = U.$('#view-page');
    const vis = visible(), nSel = vis.filter((i) => T.sel[i.id]).length, aguard = count('aguard');
    const loading = S.canvasState === 'carregando';
    const rows = vis.map((i) => {
      const m = META[i.st];
      let acao;
      if (i.st === 'aguard') acao = '<button type="button" class="btn btn--primary btn--sm" data-action="tv-envio" data-id="' + i.id + '">' + U.icon('truck') + 'Registrar envio</button>' +
        '<button type="button" class="btn btn--secondary btn--sm" data-action="tv-end" data-id="' + i.id + '">Endereço</button>';
      else if (i.st === 'caso') acao = '<button type="button" class="btn btn--danger btn--sm" data-action="tv-caso" data-id="' + i.id + '">Ver caso</button>';
      else acao = '<span class="field__hint">' + (i.st === 'env' ? 'Aguardando entrega' : 'Janela de arrependimento até 09/12') + '</span>';
      return '<tr><td data-label="Selecionar"><input type="checkbox" class="tbl-chk" id="tv-chk-' + i.id + '" data-change="tv-sel" data-id="' + i.id + '"' + (T.sel[i.id] ? ' checked' : '') + ' aria-label="Selecionar ' + U.esc(i.nome) + '"></td>' +
        '<td data-label="Comprador"><strong>' + U.esc(i.nome) + '</strong><div class="field__hint">' + U.esc(i.ps) + '</div></td>' +
        '<td data-label="Cotas" class="mono">' + i.cotas + '</td>' +
        '<td data-label="Valor" class="mono num-r">' + U.brl(i.cotas * 80) + '</td>' +
        '<td data-label="Status"><span class="pill ' + m[1] + '">' + m[0] + '</span>' + (i.sub ? '<div class="field__hint mono" style="margin-top:4px">' + U.esc(i.sub) + '</div>' : '') + '</td>' +
        '<td data-label="Ação"><div class="tbl-actions">' + acao + '</div></td></tr>';
    }).join('');
    U.rerender(root,
      '<div class="page"><div class="page__wrap">' +
      '<a class="back-link" href="#/">' + U.icon('left') + 'Voltar ao mapa</a>' +
      (S.persona !== 'pj' ? '<div class="alert alert--info" style="margin-bottom:16px">' + U.icon('info') + '<span>Visão do vendedor TecnoLotes#9C1D. No painel do moderador, troque para a persona Empresa para viver este papel.</span></div>' : '') +
      '<div class="tv-head"><div><h1 class="page-title" id="page-h" tabindex="-1">Triagem · Fone Bluetooth XT-500</h1>' +
        '<p style="color:var(--text-2)">Lote de novembro · fechou a <strong>R$ 80,00</strong> por cota · 72 compradores · 100 cotas</p></div>' +
        '<div class="tv-kpis"><div class="kpi">' + '<span class="kpi__l">Prazo de envio</span><span class="kpi__v">' + U.icon('clock') + 'Envie até 03/12, 12h <span style="font-weight:500;color:var(--text-2)">(faltam 4 dias)</span></span></div>' +
        '<div class="kpi"><span class="kpi__l">Repasse previsto</span><span class="kpi__v mono">R$ 5.414,40</span><span class="kpi__s">líquido após as janelas de arrependimento</span></div></div></div>' +
      (aguard ? '<div class="alert alert--warn" style="margin:16px 0 0">' + U.icon('alert') + '<span>' + aguard + (aguard === 1 ? ' envio vence' : ' envios vencem') + ' em 03/12, 12h. Envios atrasados contam contra o seu score.</span></div>' : '') +
      '<div class="tabs" role="tablist" aria-label="Filtrar compradores por status">' + TABS.map(([k, l]) => {
        const n = count(k);
        return '<button type="button" role="tab" class="tab" id="tv-tab-' + k + '" aria-selected="' + (T.tab === k) + '" aria-controls="tv-panel"' + (T.tab === k ? '' : ' tabindex="-1"') + ' data-action="tv-tab" data-tab="' + k + '">' + l +
          '<span class="tab__n' + (k === 'caso' && n ? ' is-alert' : '') + '">' + n + '</span></button>';
      }).join('') + '</div>' +
      '<div id="tv-panel" role="tabpanel" aria-labelledby="tv-tab-' + T.tab + '">' +
      '<div class="tv-tools"><div class="searchbox" style="max-width:380px"><label for="tv-q" class="sr-only">Buscar comprador por nome ou apelido</label>' + U.icon('search') +
        '<input id="tv-q" type="search" placeholder="Buscar comprador por nome ou apelido" value="' + U.esc(T.q) + '" data-input="tv-q"></div>' +
        '<button type="button" class="btn btn--secondary" data-action="tv-csv">' + U.icon('upload') + 'Envio em lote (CSV)</button></div>' +
      '<div class="tbl-wrap" id="tv-table">' + (loading
        ? '<div aria-busy="true">' + Array.from({ length: 5 }, () => '<div class="skel-row" aria-hidden="true"></div>').join('') + '<p class="sr-only" role="status">Carregando compradores…</p></div>'
        : vis.length ? '<table class="tbl"><caption class="sr-only">Compradores da bolha, aba ' + TABS.find((t) => t[0] === T.tab)[1] + '</caption><thead><tr>' +
          '<th scope="col"><input type="checkbox" class="tbl-chk" id="tv-all" data-change="tv-all"' + (nSel && nSel === vis.length ? ' checked' : '') + ' aria-label="Selecionar todos desta aba"></th>' +
          '<th scope="col">Comprador</th><th scope="col">Cotas</th><th scope="col" class="num-r">Valor</th><th scope="col">Status</th><th scope="col">Ação</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="tbl-empty">' + (T.tab === 'aguard' ? 'Nenhum item aguardando envio. Tudo em dia!' : T.q ? 'Nenhum comprador encontrado para "' + U.esc(T.q) + '".' : 'Nenhum item nesta aba.') + '</div>') + '</div>' +
      '<div class="tv-foot"><span id="tv-count" role="status">' + (nSel ? nSel + (nSel === 1 ? ' selecionado' : ' selecionados') : 'Mostrando ' + vis.length + ' de 72 compradores') + '</span>' +
        '<button type="button" class="btn btn--primary" id="tv-bulk" data-action="tv-envio-sel"' + (nSel ? '' : ' disabled') + '>Registrar envio dos selecionados' + (nSel ? ' (' + nSel + ')' : '') + '</button>' +
        '<nav class="pager" aria-label="Paginação"><button type="button" aria-current="page" class="pager__b is-cur">1</button><button type="button" class="pager__b" data-action="tv-page">2</button><button type="button" class="pager__b" data-action="tv-page">3</button>' +
        '<button type="button" class="pager__b" data-action="tv-page" aria-label="Próxima página">' + U.icon('right') + '</button></nav></div>' +
      '</div></div></div>');
  };

  /* Registrar envio (painel lateral) */
  function openEnvio(ids) {
    const alvo = ids.length === 1 ? T.items.find((i) => i.id === ids[0]) : null;
    const F = { carrier: 'Correios', code: '', tried: false };
    const dlg = U.dialog({
      variant: 'drawer',
      render: () => {
        const bad = F.tried && F.code.trim().length < 8;
        return U.dlgHead('Registrar envio', alvo ? U.esc(alvo.nome) + ' · ' + alvo.cotas + (alvo.cotas === 1 ? ' cota' : ' cotas') : ids.length + ' compradores selecionados') +
          '<div class="dialog__body">' +
          '<div class="field"><label class="field__label" for="tv-carrier">Transportadora</label><select class="select" id="tv-carrier" data-change="tv-env" data-k="carrier">' +
            ['Correios', 'Jadlog', 'Loggi', 'Outra'].map((c) => '<option' + (F.carrier === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
          '<div class="field"><label class="field__label" for="tv-code">Código de rastreio' + (ids.length > 1 ? ' (o mesmo para todos)' : '') + '</label><input class="input mono" id="tv-code" autocomplete="off" value="' + U.esc(F.code) + '" data-input="tv-env" data-k="code" placeholder="Ex.: QB123456789BR"' +
            (bad ? ' aria-invalid="true" aria-describedby="tv-code-err"' : '') + ' data-autofocus>' +
            (bad ? '<p class="field__error" id="tv-code-err" role="alert">' + U.icon('alert') + 'Informe o código completo (pelo menos 8 caracteres).</p>' : '<span class="field__hint">O comprador recebe o código e a previsão de entrega.</span>') + '</div>' +
          '<div class="field"><label class="field__label" for="tv-date">Data de postagem</label><input class="input mono" id="tv-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Cancelar</button><button type="button" class="btn btn--primary" data-action="tv-env-ok">Confirmar envio</button></div>';
      }
    });
    BV.inputs['tv-env'] = (el) => { F[el.dataset.k] = el.value; };
    BV.actions['tv-env-ok'] = () => {
      if (F.code.trim().length < 8) { F.tried = true; dlg.render(); U.$('#tv-code').focus(); return; }
      T.items.forEach((i) => { if (ids.indexOf(i.id) >= 0 && i.st === 'aguard') { i.st = 'env'; i.sub = F.code.trim().toUpperCase() + ' · ' + F.carrier + ' · previsão 05/12'; } });
      T.sel = {};
      dlg.close();
      TV.render();
      U.toast(ids.length > 1 ? ids.length + ' envios registrados. Os compradores foram avisados.' : 'Envio registrado. O comprador foi avisado.');
      const h = U.$('#page-h'); if (h) h.focus();
    };
  }
  BV.actions['tv-envio'] = (btn) => openEnvio([Number(btn.dataset.id)]);
  BV.actions['tv-envio-sel'] = () => {
    const ids = visible().filter((i) => T.sel[i.id] && i.st === 'aguard').map((i) => i.id);
    if (!ids.length) { U.toast('Selecione compradores com envio pendente.', 'warn'); return; }
    openEnvio(ids);
  };

  /* Endereço com proteção de dados */
  BV.actions['tv-end'] = (btn) => {
    const it = T.items.find((i) => i.id === Number(btn.dataset.id));
    let shown = false;
    const dlg = U.dialog({
      variant: 'drawer',
      render: () => U.dlgHead('Endereço de entrega', U.esc(it.nome)) +
        '<div class="dialog__body"><div class="alert alert--info">' + U.icon('shield') + '<span>Use estes dados só para o envio. O acesso fica registrado (LGPD).</span></div>' +
        '<div class="box"><strong>' + U.esc(it.nome) + '</strong><p style="margin-top:6px;font-size:15px">' + (shown ? U.esc(it.end).replace(/ · /g, '<br>') : U.esc(it.end.split(' · ')[0].replace(/\d+/, '•••')) + '<br>••• · ' + U.esc(it.end.split(' · ').slice(-2).join(' · ').replace(/\d{3}$/, '•••'))) + '</p></div>' +
        (shown ? '' : '<button type="button" class="btn btn--secondary" data-action="tv-end-show" data-autofocus>' + U.icon('eye') + 'Mostrar endereço completo</button>') +
        '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Fechar</button>' + (shown ? '<button type="button" class="btn btn--primary" data-action="tv-end-copy">' + U.icon('copy') + 'Copiar endereço</button>' : '') + '</div>'
    });
    BV.actions['tv-end-show'] = () => { shown = true; dlg.render(); U.announce('Endereço completo exibido. O acesso foi registrado.'); };
    BV.actions['tv-end-copy'] = () => { U.copy(it.nome + '\n' + it.end.replace(/ · /g, '\n')); U.toast('Endereço copiado.', 'info'); };
  };

  /* Caso aberto pelo comprador */
  BV.actions['tv-caso'] = (btn) => {
    const it = T.items.find((i) => i.id === Number(btn.dataset.id));
    const F = { txt: '', tried: false };
    const dlg = U.dialog({
      variant: 'drawer',
      render: () => {
        const bad = F.tried && F.txt.trim().length < 20;
        return U.dlgHead('Caso: Não recebi', U.esc(it.nome) + ' · aberto em 05/12') +
          '<div class="dialog__body"><div class="box"><p style="font-size:14px">"O rastreio parou em 02/12 e o produto não chegou."</p><p class="field__hint" style="margin-top:6px">Mensagem do comprador · ' + U.esc(it.ps) + '</p></div>' +
          '<p style="font-size:14px;color:var(--text-2)">Responda em até 3 dias úteis. Sem resposta, o comprador recebe o estorno integral e o caso conta contra o seu score.</p>' +
          '<div class="field"><label class="field__label" for="tv-caso-txt">Sua resposta</label><textarea class="textarea" id="tv-caso-txt" data-input="tv-caso-txt" data-autofocus' + (bad ? ' aria-invalid="true" aria-describedby="tv-caso-err"' : '') + '>' + U.esc(F.txt) + '</textarea>' +
          (bad ? '<p class="field__error" id="tv-caso-err" role="alert">' + U.icon('alert') + 'Explique o que aconteceu (pelo menos 20 caracteres).</p>' : '<span class="field__hint">Anexe o comprovante de postagem, se tiver.</span>') + '</div>' +
          '<button type="button" class="btn btn--secondary" data-action="tv-caso-anexo">' + U.icon('upload') + 'Anexar comprovante</button></div>' +
          '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Fechar</button><button type="button" class="btn btn--primary" data-action="tv-caso-ok">Enviar resposta</button></div>';
      }
    });
    BV.inputs['tv-caso-txt'] = (el) => { F.txt = el.value; };
    BV.actions['tv-caso-anexo'] = () => U.toast('Comprovante anexado: postagem-correios.pdf', 'info');
    BV.actions['tv-caso-ok'] = () => {
      if (F.txt.trim().length < 20) { F.tried = true; dlg.render(); U.$('#tv-caso-txt').focus(); return; }
      it.sub = 'Resposta enviada · aguardando o comprador';
      dlg.close(); TV.render(); U.toast('Resposta enviada. A mediação acompanha o caso.');
    };
  };

  /* Envio em lote (CSV) */
  BV.actions['tv-csv'] = () => {
    const F = { step: 'pick', file: '' };
    const dlg = U.dialog({
      render: () => {
        if (F.step === 'proc') return U.dlgHead('Envio em lote (CSV)') + '<div class="dialog__body" role="status" style="align-items:center;padding:36px">' + U.icon('loader', 'spinner') + '<p>Processando ' + U.esc(F.file) + '…</p></div>';
        if (F.step === 'done') {
          const err = F.file.indexOf('erro') >= 0;
          return U.dlgHead('Envio em lote (CSV)') + '<div class="dialog__body">' +
            '<div class="alert alert--ok" role="status">' + U.icon('checkCircle') + '<span>' + F.done + ' envios registrados. Os compradores foram avisados.</span></div>' +
            (err ? '<div class="alert alert--danger">' + U.icon('alert') + '<span>1 linha com erro: linha 5 — código de rastreio vazio. Corrija e envie de novo só essa linha.</span></div>' : '') +
            '</div><div class="dialog__foot"><button type="button" class="btn btn--primary" data-action="dialog-close" data-autofocus>Concluir</button></div>';
        }
        return U.dlgHead('Envio em lote (CSV)') + '<div class="dialog__body">' +
          '<p style="font-size:14px;color:var(--text-2)">Uma linha por comprador: apelido, transportadora e código de rastreio. Até 500 linhas.</p>' +
          '<a href="#" data-action="tv-csv-model">' + U.icon('receipt') + ' Baixar modelo (.csv)</a>' +
          '<div class="field"><label class="field__label" for="tv-csv-file">Arquivo CSV</label><input class="input" id="tv-csv-file" type="file" accept=".csv,text/csv" data-change="tv-csv-file" style="padding-top:10px"></div>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="tv-csv-sample">Usar arquivo de exemplo</button><button type="button" class="btn btn--primary" data-action="tv-csv-go"' + (F.file ? '' : ' disabled') + '>Processar arquivo</button></div>';
      }
    });
    const go = () => {
      F.step = 'proc'; dlg.render();
      setTimeout(() => {
        let n = 0;
        T.items.forEach((i) => { if (i.st === 'aguard') { i.st = 'env'; i.sub = 'QB' + (100000000 + i.id * 7654321).toString().slice(0, 9) + 'BR · Correios · previsão 06/12'; n++; } });
        F.done = n; F.step = 'done'; dlg.render(); TV.render();
      }, 1200);
    };
    BV.inputs['tv-csv-file'] = (el) => { F.file = el.files && el.files[0] ? el.files[0].name : ''; dlg.render(); };
    BV.actions['tv-csv-sample'] = () => { F.file = 'envios-lote-novembro-com-erro.csv'; go(); };
    BV.actions['tv-csv-go'] = go;
    BV.actions['tv-csv-model'] = (a, e) => { e.preventDefault(); U.toast('Modelo: apelido;transportadora;codigo_rastreio', 'info'); };
  };

  BV.actions['tv-tab'] = (btn) => { T.tab = btn.dataset.tab; T.sel = {}; TV.render(); U.$('#tv-tab-' + T.tab).focus(); };
  BV.inputs['tv-q'] = (el) => { T.q = el.value; TV.render(); };
  BV.inputs['tv-sel'] = (el) => { T.sel[el.dataset.id] = el.checked; TV.render(); };
  BV.inputs['tv-all'] = (el) => { visible().forEach((i) => { T.sel[i.id] = el.checked; }); TV.render(); };
  BV.actions['tv-page'] = () => U.toast('Protótipo: só a página 1 tem dados.', 'info');
  BV.actions['noop-nav'] = () => {};
  document.addEventListener('keydown', (e) => {
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End')) return;
    const all = U.$$('[role="tab"]', tab.parentElement), i = all.indexOf(tab);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowLeft' ? -1 : 1) + all.length) % all.length;
    e.preventDefault(); all[n].click();
  });
})();
