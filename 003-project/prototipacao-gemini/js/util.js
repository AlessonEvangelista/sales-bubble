/* Bolha Venda — utilitários compartilhados (ícones, formatação, diálogos, anúncios). */
(function () {
  'use strict';
  const BV = (window.BV = window.BV || {});
  BV.actions = BV.actions || {};
  BV.inputs = BV.inputs || {};
  const U = (BV.util = {});

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.brl = (v) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  U.int = (v) => Number(v).toLocaleString('pt-BR');
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.isMobile = () => window.matchMedia('(max-width: 639px)').matches;
  U.isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  U.num = (s) => { const n = parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.')); return isNaN(n) ? NaN : n; };
  U.money = (n) => (isNaN(n) ? '' : n.toFixed(2).replace('.', ','));
  U.pad = (n) => String(n).padStart(2, '0');
  U.uid = (() => { let i = 0; return (p) => (p || 'id') + '-' + (++i); })();

  /* ---------- Ícones (traço 2px, estilo Lucide) ---------- */
  const P = {
    tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    map: '<path d="M14.1 4.4 9.9 2.6a2 2 0 0 0-1.6 0L3.6 4.7A1 1 0 0 0 3 5.6v14.3a1 1 0 0 0 1.4.9l4-1.8a2 2 0 0 1 1.6 0l4.2 1.8a2 2 0 0 0 1.6 0l4.6-2.1a1 1 0 0 0 .6-.9V3.5a1 1 0 0 0-1.4-.9l-4 1.8a2 2 0 0 1-1.6 0z"/><path d="M15 5.8v15M9 2.8v15"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
    pix: '<path d="m12 2 4.5 4.5-4.5 4.5-4.5-4.5z"/><path d="m12 13 4.5 4.5L12 22l-4.5-4.5z"/><path d="m6.5 7.5 4.5 4.5-4.5 4.5L2 12z"/><path d="m17.5 7.5 4.5 4.5-4.5 4.5L13 12z"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
    keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
    wifiOff: '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.8M22 8.8a15 15 0 0 0-11.3-3.8M2 2l20 20"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    flask: '<path d="M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.12a2 2 0 0 1-.21-.9V2M8.5 2h7M7 16h10"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.8 5.4a2 2 0 0 1-1.28 1.28l-5.4 1.8 1.8-5.4a2 2 0 0 1 1.28-1.28z"/>',
    layers: '<path d="m12.83 2.18 8.58 3.9a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.9a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.56C21.97 6.01 17.46 2 12 2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    burst: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    ringNear: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 1 1-8.5 6" stroke-width="3"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>'
  };
  U.icon = (name, cls) => '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';

  /* ---------- Tempo ---------- */
  U.left = (ms, precise) => {
    if (ms <= 0) return 'encerrando';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (s < 3600) return precise ? U.pad(m) + ':' + U.pad(sec) : Math.max(1, m) + ' min';
    if (d === 0) return h + 'h ' + U.pad(m) + 'm';
    return precise ? d + 'd ' + U.pad(h) + 'h ' + U.pad(m) + 'm' : d + 'd ' + U.pad(h) + 'h';
  };
  U.when = (ts) => {
    const d = new Date(ts), now = new Date();
    const same = d.toDateString() === now.toDateString();
    const tom = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
    const hh = U.pad(d.getHours()) + 'h' + (d.getMinutes() ? U.pad(d.getMinutes()) : '');
    if (same) return 'hoje, ' + hh;
    if (tom) return 'amanhã, ' + hh;
    return U.pad(d.getDate()) + '/' + U.pad(d.getMonth() + 1) + ', ' + hh;
  };
  U.hhmm = (d) => U.pad((d || new Date()).getHours()) + 'h' + U.pad((d || new Date()).getMinutes());
  U.today = () => { const d = new Date(); return U.pad(d.getDate()) + '/' + U.pad(d.getMonth() + 1); };

  /* ---------- Anúncios (uma região polite global, com throttling por chave) ---------- */
  const lastByKey = {};
  U.announce = (msg, key, minGapMs) => {
    if (key && minGapMs) {
      const now = Date.now();
      if (lastByKey[key] && now - lastByKey[key] < minGapMs) return;
      lastByKey[key] = now;
    }
    const el = document.getElementById('live-polite');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 60);
  };
  U.alert = (msg) => {
    const el = document.getElementById('live-alert');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 60);
  };

  /* ---------- Toast (visual; o texto vai para a região polite) ---------- */
  U.toast = (msg, kind) => {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast--' + kind : '');
    t.innerHTML = U.icon(kind === 'danger' || kind === 'warn' ? 'alert' : kind === 'info' ? 'info' : 'checkCircle') + '<span>' + U.esc(msg) + '</span>';
    box.appendChild(t);
    U.announce(msg);
    let timer;
    const arm = () => { timer = setTimeout(() => t.remove(), 5000); };
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', arm);
    arm();
  };

  /* ---------- Foco ---------- */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  U.focusables = (root) => U.$$(FOCUSABLE, root).filter((el) => el.offsetParent !== null || el === document.activeElement);

  /* Re-renderiza preservando o foco e a seleção do elemento ativo (por id). */
  U.rerender = (root, html) => {
    const a = document.activeElement;
    const id = a && root.contains(a) ? a.id : null;
    let s0, s1;
    try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* sem seleção */ }
    const sc = root.scrollTop;
    root.innerHTML = html;
    root.scrollTop = sc;
    if (id) {
      const n = document.getElementById(id);
      if (n) { n.focus({ preventScroll: true }); try { if (s0 != null) n.setSelectionRange(s0, s1); } catch (e) { /* ok */ } }
    }
  };

  /* ---------- Diálogos modais (foco preso, Esc, fundo inerte, foco devolvido) ---------- */
  const stack = [];
  U.dialog = (opts) => {
    const root = document.getElementById('dialogs');
    const opener = opts.opener || document.activeElement;
    const back = document.createElement('div');
    back.className = 'dialog-backdrop' + (opts.variant ? ' dialog-backdrop--' + opts.variant : '');
    const titleId = U.uid('dlg-title');
    back.innerHTML = '<div class="dialog ' + (opts.variant ? 'dialog--' + opts.variant + ' ' : '') + (opts.cls || '') + '" role="' + (opts.role || 'dialog') + '" aria-modal="true" aria-labelledby="' + titleId + '"></div>';
    const box = back.firstChild;
    root.appendChild(back);
    const handle = {
      el: box, titleId,
      render() {
        U.rerender(box, opts.render(handle));
        const t = box.querySelector('[data-dlg-title]');
        if (t) t.id = titleId;
        if (stack.indexOf(handle) >= 0 && !box.contains(document.activeElement) && box.isConnected) {
          const f = box.querySelector('[data-autofocus]') || t;
          if (f) { if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(f.tagName) && !f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
        }
      },
      close(result) {
        const i = stack.indexOf(handle);
        if (i >= 0) stack.splice(i, 1);
        back.remove();
        setInert();
        if (opts.onClose) opts.onClose(result);
        const target = opts.returnFocus || opener;
        if (target && document.contains(target)) target.focus({ preventScroll: true });
      }
    };
    stack.push(handle);
    setInert();
    handle.render();
    back.addEventListener('mousedown', (e) => { if (e.target === back && opts.dismissable !== false) handle.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && opts.dismissable !== false) { e.stopPropagation(); handle.close(); }
      if (e.key === 'Tab') {
        const f = U.focusables(box);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    requestAnimationFrame(() => {
      const target = box.querySelector('[data-autofocus]') || box.querySelector('[data-dlg-title]') || U.focusables(box)[0];
      if (target) { if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1'); target.focus(); }
    });
    return handle;
  };
  U.topDialog = () => stack[stack.length - 1];
  U.closeAllDialogs = () => { while (stack.length) stack[stack.length - 1].close(); };
  function setInert() {
    const on = stack.length > 0;
    ['app', 'moderator'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
    U.$$('#dialogs > .dialog-backdrop').forEach((b, i, all) => { if (i < all.length - 1) b.setAttribute('inert', ''); else b.removeAttribute('inert'); });
  }
  U.dlgHead = (title, kicker) =>
    '<div class="dialog__head"><div>' + (kicker ? '<div class="dialog__kicker">' + kicker + '</div>' : '') +
    '<h2 class="dialog__title" data-dlg-title tabindex="-1">' + title + '</h2></div>' +
    '<button type="button" class="icon-btn dialog-close" data-action="dialog-close" aria-label="Fechar">' + U.icon('x') + '</button></div>';
  BV.actions['dialog-close'] = () => { const d = U.topDialog(); if (d) d.close(); };

  /* ---------- Popovers ancorados ---------- */
  let openPop = null;
  U.togglePopover = (btn, html, cls) => {
    const wasSame = openPop && openPop.btn === btn;
    U.closePopover();
    if (wasSame) return;
    const pop = document.createElement('div');
    pop.className = 'popover ' + (cls || '');
    pop.id = U.uid('pop');
    pop.innerHTML = html;
    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', pop.id);
    openPop = { btn, pop };
    const first = U.focusables(pop)[0];
    if (first) first.focus();
  };
  U.closePopover = (returnFocus) => {
    if (!openPop) return;
    openPop.pop.remove();
    openPop.btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) openPop.btn.focus();
    openPop = null;
  };
  U.popoverOpen = () => openPop;
  document.addEventListener('mousedown', (e) => {
    if (openPop && !openPop.pop.contains(e.target) && !openPop.btn.contains(e.target)) U.closePopover();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPop) { e.stopPropagation(); U.closePopover(true); } }, true);

  /* ---------- Documentos brasileiros ---------- */
  const digits = (s) => String(s).replace(/\D/g, '');
  U.digits = digits;
  U.maskCPF = (v) => { const d = digits(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); };
  U.maskCNPJ = (v) => { const d = digits(v).slice(0, 14); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); };
  U.validCPF = (v) => {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const calc = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  };
  U.validCNPJ = (v) => {
    const d = digits(v);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = (n) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  };
  U.validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

  /* ---------- QR Code ilustrativo (determinístico) ---------- */
  U.qrSvg = (seed) => {
    const n = 25; let s = seed || 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const finder = (x, y) => {
      for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
        const dx = x - ox, dy = y - oy;
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
        if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
      }
      return -1;
    };
    let rects = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const f = finder(x, y); if (f === 1 || (f === -1 && rnd() > 0.52)) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; }
    return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" role="img" aria-label="QR Code do Pix" style="width:100%;height:100%;background:#fff;border-radius:12px" shape-rendering="crispEdges"><g fill="#0B0F19">' + rects + '</g></svg>';
  };

  U.copy = (text) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(() => fallback());
    fallback();
    return Promise.resolve();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignora */ }
      ta.remove();
    }
  };
})();
