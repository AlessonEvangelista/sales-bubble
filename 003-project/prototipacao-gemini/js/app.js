/* Bolha Venda — app: roteador, header, navegação, filtros, moderador e tempo real. */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const A = (BV.app = {});
  let route = { name: 'mapa' }, firstRoute = true, filterAnnounce = 0;

  /* ---------- Delegação de eventos ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    const fn = BV.actions[t.dataset.action];
    if (fn) fn(t, e);
  });
  const onField = (e) => {
    const t = e.target;
    const name = e.type === 'input' ? t.dataset && t.dataset.input : t.dataset && t.dataset.change;
    if (name && BV.inputs[name]) BV.inputs[name](t, e);
  };
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-submit]');
    if (!f) return;
    e.preventDefault();
    const fn = BV.submits && BV.submits[f.dataset.submit];
    if (fn) fn(f, e);
  });

  /* ---------- Roteador (hash, funciona via file://) ---------- */
  const ROUTES = {
    '/': { name: 'mapa', title: 'Mapa de bolhas', explore: 'canvas', header: 'explore', nav: 'explorar' },
    '/lista': { name: 'lista', title: 'Lista de bolhas', explore: 'list', header: 'explore', nav: 'explorar' },
    '/criar': { name: 'criar', title: 'Criar bolha', page: () => BV.criar.render(), header: 'focus', nav: 'criar' },
    '/cadastro': { name: 'cadastro', title: 'Criar conta', page: () => BV.cadastro.render(), header: 'none', nav: '' },
    '/minhas-bolhas': { name: 'minhas-bolhas', title: 'Triagem do vendedor', page: () => BV.triagemVendedor.render(), header: 'app', nav: 'minhas' },
    '/minhas-cotas': { name: 'minhas-cotas', title: 'Minhas cotas', page: () => BV.triagemComprador.render(), header: 'app', nav: 'minhas' },
    '/score': { name: 'score', title: 'Meu score', page: () => BV.score.render(), header: 'app', nav: 'conta' },
    '/tokens': { name: 'tokens', title: 'Tokens e componentes', page: () => BV.tokens.render(), header: 'app', nav: '' }
  };
  function onRoute() {
    const h = location.hash.replace(/^#/, '') || '/';
    if (h.indexOf('/') !== 0) return;               // âncoras internas
    U.closePopover();
    U.closeAllDialogs();
    let r = ROUTES[h], openId = null;
    const m = h.match(/^\/b\/([\w-]+)$/);
    if (m) { r = ROUTES['/']; openId = m[1]; }
    if (!r) r = ROUTES['/'];
    route = r;
    document.title = r.title + ' — Bolha Venda';
    renderHeader();
    renderBottomNav();
    const explore = U.$('#view-explore'), page = U.$('#view-page');
    if (r.explore) {
      page.hidden = true; page.innerHTML = '';
      explore.hidden = false;
      U.$('#map').hidden = r.explore !== 'canvas';
      if (r.explore === 'list') BV.lista.show(); else BV.lista.hide();
      if (r.explore === 'canvas') { BV.canvas.render(); }
      if (S.selectedId && D.find(S.selectedId)) BV.detail.render();
      if (openId && D.find(openId)) setTimeout(() => BV.detail.open(openId), 30);
      if (!firstRoute && !openId) {
        const t = r.explore === 'list' ? U.$('#list-title') : U.$('#map-title');
        if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
      }
    } else {
      explore.hidden = true;
      page.hidden = false;
      page.scrollTop = 0;
      r.page();
      if (!firstRoute) { const t = U.$('#page-h'); if (t) t.focus({ preventScroll: true }); }
    }
    document.body.classList.toggle('detail-open', !!r.explore && BV.detail.isOpen());
    firstRoute = false;
  }
  window.addEventListener('hashchange', onRoute);
  BV.actions['skip-main'] = (a, e) => {
    e.preventDefault();
    const t = U.$('#page-h') || (route.explore === 'list' ? U.$('#list-title') : U.$('#map-title'));
    const target = t && t.offsetParent !== null ? t : U.$('#conteudo');
    target.setAttribute('tabindex', '-1');
    target.focus();
  };

  /* ---------- Header ---------- */
  function avatarBtn() {
    const p = D.persona();
    return '<div class="pop-anchor hide-mobile"><button type="button" class="avatar-btn" id="account-btn" data-action="open-account" aria-haspopup="menu" aria-expanded="false" aria-label="Conta de ' + U.esc(p.name) + '">' +
      '<span class="avatar" aria-hidden="true">' + p.initials + '</span><span class="hide-1600">' + U.esc(p.first) + '</span>' + U.icon('down') + '</button></div>';
  }
  function bellBtn(cls) {
    const n = S.notifications.filter((x) => x.unread).length;
    return '<button type="button" class="icon-btn ' + (cls || '') + '" data-action="open-notifs" aria-label="Notificações' + (n ? ', ' + n + ' não lidas' : '') + '">' + U.icon('bell') +
      (n ? '<span class="badge" aria-hidden="true">' + n + '</span>' : '') + '</button>';
  }
  function chipsHTML() {
    const f = S.filters, nCat = f.cats.length;
    const pr = BV.PRICE_RANGES.find((r) => r.id === f.price);
    return '<button type="button" class="chip" id="f-sale" aria-pressed="' + f.sale + '" data-action="f-toggle" data-k="sale">' + U.icon('tag') + 'Venda</button>' +
      '<button type="button" class="chip" id="f-buy" aria-pressed="' + f.buy + '" data-action="f-toggle" data-k="buy">' + U.icon('cart') + 'Compra</button>' +
      '<div class="pop-anchor"><button type="button" class="chip' + (nCat ? ' is-on' : '') + '" id="f-cat" aria-haspopup="true" aria-expanded="false" data-action="f-cat">Categoria' + (nCat ? '<span class="chip__count">' + nCat + '</span>' : '') + U.icon('down') + '</button></div>' +
      '<div class="pop-anchor"><button type="button" class="chip' + (f.price !== 'any' ? ' is-on' : '') + '" id="f-price" aria-haspopup="true" aria-expanded="false" data-action="f-price">' + (f.price !== 'any' ? U.esc(pr.label) : 'Faixa de preço') + U.icon('down') + '</button></div>' +
      '<button type="button" class="chip" id="f-mine" aria-pressed="' + f.mine + '" data-action="f-toggle" data-k="mine">Só as que participo</button>';
  }
  function renderHeader() {
    const bar = U.$('#topbar');
    const brand = '<a class="brand" href="#/"><span class="brand__logo" aria-hidden="true"></span><span>Bolha Venda</span></a>';
    if (route.header === 'none') { bar.hidden = true; return; }
    bar.hidden = false;
    if (route.header === 'focus') {
      bar.innerHTML = brand + '<div class="topbar__spacer"></div><a href="#/" class="topbar__link">Sair e continuar depois</a>';
      return;
    }
    if (route.header === 'app') {
      const nav = [['#/minhas-bolhas', 'Minhas bolhas', 'minhas-bolhas'], ['#/minhas-cotas', 'Minhas cotas', 'minhas-cotas'], ['#/score', 'Meu score', 'score']];
      bar.innerHTML = brand + '<nav class="topbar__nav" aria-label="Minha conta">' + nav.map((n) => '<a href="' + n[0] + '"' + (route.name === n[2] ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('') + '</nav>' +
        '<div class="topbar__spacer"></div><a class="btn btn--secondary hide-mobile" href="#/">' + U.icon('map') + 'Explorar</a>' + bellBtn('hide-mobile') + avatarBtn();
      return;
    }
    const nAct = D.filtersActive(), isList = route.explore === 'list';
    bar.innerHTML = brand +
      '<div class="topbar__search" role="search"><label for="search" class="sr-only">Buscar bolhas</label>' + U.icon('search') +
        '<input id="search" type="search" autocomplete="off" placeholder="Buscar bolhas…" value="' + U.esc(S.filters.q) + '" data-input="search" aria-keyshortcuts="/"><kbd aria-hidden="true">/</kbd></div>' +
      '<div class="topbar__filters topbar__filters--inline" role="group" aria-label="Filtros" id="chips">' + chipsHTML() + '</div>' +
      '<button type="button" class="chip only-compact hide-mobile" id="f-compact" data-action="open-filters">' + U.icon('filter') + 'Filtros' + (nAct ? '<span class="chip__count">' + nAct + '</span>' : '') + '</button>' +
      '<div class="topbar__spacer"></div>' +
      '<nav class="segmented hide-mobile" aria-label="Modo de visualização"><a href="#/"' + (!isList ? ' aria-current="page"' : '') + '>' + U.icon('map') + 'Canvas</a><a href="#/lista"' + (isList ? ' aria-current="page"' : '') + '>' + U.icon('list') + 'Lista</a></nav>' +
      '<a class="btn btn--primary hide-mobile hide-1600" href="#/criar">' + U.icon('plus') + 'Criar bolha</a>' +
      bellBtn('hide-mobile') + avatarBtn() +
      '<button type="button" class="icon-btn only-mobile" data-action="open-search" aria-label="Buscar bolhas">' + U.icon('search') + '</button>' +
      '<button type="button" class="icon-btn only-mobile" id="f-mobile" data-action="open-filters" aria-label="Filtros' + (nAct ? ', ' + nAct + ' ativos' : '') + '">' + U.icon('filter') + (nAct ? '<span class="dot" aria-hidden="true"></span>' : '') + '</button>' +
      '<a class="icon-btn only-mobile" href="' + (isList ? '#/' : '#/lista') + '" aria-label="' + (isList ? 'Ver no mapa' : 'Ver em lista') + '">' + U.icon(isList ? 'map' : 'list') + '</a>';
  }
  A.renderHeader = renderHeader;
  function updateChips() {
    const chips = U.$('#chips');
    if (chips && !(U.popoverOpen() && chips.contains(U.popoverOpen().btn))) chips.innerHTML = chipsHTML();
    else if (chips) {
      const f = S.filters;
      ['sale', 'buy', 'mine'].forEach((k) => { const c = U.$('#f-' + k); if (c) c.setAttribute('aria-pressed', f[k]); });
    }
    const n = D.filtersActive();
    const comp = U.$('#f-compact');
    if (comp) comp.innerHTML = U.icon('filter') + 'Filtros' + (n ? '<span class="chip__count">' + n + '</span>' : '');
    const mob = U.$('#f-mobile');
    if (mob) { mob.innerHTML = U.icon('filter') + (n ? '<span class="dot" aria-hidden="true"></span>' : ''); mob.setAttribute('aria-label', 'Filtros' + (n ? ', ' + n + ' ativos' : '')); }
  }

  /* ---------- Filtros ---------- */
  A.applyFilters = (silent) => {
    if (BV.lista.isShown()) BV.lista.reorder();
    BV.canvas.render();
    BV.lista.render();
    updateChips();
    if (!silent) {
      clearTimeout(filterAnnounce);
      filterAnnounce = setTimeout(() => {
        const n = S.bubbles.filter(D.visible).length;
        U.announce(n ? n + (n === 1 ? ' bolha encontrada.' : ' bolhas encontradas.') : 'Nenhuma bolha com esses filtros.');
      }, 500);
    }
  };
  let searchT = 0;
  BV.inputs.search = (el) => { S.filters.q = el.value; clearTimeout(searchT); searchT = setTimeout(() => A.applyFilters(), 180); const m = U.$('#search-m'); if (m && m !== el) m.value = el.value; };
  BV.actions['f-toggle'] = (btn) => { const k = btn.dataset.k; S.filters[k] = !S.filters[k]; btn.setAttribute('aria-pressed', S.filters[k]); A.applyFilters(); };
  BV.actions['clear-filters'] = () => {
    Object.assign(S.filters, { sale: true, buy: true, cats: [], price: 'any', mine: false, q: '' });
    const s = U.$('#search'); if (s) s.value = '';
    A.applyFilters();
    renderHeader();
  };
  function catList(prefix) {
    return BV.CATEGORIES.map((c, i) => '<label class="check"><input type="checkbox" id="' + prefix + i + '" data-change="f-cat" value="' + c + '"' + (S.filters.cats.indexOf(c) >= 0 ? ' checked' : '') + '><span>' + c + '</span></label>').join('');
  }
  function priceList(name) {
    return BV.PRICE_RANGES.map((r) => '<label class="check"><input type="radio" name="' + name + '" data-change="f-price" value="' + r.id + '"' + (S.filters.price === r.id ? ' checked' : '') + '><span>' + r.label + '</span></label>').join('');
  }
  BV.actions['f-cat'] = (btn) => U.togglePopover(btn, '<div role="group" aria-label="Categorias"><div class="popover__title">Categorias</div>' + catList('fc-') +
    '<div class="menu-sep"></div><button type="button" class="menu-item" data-action="f-cat-clear">Limpar categorias</button></div>');
  BV.actions['f-price'] = (btn) => U.togglePopover(btn, '<fieldset class="fieldset" style="padding:0"><legend class="popover__title">Faixa de preço por cota</legend>' + priceList('fp-pop') + '</fieldset>');
  BV.inputs['f-cat'] = (el) => {
    const c = el.value, cats = S.filters.cats;
    if (el.checked && cats.indexOf(c) < 0) cats.push(c);
    if (!el.checked) S.filters.cats = cats.filter((x) => x !== c);
    A.applyFilters();
    const b = U.$('#f-cat');
    if (b) { const n = S.filters.cats.length; b.classList.toggle('is-on', !!n); b.innerHTML = 'Categoria' + (n ? '<span class="chip__count">' + n + '</span>' : '') + U.icon('down'); }
  };
  BV.inputs['f-price'] = (el) => {
    S.filters.price = el.value;
    A.applyFilters();
    const b = U.$('#f-price'), pr = BV.PRICE_RANGES.find((r) => r.id === el.value);
    if (b) { b.classList.toggle('is-on', el.value !== 'any'); b.innerHTML = (el.value !== 'any' ? U.esc(pr.label) : 'Faixa de preço') + U.icon('down'); }
  };
  BV.actions['f-cat-clear'] = () => { S.filters.cats = []; U.closePopover(true); A.applyFilters(); updateChips(); renderHeader(); };
  BV.actions['open-filters'] = () => {
    const dlg = U.dialog({
      variant: U.isMobile() ? '' : 'panel',
      render: () => {
        const n = S.bubbles.filter(D.visible).length, f = S.filters;
        return U.dlgHead('Filtros') + '<div class="dialog__body">' +
          '<fieldset class="fieldset"><legend class="field__label">Tipo</legend><div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="chip" id="fd-sale" aria-pressed="' + f.sale + '" data-action="fd-toggle" data-k="sale">' + U.icon('tag') + 'Venda</button>' +
            '<button type="button" class="chip" id="fd-buy" aria-pressed="' + f.buy + '" data-action="fd-toggle" data-k="buy">' + U.icon('cart') + 'Compra</button>' +
            '<button type="button" class="chip" id="fd-mine" aria-pressed="' + f.mine + '" data-action="fd-toggle" data-k="mine">Só as que participo</button></div></fieldset>' +
          '<fieldset class="fieldset"><legend class="field__label">Categoria</legend><div class="check-grid">' + catList('fd-c') + '</div></fieldset>' +
          '<fieldset class="fieldset"><legend class="field__label">Faixa de preço por cota</legend><div class="stack-8">' + priceList('fp-dlg') + '</div></fieldset>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="fd-clear">Limpar</button><button type="button" class="btn btn--primary" data-action="dialog-close">Ver ' + n + (n === 1 ? ' bolha' : ' bolhas') + '</button></div>';
      }
    });
    BV.actions['fd-toggle'] = (btn) => { S.filters[btn.dataset.k] = !S.filters[btn.dataset.k]; A.applyFilters(); dlg.render(); };
    BV.actions['fd-clear'] = () => { Object.assign(S.filters, { sale: true, buy: true, cats: [], price: 'any', mine: false }); A.applyFilters(); dlg.render(); };
    const prevCat = BV.inputs['f-cat'], prevPrice = BV.inputs['f-price'];
    BV.inputs['f-cat'] = (el) => { prevCat(el); dlg.render(); };
    BV.inputs['f-price'] = (el) => { prevPrice(el); dlg.render(); };
    const origClose = dlg.close;
    dlg.close = (r) => { BV.inputs['f-cat'] = prevCat; BV.inputs['f-price'] = prevPrice; renderHeader(); origClose(r); };
  };
  BV.actions['open-search'] = () => {
    U.dialog({
      cls: 'dialog--full',
      render: () => U.dlgHead('Buscar bolhas') + '<div class="dialog__body"><div class="searchbox" role="search" style="max-width:none"><label for="search-m" class="sr-only">Buscar bolhas</label>' + U.icon('search') +
        '<input id="search-m" type="search" autocomplete="off" placeholder="Produto, categoria ou apelido" value="' + U.esc(S.filters.q) + '" data-input="search" data-autofocus></div>' +
        '<p class="field__hint">Ex.: fone, café, cadeiras.</p></div><div class="dialog__foot"><button type="button" class="btn btn--primary btn--block" data-action="dialog-close">Ver resultados</button></div>'
    });
  };

  /* ---------- Conta, notificações ---------- */
  function accountMenu() {
    const p = D.persona();
    return '<div role="menu" aria-label="Conta">' +
      (p.kind !== 'GUEST' ? '<div class="acct"><span class="avatar avatar--lg" aria-hidden="true">' + p.initials + '</span><div><strong>' + U.esc(p.name) + '</strong><div class="field__hint">' + U.esc(p.pseudo) + ' · Score ' + p.score + ' (' + p.band + ')</div></div></div><div class="menu-sep"></div>' : '') +
      '<a role="menuitem" class="menu-item" href="#/score">' + U.icon('gauge') + 'Meu score</a>' +
      '<a role="menuitem" class="menu-item" href="#/minhas-bolhas">' + U.icon('box') + 'Minhas bolhas (triagem de envios)</a>' +
      '<a role="menuitem" class="menu-item" href="#/minhas-cotas">' + U.icon('receipt') + 'Minhas cotas</a>' +
      '<a role="menuitem" class="menu-item" href="#/criar">' + U.icon('plus') + 'Criar bolha</a>' +
      '<div class="menu-sep"></div>' +
      '<button type="button" role="menuitemcheckbox" aria-checked="' + (S.theme === 'light') + '" class="menu-item" data-action="toggle-theme">' + U.icon('sun') + 'Tema claro' + (S.theme === 'light' ? ' (ligado)' : '') + '</button>' +
      '<button type="button" role="menuitemcheckbox" aria-checked="' + S.reducedMotion + '" class="menu-item" data-action="toggle-motion">' + U.icon('pause') + 'Reduzir animações' + (S.reducedMotion ? ' (ligado)' : '') + '</button>' +
      '<button type="button" role="menuitem" class="menu-item" data-action="open-help">' + U.icon('keyboard') + 'Atalhos de teclado</button>' +
      '<a role="menuitem" class="menu-item" href="#/tokens">' + U.icon('palette') + 'Tokens e componentes</a>' +
      '<button type="button" role="menuitem" class="menu-item" data-action="mod-open">' + U.icon('flask') + 'Painel do moderador (teste)</button>' +
      '<div class="menu-sep"></div>' +
      (p.kind === 'GUEST' ? '<a role="menuitem" class="menu-item" href="#/cadastro">' + U.icon('user') + 'Criar conta</a><button type="button" role="menuitem" class="menu-item" data-action="login-demo">' + U.icon('user') + 'Entrar como Carlos (demo)</button>'
        : '<button type="button" role="menuitem" class="menu-item" data-action="logout">' + U.icon('logout') + 'Sair</button>') + '</div>';
  }
  BV.actions['open-account'] = (btn) => {
    if (U.isMobile() || !btn.closest('.pop-anchor')) { U.dialog({ render: () => U.dlgHead('Conta') + '<div class="dialog__body">' + accountMenu() + '</div>' }); return; }
    U.togglePopover(btn, accountMenu(), 'popover--right popover--menu');
  };
  BV.actions.logout = () => { U.closePopover(); U.closeAllDialogs(); A.setPersona('guest'); };
  BV.actions['open-notifs'] = () => {
    const dlg = U.dialog({
      variant: U.isMobile() ? '' : 'panel',
      render: () => U.dlgHead('Notificações') + '<div class="dialog__body"><ul class="notifs">' + S.notifications.map((n) =>
        '<li class="notif' + (n.unread ? ' is-unread' : '') + '"><span class="notif__ic" aria-hidden="true">' + U.icon(n.icon) + '</span><div><p>' + U.esc(n.text) + '</p><span class="field__hint">' + n.when + (n.unread ? ' · não lida' : '') + '</span></div></li>').join('') + '</ul></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="notifs-read"' + (S.notifications.some((n) => n.unread) ? '' : ' disabled') + '>Marcar todas como lidas</button></div>'
    });
    BV.actions['notifs-read'] = () => { S.notifications.forEach((n) => { n.unread = false; }); dlg.render(); renderHeader(); renderBottomNav(); U.announce('Todas as notificações foram marcadas como lidas.'); };
  };

  /* ---------- Barra inferior (mobile) ---------- */
  function renderBottomNav() {
    const nav = U.$('#bottomnav');
    if (route.header === 'none') { nav.hidden = true; return; }
    nav.hidden = false;
    const n = S.notifications.filter((x) => x.unread).length, cur = (k) => (route.nav === k ? ' aria-current="page"' : '');
    nav.innerHTML =
      '<a href="#/"' + cur('explorar') + '>' + U.icon('compass') + 'Explorar</a>' +
      '<a href="#/minhas-cotas"' + cur('minhas') + '>' + U.icon('layers') + 'Minhas</a>' +
      '<a href="#/criar" class="bottomnav__create" aria-label="Criar bolha"' + cur('criar') + '>' + U.icon('plus') + '</a>' +
      '<button type="button" data-action="open-notifs" aria-label="Avisos' + (n ? ', ' + n + ' não lidos' : '') + '">' + U.icon('bell') + 'Avisos' + (n ? '<span class="badge" aria-hidden="true">' + n + '</span>' : '') + '</button>' +
      '<button type="button" data-action="open-account"' + cur('conta') + '>' + U.icon('user') + 'Conta</button>';
  }

  /* ---------- Persona, tema, movimento ---------- */
  A.setPersona = (id) => {
    S.persona = id;
    renderHeader(); renderBottomNav();
    BV.canvas.render(); BV.detail.render(); BV.lista.render();
    if (route.page) route.page();
    renderModerator();
    const p = D.persona();
    U.toast(p.kind === 'GUEST' ? 'Você saiu. Navegando como visitante.' : 'Agora você é ' + p.name + (p.kind === 'PJ' ? ' (empresa).' : ' (pessoa física).'), 'info');
  };
  A.applyTheme = () => {
    document.documentElement.setAttribute('data-theme', S.theme);
    U.$('meta[name="theme-color"]').setAttribute('content', S.theme === 'light' ? '#F8FAFC' : '#0B0F19');
    document.documentElement.classList.toggle('reduce-motion', S.reducedMotion);
    BV.canvas.layout(true);
  };
  BV.actions['toggle-theme'] = () => { S.theme = S.theme === 'light' ? 'dark' : 'light'; A.applyTheme(); U.closePopover(); renderModerator(); U.announce(S.theme === 'light' ? 'Tema claro ligado.' : 'Tema escuro ligado.'); };
  BV.actions['toggle-motion'] = () => { S.reducedMotion = !S.reducedMotion; A.applyTheme(); U.closePopover(); renderModerator(); U.announce(S.reducedMotion ? 'Animações reduzidas.' : 'Animações ligadas.'); };

  /* ---------- Explosão (estouro) ---------- */
  A.explode = (id) => {
    const bb = D.find(id);
    if (!bb || bb.status !== 'ACTIVE') return;
    BV.modals.closeJoinIfFor(id);
    const apply = () => {
      const ok = bb.q >= bb.meta;
      bb.status = ok ? 'CLOSED_OK' : 'CLOSED_FAIL';
      bb.finalPrice = ok ? (bb.type === 'SALE' ? D.tier(bb).price : (D.bestBid(bb) || { price: bb.alvo }).price) : null;
      bb.endsAt = Math.min(bb.endsAt, Date.now());
      BV.canvas.render(); BV.detail.render(); BV.lista.noteChange(id); renderModerator();
      const mine = D.mine(bb);
      let msg;
      if (!ok) msg = 'A bolha ' + bb.short + ' não atingiu a meta. Todo o valor reservado foi devolvido.';
      else if (mine && bb.type === 'SALE') msg = 'A bolha ' + bb.short + ' fechou a ' + U.brl(bb.finalPrice) + ' por cota. ' + U.brl(D.reserve(bb) - bb.finalPrice) + ' liberados.';
      else msg = 'A bolha ' + bb.short + ' estourou e fechou a ' + U.brl(bb.finalPrice) + ' por cota.';
      U.toast(msg, ok ? '' : 'warn');
    };
    if (route.explore === 'canvas') BV.canvas.pop(id, apply); else apply();
  };

  /* ---------- Tempo real ---------- */
  function tick() {
    BV.canvas.tick(); BV.detail.tick(); BV.lista.tick();
    S.bubbles.forEach((bb) => { if (bb.status === 'ACTIVE' && D.left(bb) <= 0) A.explode(bb.id); });
  }
  A.liveQuota = (id) => {
    const bb = D.find(id);
    if (!bb || bb.status !== 'ACTIVE' || bb.q + bb.reservedPix >= bb.max) return false;
    const old = bb.type === 'SALE' ? D.price(bb) : null;
    bb.q++;
    BV.canvas.refreshBubble(id);
    BV.canvas.ripple(id);
    BV.lista.noteChange(id);
    const open = S.selectedId === id, watch = open || D.mine(bb);
    if (open) BV.detail.render();
    if (bb.type === 'SALE' && D.price(bb) < old && watch) U.announce('Novo preço: ' + U.brl(D.price(bb)) + ' por cota em ' + bb.short + '.');
    else if (open) U.announce(bb.short + ': ' + bb.q + ' de ' + bb.max + ' cotas.' + (bb.type === 'SALE' ? ' Preço agora ' + U.brl(D.price(bb)) + '.' : ''), 'prog-' + id, 10000);
    return true;
  };
  function simulate() {
    if (!S.liveSim || S.canvasState !== 'pronto' || document.hidden) return;
    const cands = S.bubbles.filter((b) => b.status === 'ACTIVE' && b.q + b.reservedPix < b.max && b.id !== 'teclado');
    if (!cands.length) return;
    A.liveQuota(cands[Math.floor(Math.random() * cands.length)].id);
  }

  /* ---------- Painel do moderador (teste de usabilidade S0) ---------- */
  let modOpen = false;
  function seg(group, cur, opts, action) {
    return '<div class="segmented" role="radiogroup" aria-label="' + group + '">' + opts.map((o) =>
      '<button type="button" role="radio" aria-checked="' + (cur === o[0]) + '" data-action="' + action + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
  }
  function renderModerator() {
    const box = U.$('#moderator');
    const sel = S.selectedId && D.find(S.selectedId), canPop = sel && sel.status === 'ACTIVE';
    box.innerHTML = '<button type="button" class="mod-fab" data-action="mod-toggle" aria-expanded="' + modOpen + '" aria-controls="mod-panel">' + U.icon('flask') + '<span>Moderador</span></button>' +
      (modOpen ? '<section class="mod-panel" id="mod-panel" aria-labelledby="mod-h">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><h2 id="mod-h" tabindex="-1">' + U.icon('flask') + 'Painel do moderador</h2><p class="mod-sub">Controles do teste de usabilidade. Não fazem parte do produto.</p></div>' +
        '<button type="button" class="icon-btn" data-action="mod-toggle" aria-label="Fechar painel do moderador">' + U.icon('x') + '</button></div>' +
        '<div class="mod-group"><span>Persona</span>' + seg('Persona', S.persona, [['pf', 'Carlos (PF)'], ['pj', 'TecnoLotes (PJ)'], ['guest', 'Visitante']], 'mod-persona') + '</div>' +
        '<div class="mod-group"><span>Ao vivo' + (sel ? ' · ' + U.esc(sel.short) : '') + '</span><div class="mod-row">' +
          '<button type="button" class="btn btn--secondary btn--sm" data-action="mod-quota"' + (canPop ? '' : ' disabled') + '>' + U.icon('zap') + 'Cota entrando</button>' +
          '<button type="button" class="btn btn--danger btn--sm" data-action="mod-pop"' + (canPop ? '' : ' disabled') + '>' + U.icon('burst') + 'Estourar bolha</button></div>' +
          (sel ? '' : '<p class="mod-sub">Abra uma bolha no mapa para simular cotas e o estouro.</p>') +
          '<button type="button" class="btn btn--ghost btn--sm" data-action="mod-live" aria-pressed="' + S.liveSim + '">' + (S.liveSim ? U.icon('pause') + 'Pausar simulação automática' : U.icon('zap') + 'Retomar simulação automática') + '</button></div>' +
        '<div class="mod-group"><span>Pagamento ao entrar</span>' + seg('Cenário de pagamento', S.payScenario, [['normal', 'Normal'], ['esgotadas', 'Cotas esgotadas'], ['recusado', 'Cartão recusado'], ['pixoff', 'Pix indisponível']], 'mod-pay') + '</div>' +
        '<div class="mod-group"><span>Estado do mapa e da lista</span>' + seg('Estado do mapa', S.canvasState, [['pronto', 'Pronto'], ['carregando', 'Carregando'], ['vazio', 'Vazio'], ['offline', 'Offline']], 'mod-state') + '</div>' +
        '<div class="mod-group"><span>Aparência</span><div class="mod-row">' +
          '<button type="button" class="btn btn--secondary btn--sm" data-action="toggle-theme" aria-pressed="' + (S.theme === 'light') + '">' + U.icon('sun') + 'Tema claro</button>' +
          '<button type="button" class="btn btn--secondary btn--sm" data-action="toggle-motion" aria-pressed="' + S.reducedMotion + '">' + U.icon('pause') + 'Reduzir animações</button></div></div>' +
        '<div class="mod-group"><span>Telas</span><div class="mod-row">' +
          [['#/', 'Mapa'], ['#/lista', 'Lista'], ['#/criar', 'Criar'], ['#/cadastro', 'Cadastro'], ['#/minhas-bolhas', 'Triagem vendedor'], ['#/minhas-cotas', 'Triagem comprador'], ['#/score', 'Score'], ['#/tokens', 'Tokens']]
            .map((l) => '<a class="btn btn--secondary btn--sm" href="' + l[0] + '">' + l[1] + '</a>').join('') + '</div></div>' +
        '</section>' : '');
  }
  A.renderModerator = renderModerator;
  BV.actions['mod-open'] = () => { U.closePopover(); U.closeAllDialogs(); modOpen = true; renderModerator(); const t = U.$('#mod-h'); if (t) t.focus(); };
  BV.actions['mod-toggle'] = () => { modOpen = !modOpen; renderModerator(); const t = modOpen ? U.$('#mod-h') : U.$('.mod-fab'); if (t) t.focus(); };
  BV.actions['mod-persona'] = (b) => { A.setPersona(b.dataset.v); focusMod('mod-persona', b.dataset.v); };
  BV.actions['mod-pay'] = (b) => { S.payScenario = b.dataset.v; renderModerator(); focusMod('mod-pay', b.dataset.v); U.announce('Cenário de pagamento: ' + b.textContent + '.'); };
  BV.actions['mod-state'] = (b) => {
    const was = S.canvasState;
    S.canvasState = b.dataset.v;
    U.$('#offline-banner').hidden = S.canvasState !== 'offline';
    if (S.canvasState === 'offline') U.announce('Sem conexão. Os dados podem estar desatualizados.');
    else if (was === 'offline') U.announce('Conexão restabelecida.');
    BV.canvas.render(); BV.lista.render(); BV.detail.render();
    if (route.page) route.page();
    renderModerator(); focusMod('mod-state', b.dataset.v);
  };
  BV.actions['mod-live'] = () => { S.liveSim = !S.liveSim; renderModerator(); const t = U.$('[data-action="mod-live"]'); if (t) t.focus(); };
  BV.actions['mod-quota'] = () => { if (!A.liveQuota(S.selectedId)) U.toast('Esta bolha não tem cotas livres.', 'warn'); };
  BV.actions['mod-pop'] = () => { const id = S.selectedId; if (route.explore !== 'canvas') location.hash = '#/'; setTimeout(() => A.explode(id), route.explore === 'canvas' ? 0 : 120); };
  function focusMod(action, v) { const t = U.$('#moderator [data-action="' + action + '"][data-v="' + v + '"]'); if (t) t.focus(); }
  U.$('#moderator').addEventListener('keydown', (e) => { if (e.key === 'Escape' && modOpen) { modOpen = false; renderModerator(); U.$('.mod-fab').focus(); } });

  /* ---------- Teclado global ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches && e.target.matches('input, textarea, select, [contenteditable]');
    if (e.key === '/' && !typing && !U.topDialog()) {
      e.preventDefault();
      const s = U.$('#search');
      if (s && s.offsetParent !== null) s.focus(); else if (route.explore) BV.actions['open-search']();
    }
    if (e.key === 'Escape' && !U.topDialog() && !U.popoverOpen() && BV.detail.isOpen()) {
      const inMod = e.target.closest && e.target.closest('#moderator');
      if (!inMod) { e.preventDefault(); BV.detail.close(); }
    }
  });

  /* ---------- Início ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    A.applyTheme();
    BV.canvas.init();
    onRoute();
    renderModerator();
    setInterval(tick, 1000);
    setInterval(simulate, 7000);
    let w = window.innerWidth;
    window.addEventListener('resize', () => {
      const nw = window.innerWidth;
      if ((w < 640) !== (nw < 640) || (w < 1400) !== (nw < 1400)) { renderHeader(); if (S.selectedId) BV.detail.render(); }
      w = nw;
    });
  });
})();
