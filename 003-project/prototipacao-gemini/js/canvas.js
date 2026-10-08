/* Bolha Venda — canvas de bolhas (T01).
   As bolhas são <button> reais posicionados sobre um mundo com pan/zoom: a mesma camada
   serve ao visual, ao clique, ao toque, ao teclado e ao leitor de tela (acessibilidade §2.1). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const C = (BV.canvas = {});
  const ZMIN = 0.4, ZMAX = 2.2, STEP = 1.25;
  let map, surface, world, list, fx, minimap, zoomOut;
  let raf = 0, needLayout = false, fitTimer = 0, anim = null;
  let lastExpSig = '';
  const newIds = new Set(), rebornIds = new Set();

  /* ---------- Marcação de uma bolha (reutilizada na prévia de criação e nos tokens) ---------- */
  C.lodFor = (dpx) => (dpx < 80 ? 0 : dpx < 130 ? 1 : dpx < 180 ? 2 : 3);
  C.fontFor = (dpx) => U.clamp(dpx / 11, 8, 22);

  C.bubbleInner = (bb) => {
    const active = bb.status === 'ACTIVE';
    const isSale = bb.type === 'SALE';
    const p = Math.min(1, bb.q / bb.max);
    const ang = 2 * Math.PI * (bb.meta / bb.max) - Math.PI / 2;
    const mx = (50 + 48 * Math.cos(ang)).toFixed(2), my = (50 + 48 * Math.sin(ang)).toFixed(2);
    const icon = !active ? 'checkCircle' : isSale ? 'tag' : 'cart';
    let price;
    if (!active) price = bb.status === 'CLOSED_OK' ? U.brl(bb.finalPrice) : 'Sem meta';
    else if (isSale) price = U.brl(D.price(bb));
    else price = '<small>até</small>' + U.brl(bb.alvo);
    const time = active ? U.left(D.left(bb)) : 'encerrada';
    return '<span class="b-film"></span><span class="b-iris"></span>' +
      '<svg class="b-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="b-ring__track" cx="50" cy="50" r="48"/>' +
      '<circle class="b-ring__prog" cx="50" cy="50" r="48" pathLength="100" stroke-dasharray="' + (p * 100).toFixed(1) + ' 100" transform="rotate(-90 50 50)"/>' +
      '<circle class="b-ring__meta" cx="' + mx + '" cy="' + my + '" r="2.8"/></svg>' +
      '<span class="b-shine"></span>' +
      '<span class="b-content" aria-hidden="true">' +
        '<span class="b-type-icon">' + U.icon(icon) + '</span>' +
        '<span class="b-type">' + U.icon(icon) + D.typeLabel(bb) + '</span>' +
        '<span class="b-title">' + U.esc(bb.short) + '</span>' +
        '<span class="b-price" data-fit>' + price + '</span>' +
        '<span class="b-row"><span class="b-q">' + bb.q + '/' + bb.max + '</span>' +
          '<span class="b-time">' + U.icon('clock') + '<span data-time="' + bb.id + '">' + time + '</span></span></span>' +
        '<span class="b-next">' + U.esc(D.nextText(bb)) + '</span>' +
      '</span>' +
      (D.isNear(bb) ? '<span class="b-flag" aria-hidden="true">' + U.icon('ringNear') + '<span>Quase cheia</span></span>' : '') +
      (active && D.mine(bb) ? '<span class="b-mine" aria-hidden="true">' + U.icon('check') + '<span>Você participa</span></span>' : '');
  };
  C.bubbleClass = (bb, lod) =>
    'bubble bubble--' + (bb.status !== 'ACTIVE' ? 'closed' : bb.type === 'SALE' ? 'sale' : 'buy') + ' lod-' + lod +
    (D.isNear(bb) ? ' is-near' : '') + (D.isExp(bb) ? ' is-exp' : '') + (S.selectedId === bb.id ? ' is-sel' : '');
  /* Bolha estática (prévia/tokens): diâmetro fixo em px. */
  C.staticBubble = (bb, dpx) =>
    '<div class="b-static" style="position:relative;width:' + dpx + 'px;height:' + dpx + 'px;font-size:' + C.fontFor(dpx).toFixed(1) + 'px">' +
    '<div class="' + C.bubbleClass(Object.assign({}, bb), C.lodFor(dpx)).replace(' is-sel', '') + '" role="img" aria-label="' + U.esc(D.ariaLabel(bb)) + '">' + C.bubbleInner(bb) + '</div></div>';

  /* ---------- Render ---------- */
  C.init = () => {
    map = U.$('#map'); surface = U.$('#map-surface'); world = U.$('#world'); list = U.$('#bubbles'); fx = U.$('#fx');
    minimap = U.$('#minimap'); zoomOut = U.$('#zoom-level');
    U.$('[data-action="zoom-in"]').innerHTML = U.icon('plus');
    U.$('[data-action="zoom-out"]').innerHTML = U.icon('minus');
    U.$('[data-action="zoom-center"]').innerHTML = U.icon('crosshair');
    U.$('[data-action="open-help"]').innerHTML = U.icon('keyboard');
    bindPointer();
    bindKeys();
    minimap.addEventListener('click', onMinimap);
    window.addEventListener('resize', () => C.layout());
    C.renderLegend();
    C.initialView();
    C.render();
  };

  C.renderLegend = () => {
    U.$('#map-legend').innerHTML =
      '<span class="lg"><span class="lg__sw lg__sw--sale" aria-hidden="true"></span>Venda</span>' +
      '<span class="lg"><span class="lg__sw lg__sw--buy" aria-hidden="true"></span>Compra</span>' +
      '<span class="lg"><span class="lg__sw lg__sw--near" aria-hidden="true"></span>Quase cheia</span>' +
      '<span class="lg lg--exp">' + U.icon('clock') + 'Expirando</span>' +
      '<span class="lg"><span class="lg__sw lg__sw--closed" aria-hidden="true"></span>Encerrada</span>' +
      '<span class="lg__count" id="lg-count"></span>';
  };

  function readingOrder(arr) {
    return arr.slice().sort((a, c) => (Math.floor(a.y / 300) - Math.floor(c.y / 300)) || a.x - c.x);
  }

  C.render = () => {
    const st = S.canvasState;
    const vis = readingOrder(S.bubbles.filter(D.visible));
    const hide = st === 'carregando' || st === 'vazio';
    list.setAttribute('aria-busy', st === 'carregando' ? 'true' : 'false');
    list.innerHTML = hide ? '' : vis.map((bb, i) =>
      '<li class="b-slot' + (newIds.has(bb.id) ? ' is-new' : '') + (rebornIds.has(bb.id) ? ' is-reborn' : '') + '" data-slot="' + bb.id + '">' +
      '<div class="b-float" style="--delay:' + (-(i * 1.37) % 7).toFixed(2) + 's;--dur:' + (6 + (i % 3)) + 's">' +
      '<button type="button" class="' + C.bubbleClass(bb, C.lodFor(bb.d * S.view.z)) + '" id="bubble-' + bb.id + '" data-action="open-bubble" data-id="' + bb.id + '" aria-label="' + U.esc(D.ariaLabel(bb)) + '"' +
      (S.selectedId === bb.id ? ' aria-current="true"' : '') + '>' + C.bubbleInner(bb) + '</button></div></li>').join('');
    rebornIds.clear();
    renderState(vis.length);
    lastExpSig = S.bubbles.map((x) => D.isExp(x) ? 1 : 0).join('');
    doLayout(true);
  };

  function renderState(nVisible) {
    const box = U.$('#map-state');
    const st = S.canvasState;
    if (st === 'carregando') {
      const spots = [[12, 16, 190], [44, 52, 170], [62, 12, 180], [10, 62, 150], [74, 58, 140], [36, 14, 100]];
      box.innerHTML = spots.map((s) => '<span class="skel-bubble" style="left:' + s[0] + '%;top:' + s[1] + '%;width:' + s[2] + 'px;height:' + s[2] + 'px" aria-hidden="true"></span>').join('') +
        '<p class="sr-only" role="status">Carregando bolhas desta área…</p>';
      return;
    }
    const filtered = st !== 'vazio' && nVisible === 0;
    if (st === 'vazio' || filtered) {
      box.innerHTML = '<div class="map-empty"><div class="map-empty__card"><div class="map-empty__art" aria-hidden="true">' + U.icon('sparkles') + '</div>' +
        '<h2>' + (filtered ? 'Nenhuma bolha com esses filtros.' : 'Nenhuma bolha por aqui.') + '</h2>' +
        '<p>' + (filtered ? 'Tente outros filtros ou limpe a busca para ver todas as bolhas.' : 'Afaste o zoom, explore outra área ou crie a primeira bolha.') + '</p>' +
        '<div class="map-empty__actions">' + (filtered
          ? '<button type="button" class="btn btn--secondary" data-action="clear-filters">Limpar filtros</button>'
          : '<a class="btn btn--secondary" href="#/lista">Ver a lista</a>') +
        '<a class="btn btn--primary" href="#/criar">' + U.icon('plus') + 'Criar bolha</a></div></div></div>';
      return;
    }
    box.innerHTML = '';
  }

  /* ---------- Layout (posição, tamanho e LOD por diâmetro na tela) ---------- */
  C.layout = (full) => {
    needLayout = needLayout || !!full;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; doLayout(needLayout); needLayout = false; });
  };
  function doLayout(full) {
    if (!map || map.offsetParent === null) return;
    const v = S.view, W = map.clientWidth, Hh = map.clientHeight;
    world.style.transform = 'translate3d(' + v.x.toFixed(1) + 'px,' + v.y.toFixed(1) + 'px,0)';
    const g = 28 * v.z;
    surface.style.setProperty('--grid', g.toFixed(1) + 'px');
    surface.style.setProperty('--gx', (v.x % g).toFixed(1) + 'px');
    surface.style.setProperty('--gy', (v.y % g).toFixed(1) + 'px');
    zoomOut.textContent = Math.round(v.z * 100) + '%';
    let inView = 0;
    const focusedId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null;
    U.$$('.b-slot', list).forEach((slot) => {
      const bb = D.find(slot.dataset.slot);
      if (!bb) return;
      const dpx = bb.d * v.z;
      if (full) {
        slot.style.left = (bb.x * v.z - dpx / 2).toFixed(1) + 'px';
        slot.style.top = (bb.y * v.z - dpx / 2).toFixed(1) + 'px';
        slot.style.width = slot.style.height = dpx.toFixed(1) + 'px';
        slot.style.fontSize = C.fontFor(dpx).toFixed(1) + 'px';
        const btn = slot.querySelector('.bubble, button');
        btn.className = C.bubbleClass(bb, C.lodFor(dpx));
      }
      const sx = bb.x * v.z + v.x, sy = bb.y * v.z + v.y, r = dpx / 2;
      const out = sx + r < -40 || sx - r > W + 40 || sy + r < -40 || sy - r > Hh + 40;
      if (!out) inView++;
      slot.hidden = out && focusedId !== bb.id;
    });
    const n = U.$('#lg-count');
    if (n) n.textContent = inView + (inView === 1 ? ' bolha nesta área' : ' bolhas nesta área');
    list.setAttribute('aria-label', 'Bolhas na área visível (' + inView + ')');
    drawMinimap();
    if (full) { clearTimeout(fitTimer); fitTimer = setTimeout(fitTexts, 60); }
  }
  /* Reduz a fonte de preços longos até caber na largura útil da bolha. */
  function fitTexts(root) {
    U.$$('[data-fit]', root || list).forEach((el) => {
      el.style.fontSize = '';
      let s = 1.32;
      while (el.scrollWidth > el.clientWidth + 1 && s > 0.8) { s -= 0.08; el.style.fontSize = s.toFixed(2) + 'em'; }
    });
  }
  C.fitTexts = fitTexts;

  /* ---------- Câmera ---------- */
  function bounds() {
    const arr = S.bubbles;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    arr.forEach((bb) => { x0 = Math.min(x0, bb.x - bb.d / 2); y0 = Math.min(y0, bb.y - bb.d / 2); x1 = Math.max(x1, bb.x + bb.d / 2); y1 = Math.max(y1, bb.y + bb.d / 2); });
    return { x0: x0 - 80, y0: y0 - 80, x1: x1 + 80, y1: y1 + 80 };
  }
  C.initialView = () => {
    const W = map.clientWidth || window.innerWidth, Hh = map.clientHeight || window.innerHeight - 64;
    const b = bounds();
    const fit = Math.min(W / (b.x1 - b.x0), Hh / (b.y1 - b.y0));
    if (U.isMobile()) {
      const pick = ['fone', 'garrafa', 'cafe', 'cadeiras', 'mochila'].map(D.find).filter(Boolean);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pick.forEach((bb) => { x0 = Math.min(x0, bb.x - bb.d / 2); y0 = Math.min(y0, bb.y - bb.d / 2); x1 = Math.max(x1, bb.x + bb.d / 2); y1 = Math.max(y1, bb.y + bb.d / 2); });
      S.view.z = U.clamp(Math.min((W - 24) / (x1 - x0), (Hh - 110) / (y1 - y0)), 0.5, 0.8);
      S.view.x = W / 2 - ((x0 + x1) / 2) * S.view.z;
      S.view.y = (Hh + 50) / 2 - ((y0 + y1) / 2) * S.view.z;
      return;
    }
    S.view.z = U.clamp(fit, 0.6, 1);
    S.view.x = W / 2 - ((b.x0 + b.x1) / 2) * S.view.z;
    S.view.y = Hh / 2 - ((b.y0 + b.y1) / 2) * S.view.z + 20;
  };
  C.zoomAt = (sx, sy, z) => {
    const v = S.view;
    z = U.clamp(z, ZMIN, ZMAX);
    v.x = sx - (sx - v.x) * (z / v.z);
    v.y = sy - (sy - v.y) * (z / v.z);
    v.z = z;
    C.layout(true);
  };
  C.zoomBy = (f) => C.animateTo(null, null, U.clamp(S.view.z * f, ZMIN, ZMAX));
  C.panBy = (dx, dy) => C.animateTo(S.view.x + dx, S.view.y + dy, S.view.z);
  C.animateTo = (x, y, z) => {
    const v = S.view, W = map.clientWidth, Hh = map.clientHeight;
    if (x == null) { const cx = W / 2, cy = Hh / 2; x = cx - (cx - v.x) * (z / v.z); y = cy - (cy - v.y) * (z / v.z); }
    const from = { x: v.x, y: v.y, z: v.z }, to = { x, y, z };
    cancelAnimationFrame(anim);
    if (S.reducedMotion) { Object.assign(v, to); C.layout(true); return; }
    const t0 = performance.now(), dur = 380;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      v.x = from.x + (to.x - from.x) * e; v.y = from.y + (to.y - from.y) * e; v.z = from.z + (to.z - from.z) * e;
      C.layout(true);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  C.centerOn = (id, z) => {
    const bb = D.find(id); if (!bb) return;
    z = z || Math.max(S.view.z, 0.85);
    const W = map.clientWidth, Hh = map.clientHeight;
    const yFactor = U.isMobile() && S.selectedId ? 0.24 : 0.5;
    C.animateTo(W / 2 - bb.x * z, Hh * yFactor - bb.y * z, z);
  };
  C.reset = () => {
    const b = bounds(), W = map.clientWidth, Hh = map.clientHeight;
    C.animateTo(W / 2 - ((b.x0 + b.x1) / 2), Hh / 2 - ((b.y0 + b.y1) / 2), 1);
  };
  C.ensureVisible = (id) => {
    const bb = D.find(id); if (!bb) return;
    const v = S.view, W = map.clientWidth, Hh = map.clientHeight, r = (bb.d * v.z) / 2 + 24;
    const sx = bb.x * v.z + v.x, sy = bb.y * v.z + v.y;
    let dx = 0, dy = 0;
    if (sx - r < 0) dx = r - sx; else if (sx + r > W) dx = W - (sx + r);
    if (sy - r < 60) dy = r + 60 - sy; else if (sy + r > Hh) dy = Hh - (sy + r);
    if (dx || dy) C.panBy(dx, dy);
  };

  /* ---------- Ponteiro: pan com inércia, pinça, roda ---------- */
  let dragged = false;
  C.consumeDrag = () => { const d = dragged; dragged = false; return d; };
  function bindPointer() {
    const ptrs = new Map();
    let start = null, pinch = null, vel = { x: 0, y: 0 }, lastT = 0, inertia = 0;
    surface.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      cancelAnimationFrame(inertia); cancelAnimationFrame(anim);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { start = { x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; dragged = false; vel = { x: 0, y: 0 }; lastT = performance.now(); }
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: S.view.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        start = null; dragged = true;
      }
    });
    surface.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = map.getBoundingClientRect();
      if (pinch && ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        S.view.x += mx - pinch.mx; S.view.y += my - pinch.my;
        pinch.mx = mx; pinch.my = my;
        C.zoomAt(mx - rect.left, my - rect.top, pinch.z * (dist / pinch.dist));
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) > 6) {
        start.moved = true; dragged = true; surface.classList.add('is-panning');
        try { surface.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      }
      if (start.moved) {
        const t = performance.now(), dt = Math.max(1, t - lastT);
        vel = { x: (e.clientX - prev.x) / dt, y: (e.clientY - prev.y) / dt }; lastT = t;
        S.view.x = start.vx + dx; S.view.y = start.vy + dy;
        C.layout(false);
      }
    });
    const end = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        surface.classList.remove('is-panning');
        if (start && start.moved && !S.reducedMotion && performance.now() - lastT < 80) {
          let vx = vel.x * 16, vy = vel.y * 16;
          const step = () => {
            vx *= 0.92; vy *= 0.92;
            S.view.x += vx; S.view.y += vy; C.layout(false);
            if (Math.abs(vx) + Math.abs(vy) > 0.4) inertia = requestAnimationFrame(step);
          };
          inertia = requestAnimationFrame(step);
        }
        start = null;
      }
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    surface.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = map.getBoundingClientRect();
      cancelAnimationFrame(anim);
      C.zoomAt(e.clientX - rect.left, e.clientY - rect.top, S.view.z * Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });
  }

  /* ---------- Teclado (com foco dentro do mapa) ---------- */
  function bindKeys() {
    map.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      const W = map.clientWidth, Hh = map.clientHeight;
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key]) {
        const [dx, dy] = arrows[e.key];
        e.preventDefault();
        if (e.shiftKey || !e.target.dataset.id) { C.panBy(-dx * W * 0.25, -dy * Hh * 0.25); return; }
        spatial(e.target.dataset.id, dx, dy);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); C.zoomBy(STEP); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); C.zoomBy(1 / STEP); }
      else if (e.key === '0') { e.preventDefault(); C.reset(); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); location.hash = '#/lista'; }
      else if (e.key === '?') { e.preventDefault(); BV.actions['open-help'](); }
    });
    list.addEventListener('focusin', (e) => { if (e.target.dataset.id) C.ensureVisible(e.target.dataset.id); });
  }
  function spatial(fromId, dx, dy) {
    const a = D.find(fromId), v = S.view;
    let best = null, bestScore = Infinity;
    S.bubbles.filter(D.visible).forEach((bb) => {
      if (bb.id === fromId) return;
      const ox = (bb.x - a.x) * v.z, oy = (bb.y - a.y) * v.z;
      const along = ox * dx + oy * dy, across = Math.abs(ox * dy) + Math.abs(oy * dx);
      if (along <= 10) return;
      const score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = bb; }
    });
    if (best) {
      const slot = list.querySelector('[data-slot="' + best.id + '"]');
      if (slot) slot.hidden = false;
      const el = document.getElementById('bubble-' + best.id);
      if (el) el.focus();
    }
  }

  /* ---------- Minimapa ---------- */
  function drawMinimap() {
    if (!minimap || minimap.offsetParent === null) return;
    const ctx = minimap.getContext('2d'), w = minimap.width, h = minimap.height, b = bounds();
    const sx = w / (b.x1 - b.x0), sy = h / (b.y1 - b.y0), s = Math.min(sx, sy);
    const ox = (w - (b.x1 - b.x0) * s) / 2, oy = (h - (b.y1 - b.y0) * s) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = S.theme === 'light' ? 'rgba(226,232,240,.9)' : 'rgba(15,23,42,.9)';
    ctx.fillRect(0, 0, w, h);
    S.bubbles.filter(D.visible).forEach((bb) => {
      ctx.beginPath();
      ctx.arc(ox + (bb.x - b.x0) * s, oy + (bb.y - b.y0) * s, Math.max(2.5, (bb.d / 2) * s * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = bb.status !== 'ACTIVE' ? '#64748B' : bb.type === 'SALE' ? '#818CF8' : '#22D3EE';
      ctx.fill();
      if (bb.id === S.selectedId) { ctx.strokeStyle = S.theme === 'light' ? '#0F172A' : '#F8FAFC'; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    const v = S.view, W = map.clientWidth, Hh = map.clientHeight;
    ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + (-v.x / v.z - b.x0) * s, oy + (-v.y / v.z - b.y0) * s, (W / v.z) * s, (Hh / v.z) * s);
    minimap._map = { b, s, ox, oy };
  }
  function onMinimap(e) {
    const m = minimap._map; if (!m) return;
    const r = minimap.getBoundingClientRect();
    const px = (e.clientX - r.left) * (minimap.width / r.width), py = (e.clientY - r.top) * (minimap.height / r.height);
    const wx = (px - m.ox) / m.s + m.b.x0, wy = (py - m.oy) / m.s + m.b.y0;
    C.animateTo(map.clientWidth / 2 - wx * S.view.z, map.clientHeight / 2 - wy * S.view.z, S.view.z);
  }

  /* ---------- Tempo real ---------- */
  C.tick = () => {
    const sig = S.bubbles.map((x) => D.isExp(x) ? 1 : 0).join('');
    if (sig !== lastExpSig) { C.render(); return; }
    U.$$('[data-time]', list).forEach((el) => {
      const bb = D.find(el.dataset.time);
      if (!bb || bb.status !== 'ACTIVE') return;
      const t = U.left(D.left(bb));
      if (el.textContent !== t) el.textContent = t;
    });
  };
  C.refreshBubble = (id) => {
    const bb = D.find(id), btn = document.getElementById('bubble-' + id);
    if (!bb || !btn) return;
    const slot = btn.closest('.b-slot');
    const dpx = bb.d * S.view.z;
    btn.className = C.bubbleClass(bb, C.lodFor(dpx));
    btn.innerHTML = C.bubbleInner(bb);
    btn.setAttribute('aria-label', D.ariaLabel(bb));
    fitTexts(slot);
  };
  C.ripple = (id) => {
    const btn = document.getElementById('bubble-' + id);
    if (!btn || S.reducedMotion) return;
    const r = document.createElement('span');
    r.className = 'b-ripple';
    btn.parentElement.appendChild(r);
    setTimeout(() => r.remove(), 1200);
  };
  C.markNew = (id) => { newIds.add(id); setTimeout(() => newIds.delete(id), 1500); };

  /* ---------- Estouro de bolha de sabão ---------- */
  const IRIS = ['#ff7ac6', '#7fdcff', '#9dffb0', '#fff08a', '#ffad7a', '#c79bff', '#ffffff'];
  C.pop = (id, done) => {
    const bb = D.find(id), btn = document.getElementById('bubble-' + id);
    const finish = () => { rebornIds.add(id); done(); };
    if (!bb || !btn || btn.closest('.b-slot').hidden) { finish(); return; }
    if (S.reducedMotion) {
      btn.style.transition = 'opacity .2s'; btn.style.opacity = '0';
      setTimeout(finish, 220);
      return;
    }
    btn.classList.add('is-wobble');
    setTimeout(() => {
      btn.classList.remove('is-wobble');
      btn.classList.add('is-gone');
      const z = S.view.z, dpx = bb.d * z;
      const pop = document.createElement('div');
      pop.className = 'pop';
      pop.style.left = (bb.x * z) + 'px';
      pop.style.top = (bb.y * z) + 'px';
      pop.style.setProperty('--d', dpx + 'px');
      let html = '<span class="pop__flash"></span>';
      for (let i = 0; i < 9; i++) {
        html += '<span class="pop__shard" style="--r:' + (i * 40 + Math.random() * 20).toFixed(0) + 'deg;--c:' + IRIS[i % IRIS.length] + '"></span>';
      }
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
        const r0 = (dpx / 2) * (0.82 + Math.random() * 0.18), travel = dpx * (0.2 + Math.random() * 0.45);
        const x0 = Math.cos(a) * r0, y0 = Math.sin(a) * r0;
        const x1 = Math.cos(a) * (r0 + travel), y1 = Math.sin(a) * (r0 + travel) + dpx * (0.15 + Math.random() * 0.2);
        const s = (3 + Math.random() * 6).toFixed(1);
        html += '<span class="pop__drop" style="--x0:' + x0.toFixed(1) + 'px;--y0:' + y0.toFixed(1) + 'px;--x1:' + x1.toFixed(1) + 'px;--y1:' + y1.toFixed(1) +
          'px;--s:' + s + 'px;--c:' + IRIS[i % IRIS.length] + ';--t:' + (0.5 + Math.random() * 0.35).toFixed(2) + 's"></span>';
      }
      pop.innerHTML = html;
      fx.appendChild(pop);
      setTimeout(() => pop.remove(), 950);
      setTimeout(finish, 520);
    }, 240);
  };
})();
