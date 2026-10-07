/* Bolha Venda — lista alternativa ao canvas (T02). Não reordena sob o foco do usuário. */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const L = (BV.lista = {});
  let root;

  const SORTS = [
    { id: 'time', label: 'Termina antes', fn: (a, b) => rank(a) - rank(b) || a.endsAt - b.endsAt },
    { id: 'price', label: 'Menor preço', fn: (a, b) => rank(a) - rank(b) || D.priceForFilter(a) - D.priceForFilter(b) },
    { id: 'meta', label: 'Mais perto da meta', fn: (a, b) => rank(a) - rank(b) || b.q / b.meta - a.q / a.meta }
  ];
  function rank(bb) { return bb.status === 'ACTIVE' ? 0 : 1; }

  L.isShown = () => root && !root.hidden;
  L.show = () => { root = root || U.$('#list-view'); root.hidden = false; L.reorder(); L.render(); };
  L.hide = () => { root = root || U.$('#list-view'); root.hidden = true; };
  L.reorder = () => {
    const sort = SORTS.find((s) => s.id === S.sort) || SORTS[0];
    S.listOrder = S.bubbles.slice().sort(sort.fn).map((b) => b.id);
    S.listChanged.clear();
  };
  L.noteChange = (id) => { if (L.isShown()) { S.listChanged.add(id); L.render(); } };

  function card(bb) {
    const active = bb.status === 'ACTIVE', isSale = bb.type === 'SALE';
    const pct = Math.round((bb.q / bb.max) * 100), metaPct = ((bb.meta / bb.max) * 100).toFixed(1);
    const grad = !active ? '#64748B' : isSale ? 'linear-gradient(90deg,#3B82F6,#8B5CF6)' : 'linear-gradient(90deg,#10B981,#06B6D4)';
    const tags = [
      !active ? '<span class="pill pill--closed">' + U.icon('checkCircle') + 'ENCERRADA</span>' : isSale ? '<span class="pill pill--sale">' + U.icon('tag') + 'VENDA</span>' : '<span class="pill pill--buy">' + U.icon('cart') + 'COMPRA</span>',
      D.isNear(bb) ? '<span class="pill pill--amber">' + U.icon('ringNear') + 'Quase cheia</span>' : '',
      D.isExp(bb) ? '<span class="pill pill--danger">' + U.icon('clock') + 'Expirando</span>' : '',
      D.mine(bb) && active ? '<span class="pill pill--info">' + U.icon('check') + 'Você participa</span>' : '',
      S.listChanged.has(bb.id) ? '<span class="pill pill--muted pill--upd">atualizado</span>' : ''
    ].join('');
    const price = !active ? (bb.status === 'CLOSED_OK' ? U.brl(bb.finalPrice) : '—') : isSale ? U.brl(D.price(bb)) : 'até ' + U.brl(bb.alvo);
    return '<li><article class="l-card' + (S.selectedId === bb.id ? ' is-sel' : '') + '" aria-labelledby="lt-' + bb.id + '">' +
      '<div class="l-card__tags">' + tags + '</div>' +
      '<h2 id="lt-' + bb.id + '">' + U.esc(bb.title) + '</h2>' +
      '<div class="l-card__price">' + price + ' <small>' + (active ? 'por cota' : 'preço final') + '</small></div>' +
      '<div class="l-card__next" style="color:' + (!active ? 'var(--text-2)' : isSale ? 'var(--sale-text)' : 'var(--buy-text)') + '">' + U.esc(D.nextText(bb)) + '</div>' +
      '<div class="l-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + bb.max + '" aria-valuenow="' + bb.q + '" aria-valuetext="' + bb.q + ' de ' + bb.max + ' cotas, meta ' + bb.meta + '">' +
        '<span style="width:' + pct + '%;background:' + grad + '"></span><span class="meta" style="left:calc(' + metaPct + '% - 1px)" aria-hidden="true"></span></div>' +
      '<div class="l-card__prog"><span>' + bb.q + ' de ' + bb.max + ' cotas (meta ' + bb.meta + ')</span>' +
        '<span class="mono' + (D.isExp(bb) ? ' time-exp' : '') + '">' + (active ? '<span class="sr-only">Termina em </span><span data-ltime="' + bb.id + '">' + U.left(D.left(bb)) + '</span>' : 'encerrada') + '</span></div>' +
      '<div class="l-card__foot"><span>' + U.esc(bb.creator) + ' · Score ' + D.band(bb.creatorScore) + '</span>' +
        '<button type="button" class="btn btn--secondary btn--sm" id="lcard-' + bb.id + '" data-action="open-bubble" data-id="' + bb.id + '" aria-describedby="lt-' + bb.id + '">Ver bolha</button></div>' +
      '</article></li>';
  }

  L.render = () => {
    root = root || U.$('#list-view');
    if (root.hidden) return;
    if (!S.listOrder) L.reorder();
    const vis = S.bubbles.filter(D.visible);
    const order = S.listOrder.concat(vis.map((b) => b.id).filter((id) => S.listOrder.indexOf(id) < 0));
    const items = order.map(D.find).filter((b) => b && D.visible(b));
    const loading = S.canvasState === 'carregando', empty = S.canvasState === 'vazio' || items.length === 0;
    const n = S.listChanged.size;
    let body;
    if (loading) body = '<ul class="list-grid" aria-busy="true">' + Array.from({ length: 6 }, () => '<li class="skel-card" aria-hidden="true"></li>').join('') + '</ul><p class="sr-only" role="status">Carregando bolhas…</p>';
    else if (empty) body = '<div class="map-empty__card" style="margin:24px auto"><div class="map-empty__art" aria-hidden="true">' + U.icon('sparkles') + '</div><h2>Nenhuma bolha nesta área.</h2><p>Afaste o zoom ou limpe os filtros.</p>' +
      '<div class="map-empty__actions"><button type="button" class="btn btn--secondary" data-action="clear-filters">Limpar filtros</button><a class="btn btn--primary" href="#/criar">' + U.icon('plus') + 'Criar bolha</a></div></div>';
    else body = '<ul class="list-grid">' + items.map(card).join('') + '</ul>';
    U.rerender(root,
      '<div class="list-wrap">' +
      '<div class="list-head"><div><h1 id="list-title">' + (loading ? 'Carregando bolhas…' : items.length + (items.length === 1 ? ' bolha nesta área' : ' bolhas nesta área')) + '</h1>' +
        '<p>Mesmas bolhas da área visível do mapa, atualizadas ao vivo.</p></div>' +
        '<div class="segmented" role="radiogroup" aria-label="Ordenar por">' + SORTS.map((s) =>
          '<button type="button" role="radio" id="sort-' + s.id + '" aria-checked="' + (S.sort === s.id) + '" data-action="list-sort" data-sort="' + s.id + '">' + s.label + '</button>').join('') + '</div></div>' +
      (n && !loading ? '<div class="list-update" role="status"><span style="display:flex;gap:10px;align-items:center">' + U.icon('loader') + 'Algumas bolhas mudaram. A ordem não muda sozinha para você não perder o lugar.</span>' +
        '<button type="button" class="btn btn--primary btn--sm" id="list-reorder" data-action="list-reorder">Atualizar ordem (' + n + (n === 1 ? ' mudança' : ' mudanças') + ')</button></div>' : '') +
      body + '</div>');
  };

  L.tick = () => {
    if (!L.isShown()) return;
    U.$$('[data-ltime]', root).forEach((el) => {
      const bb = D.find(el.dataset.ltime);
      if (bb && bb.status === 'ACTIVE') { const t = U.left(D.left(bb)); if (el.textContent !== t) el.textContent = t; }
    });
  };

  BV.actions['list-sort'] = (btn) => { S.sort = btn.dataset.sort; L.reorder(); L.render(); U.announce('Ordenado por ' + btn.textContent.toLowerCase() + '.'); };
  BV.actions['list-reorder'] = () => { L.reorder(); L.render(); const h = U.$('#list-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } U.announce('Ordem atualizada.'); };
  /* Setas entre as opções de ordenação (padrão de radiogroup) */
  document.addEventListener('keydown', (e) => {
    const r = e.target.closest && e.target.closest('[role="radiogroup"]');
    if (!r || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0 || e.target.closest('#map')) return;
    const opts = U.$$('[role="radio"]', r), i = opts.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    const n = opts[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + opts.length) % opts.length];
    n.click(); const again = document.getElementById(n.id); if (again) again.focus();
  });
})();
