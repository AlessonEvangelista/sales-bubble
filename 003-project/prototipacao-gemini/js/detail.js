/* Bolha Venda — detalhe da bolha (T03, T03b): drawer no desktop, bottom sheet no mobile. */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const DT = (BV.detail = {});
  let el, img = 0, origin = null, milestones = {}, lastDrag = 0;

  DT.isOpen = () => !!S.selectedId && el && !el.hidden;

  DT.open = (id, opener) => {
    el = el || U.$('#detail');
    const changed = S.selectedId !== id;
    S.selectedId = id;
    if (changed) { img = 0; S.detailFull = false; }
    origin = opener || document.getElementById('bubble-' + id) || document.activeElement;
    el.hidden = false;
    document.body.classList.add('detail-open');
    DT.render();
    BV.canvas.render();
    if (BV.lista && BV.lista.isShown()) BV.lista.render();
    requestAnimationFrame(() => {
      const t = U.$('#detail-title');
      if (t) t.focus({ preventScroll: true });
      if (!BV.lista || !BV.lista.isShown()) {
        const bb = D.find(id);
        if (U.isMobile()) BV.canvas.centerOn(id, Math.max(S.view.z, 0.72));
        else if (bb) BV.canvas.ensureVisible(id);
      }
    });
  };

  DT.close = () => {
    if (!el || el.hidden) return;
    const id = S.selectedId;
    S.selectedId = null;
    el.hidden = true;
    document.body.classList.remove('detail-open');
    el.innerHTML = '';
    BV.canvas.render();
    if (BV.lista && BV.lista.isShown()) BV.lista.render();
    const back = (origin && document.contains(origin) && origin) || document.getElementById('bubble-' + id) || document.getElementById('lcard-' + id);
    if (back) back.focus({ preventScroll: true });
  };

  DT.render = () => {
    el = el || U.$('#detail');
    const bb = D.find(S.selectedId);
    if (!bb) { el.hidden = true; return; }
    el.classList.toggle('is-full', !!S.detailFull);
    U.rerender(el, html(bb));
  };

  function typePill(bb) {
    if (bb.status !== 'ACTIVE') return '<span class="pill pill--closed">' + U.icon('checkCircle') + 'ENCERRADA</span>';
    return bb.type === 'SALE' ? '<span class="pill pill--sale">' + U.icon('tag') + 'VENDA</span>' : '<span class="pill pill--buy">' + U.icon('cart') + 'COMPRA</span>';
  }

  function timerBlock(bb) {
    if (bb.status !== 'ACTIVE') return '';
    const left = D.left(bb);
    if (D.isExp(bb)) {
      return '<div class="d-timer d-timer--exp" role="timer" aria-live="off" aria-label="Tempo restante">' + U.icon('clock') +
        '<div><div>Termina em</div><div class="d-timer__clock" data-dtime="exp">' + U.left(left, true) + '</div>' +
        '<div class="d-timer__sub">' + (D.mine(bb) ? 'Saídas bloqueadas na última hora para proteger o grupo.' : 'Última hora: entre agora para garantir sua cota.') + '</div></div></div>';
    }
    return '<div class="d-timer" role="timer" aria-live="off">' + U.icon('clock') +
      '<span>Termina em <strong data-dtime="std">' + U.left(left, true) + '</strong> (' + U.when(bb.endsAt) + ')</span></div>';
  }

  function progress(bb) {
    const pct = Math.round((bb.q / bb.max) * 100), metaPct = (bb.meta / bb.max) * 100;
    const grad = bb.status !== 'ACTIVE' ? '#64748B' : bb.type === 'SALE' ? 'linear-gradient(90deg,#3B82F6,#8B5CF6)' : 'linear-gradient(90deg,#10B981,#06B6D4)';
    const metaOk = bb.q >= bb.meta;
    return '<div class="d-progress"><div class="d-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + bb.max + '" aria-valuenow="' + bb.q +
      '" aria-valuetext="' + bb.q + ' de ' + bb.max + ' cotas, meta ' + bb.meta + '">' +
      '<div class="d-progress__fill" style="width:' + pct + '%;background:' + grad + '"></div>' +
      '<span class="d-progress__meta" style="left:calc(' + metaPct.toFixed(1) + '% - 1px)" aria-hidden="true"></span></div>' +
      '<div class="d-progress__txt"><span><strong>' + bb.q + '</strong> de ' + bb.max + ' cotas</span>' +
      '<span style="color:' + (metaOk ? 'var(--ok)' : 'var(--amber-text)') + '">Meta ' + bb.meta + ' · ' + (metaOk ? 'atingida' : 'faltam ' + (bb.meta - bb.q)) + '</span></div></div>';
  }

  function priceBlock(bb) {
    if (bb.status === 'CLOSED_OK') return '<div class="d-price"><div class="d-price__label">Preço final</div><div class="d-price__value">' + U.brl(bb.finalPrice) + '<small>por cota</small></div><div class="d-price__next" style="color:var(--ok)">Meta atingida · ' + bb.q + ' cotas vendidas</div></div>';
    if (bb.status === 'CLOSED_FAIL') return '<div class="d-price"><div class="d-price__label">Resultado</div><div class="d-price__value" style="font-size:22px">Não atingiu a meta</div><div class="d-price__next">Todo o valor reservado foi devolvido.</div></div>';
    if (bb.type === 'SALE') {
      return '<div class="d-price"><div class="d-price__label">Se fechar agora</div><div class="d-price__value">' + U.brl(D.price(bb)) + '<small>por cota</small></div>' +
        '<div class="d-price__next" style="color:var(--sale-text)">' + U.esc(D.nextText(bb)) + '</div></div>';
    }
    const best = D.bestBid(bb);
    return '<div class="d-price"><div class="d-price__label">Preço-alvo</div><div class="d-price__value">até ' + U.brl(bb.alvo) + '<small>por cota</small></div>' +
      '<div class="d-price__next" style="color:var(--buy-text)">' + (best ? 'Melhor lance atual: ' + U.brl(best.price) : 'Aguardando lances de empresas') + '</div></div>';
  }

  function tiers(bb) {
    const t = D.tier(bb);
    return '<section aria-labelledby="d-tiers-h"><h3 class="d-sec-title" id="d-tiers-h">Degraus de preço</h3><ol class="d-tiers">' +
      bb.tiers.map((r, i) => {
        const done = bb.q >= r[0], cur = i === t.cur && bb.status === 'ACTIVE';
        return '<li class="' + (cur ? 'is-cur' : '') + '"><span class="d-tiers__l">' + (done ? '<span class="ok">' + U.icon('check') + '</span>' : '<span class="no">' + U.icon('clock') + '</span>') +
          (r[0] === 0 ? '0 cotas (inicial)' : r[0] + ' cotas') + (r[0] === bb.meta ? ' · meta' : '') +
          '<span class="sr-only">' + (done ? ' (atingido)' : ' (não atingido)') + '</span></span>' +
          '<span style="display:flex;gap:8px;align-items:center"><span class="mono">' + U.brl(r[1]) + '</span>' + (cur ? '<span class="pill pill--info">atual</span>' : '') + '</span></li>';
      }).join('') + '</ol></section>';
  }

  function bids(bb) {
    const list = (bb.bids || []).slice().sort((a, c) => a.price - c.price);
    const me = D.persona().pseudo, creator = D.isCreator(bb);
    let h = '<section aria-labelledby="d-bids-h"><h3 class="d-sec-title" id="d-bids-h">Lances (' + list.length + ')</h3>';
    if (creator) {
      h += '<p class="field__hint" style="margin-bottom:8px">' + (bb.status === 'ACTIVE'
        ? 'Quando a bolha fechar, você escolhe o lance vencedor em até 24 h. Se não escolher, vence o menor preço.'
        : bb.status === 'CLOSED_FAIL' ? 'A bolha não atingiu a meta. Nenhum lance será escolhido e todos os valores foram devolvidos.'
        : bb.winner ? 'Lance vencedor escolhido. O fornecedor foi avisado.' : 'Escolha o lance vencedor até ' + U.when(bb.endsAt + 24 * 3600000) + '. Se você não escolher, vence o menor preço.') + '</p>';
    }
    if (!list.length) return h + '<p class="box" style="font-size:14px;color:var(--text-2)">Ainda não há lances. Empresas convidadas e interessadas podem enviar até o fim da bolha.</p></section>';
    h += '<ul class="d-bids">' + list.map((b, i) => {
      const mine = b.ps === me, win = bb.winner === b.ps;
      return '<li class="d-bid' + (i === 0 ? ' is-best' : '') + (mine ? ' is-mine' : '') + (win ? ' is-win' : '') + '">' +
        '<div class="d-bid__top"><span>' + U.esc(b.ps) + (mine ? ' <span class="pill pill--info">Seu lance</span>' : '') + (win ? ' <span class="pill pill--ok">Vencedor</span>' : i === 0 ? ' <span class="pill pill--ok">Menor preço</span>' : '') + '</span>' +
        '<span class="mono">' + U.brl(b.price) + '</span></div>' +
        '<div class="d-bid__meta"><span>Score ' + U.esc(b.band) + '</span><span>Entrega em ' + b.days + ' dias</span></div>' +
        '<div class="d-bid__meta">' + U.esc(b.terms) + '</div>' +
        (creator && bb.status === 'CLOSED_OK' && !bb.winner ? '<button type="button" class="btn btn--secondary btn--sm" data-action="choose-bid" data-ps="' + U.esc(b.ps) + '">Escolher este lance</button>' : '') +
        '</li>';
    }).join('') + '</ul></section>';
    return h;
  }

  function accordions(bb) {
    const people = D.participants(bb);
    const reserva = bb.type === 'SALE'
      ? 'Reservamos ' + U.brl(D.reserve(bb)) + ' agora (preço inicial). Você paga o preço final da bolha, que pode ser menor. A diferença é liberada.'
      : 'Reservamos até ' + U.brl(bb.alvo) + ' (preço-alvo). Você paga o valor do lance escolhido. A diferença é liberada.';
    return '<div>' +
      '<details class="d-acc"><summary>' + U.icon('right', 'chev') + 'Como funciona o pagamento</summary><div class="d-acc__body"><p>' + reserva + '</p><p>Se a bolha não atingir a meta, todo o valor reservado é devolvido.</p></div></details>' +
      '<details class="d-acc"><summary>' + U.icon('right', 'chev') + (bb.type === 'SALE' ? 'Envio em até ' + bb.ship + ' dias após o fechamento' : 'Entrega em até ' + bb.ship + ' dias após a escolha do lance') + '</summary><div class="d-acc__body">' +
        '<p>Você acompanha o envio em Minhas cotas e tem 7 dias após receber para desistir da compra.</p>' +
        (bb.type === 'SALE' ? '<p>Cada empresa pode comprar até ' + D.pjLimit(bb) + ' cotas (' + bb.pjCap + '% do lote). Pessoa física: 1 cota.</p>' : '') + '</div></details>' +
      '<details class="d-acc"><summary>' + U.icon('right', 'chev') + 'Participantes (' + bb.q + ')</summary><div class="d-acc__body"><div class="d-people">' +
        people.map((p) => '<span>' + U.esc(p) + '</span>').join('') + (bb.q > people.length ? '<span>e mais ' + (bb.q - people.length) + '</span>' : '') + '</div></div></details>' +
      '</div>';
  }

  function footer(bb) {
    const persona = D.persona(), mine = D.mine(bb), offline = S.canvasState === 'offline';
    const more = '<div class="more-menu"><button type="button" class="btn btn--secondary btn--icon" data-action="detail-more" aria-haspopup="menu" aria-expanded="false" aria-label="Mais ações">' + U.icon('more') + '</button></div>';
    if (bb.status === 'CLOSED_OK') {
      return '<div class="detail__foot-note">A bolha fechou a ' + U.brl(bb.finalPrice) + ' por cota.' + (mine && bb.type === 'SALE' ? ' ' + U.brl(D.reserve(bb) - bb.finalPrice) + ' liberados para você.' : '') + '</div>' +
        '<div class="detail__foot-row">' + (mine ? '<a class="btn btn--primary btn--lg" href="#/minhas-cotas">Ver minha triagem</a>' : D.isCreator(bb) && bb.type === 'SALE' ? '<a class="btn btn--primary btn--lg" href="#/minhas-bolhas">Ver triagem de envios</a>' : '<a class="btn btn--secondary btn--lg btn--grow" href="#/lista">Ver bolhas parecidas</a>') + more + '</div>';
    }
    if (bb.status === 'CLOSED_FAIL') {
      return '<div class="detail__foot-note">A bolha não atingiu a meta. Todo o valor reservado foi devolvido.</div><div class="detail__foot-row"><a class="btn btn--secondary btn--lg btn--grow" href="#/lista">Ver bolhas parecidas</a>' + more + '</div>';
    }
    const note = bb.type === 'SALE' ? 'Reserva: ' + U.brl(D.reserve(bb)) + ' · você paga o preço final' : 'Reserva: até ' + U.brl(bb.alvo) + ' · você paga o lance escolhido';
    if (offline) {
      return '<div class="detail__foot-note">' + U.icon('wifiOff') + ' Sem conexão. Conecte-se para confirmar.</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" disabled>Entrar na bolha</button>' + more + '</div>';
    }
    if (persona.kind === 'GUEST') {
      return '<div class="detail__foot-note">' + note + '</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" data-action="need-login">Entrar na bolha</button>' + more + '</div>';
    }
    if (D.isCreator(bb) && !mine) {
      return '<div class="detail__foot-note">Você criou esta bolha. Depois de publicar, preço, cotas e prazo não podem ser alterados.</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" data-action="share">' + U.icon('share') + 'Compartilhar</button>' + more + '</div>';
    }
    if (persona.kind === 'PJ' && bb.type === 'PURCHASE') {
      const has = (bb.bids || []).some((b) => b.ps === persona.pseudo);
      return '<div class="detail__foot-note">Seu lance é vinculante até a escolha do vencedor.</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" data-action="open-bid">' + (has ? 'Substituir meu lance' : 'Enviar lance') + '</button>' + more + '</div>';
    }
    if (mine) {
      const blocked = D.left(bb) < 3600000;
      return '<div class="detail__foot-note"><span class="pill pill--info">' + U.icon('check') + 'Você participa (' + mine + (mine === 1 ? ' cota' : ' cotas') + ')</span></div>' +
        (blocked ? '<div class="detail__foot-note" id="exit-blocked">Saídas são bloqueadas na última hora para proteger o grupo.</div>' : '') +
        '<div class="detail__foot-row"><button type="button" class="btn btn--danger btn--lg btn--grow" data-action="open-exit"' + (blocked ? ' disabled aria-describedby="exit-blocked"' : '') + '>Sair da bolha</button>' + more + '</div>';
    }
    const full = bb.q >= bb.max;
    if (full) {
      return '<div class="detail__foot-note">Cotas esgotadas' + (bb.reservedPix ? ' — ' + bb.reservedPix + ' reservas aguardando pagamento' : '') + '.</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" disabled>Cotas esgotadas</button>' + more + '</div>';
    }
    return '<div class="detail__foot-note">' + note + '</div><div class="detail__foot-row"><button type="button" class="btn btn--primary btn--lg" data-action="open-join">' +
      (persona.kind === 'PJ' ? 'Entrar com cotas' : 'Entrar na bolha') + '</button>' + more + '</div>';
  }

  function gallery(bb) {
    const n = bb.imgs || 1, i = img % n;
    const bg = bb.status !== 'ACTIVE' ? 'linear-gradient(135deg,#334155,#1E293B)' : bb.type === 'SALE' ? 'linear-gradient(135deg,#1E3A8A,#4C1D95)' : 'linear-gradient(135deg,#064E3B,#155E75)';
    return '<div class="d-gallery" style="background:' + bg + '">' +
      '<div class="d-gallery__art" role="img" aria-label="Foto ' + (i + 1) + ' de ' + n + ': ' + U.esc(bb.title) + '">' + U.icon('image') + '<span class="d-gallery__cap">Foto do produto · ' + (i + 1) + ' de ' + n + '</span></div>' +
      (n > 1 ? '<button type="button" class="gal-btn gal-btn--prev" data-action="gal" data-dir="-1" aria-label="Foto anterior">' + U.icon('left') + '</button>' +
        '<button type="button" class="gal-btn gal-btn--next" data-action="gal" data-dir="1" aria-label="Próxima foto">' + U.icon('right') + '</button>' : '') + '</div>';
  }

  function html(bb) {
    const exp = D.isExp(bb);
    return '<button type="button" class="detail__handle" data-action="detail-toggle" aria-expanded="' + (S.detailFull ? 'true' : 'false') + '" aria-label="' + (S.detailFull ? 'Recolher detalhe' : 'Expandir detalhe') + '"><span></span></button>' +
      '<div class="detail__scroll">' +
        '<div class="d-top">' + typePill(bb) + '<button type="button" class="icon-btn" data-action="detail-close" aria-label="Fechar detalhe">' + U.icon('x') + '</button></div>' +
        '<h2 class="d-title" id="detail-title" tabindex="-1">' + U.esc(bb.title) + '</h2>' +
        '<p class="d-by">por <strong>' + U.esc(bb.creator) + '</strong> · Score ' + D.band(bb.creatorScore) + ' (' + bb.creatorScore + ')</p>' +
        (exp ? timerBlock(bb) : '') +
        priceBlock(bb) +
        progress(bb) +
        (!exp ? timerBlock(bb) : '') +
        gallery(bb) +
        '<p style="font-size:14px;color:var(--text-2)">' + U.esc(bb.desc) + '</p>' +
        (bb.type === 'SALE' ? tiers(bb) : bids(bb)) +
        accordions(bb) +
      '</div>' +
      '<div class="detail__foot">' + footer(bb) + '</div>';
  }

  /* Contador do detalhe + anúncios em marcos (1 h, 10 min, 1 min) */
  DT.tick = () => {
    if (!DT.isOpen()) return;
    const bb = D.find(S.selectedId);
    if (!bb || bb.status !== 'ACTIVE') return;
    const left = D.left(bb);
    const exp = U.$('[data-dtime]', el);
    if (exp && (exp.dataset.dtime === 'exp') !== D.isExp(bb)) { DT.render(); return; }
    if (exp) exp.textContent = U.left(left, true);
    [[3600000, 'termina em menos de 1 hora'], [600000, 'termina em 10 minutos'], [60000, 'termina em 1 minuto']].forEach(([ms, txt]) => {
      const k = bb.id + ms;
      if (left <= ms && left > ms - 2000 && !milestones[k]) { milestones[k] = 1; U.announce(bb.short + ' ' + txt + '.'); }
    });
  };

  /* ---------- Ações ---------- */
  BV.actions['open-bubble'] = (btn, e) => {
    if (btn.closest('#bubbles') && BV.canvas.consumeDrag()) return;
    DT.open(btn.dataset.id, btn);
  };
  BV.actions['detail-close'] = () => DT.close();
  BV.actions['detail-toggle'] = () => { if (Date.now() - lastDrag < 400) return; S.detailFull = !S.detailFull; DT.render(); };
  BV.actions.gal = (btn) => {
    const n = D.find(S.selectedId).imgs || 1;
    img = (img + Number(btn.dataset.dir) + n) % n;
    DT.render();
    U.announce('Foto ' + (img + 1) + ' de ' + n);
  };
  BV.actions.noop = () => {};
  BV.actions['detail-more'] = (btn) => {
    U.togglePopover(btn,
      '<div role="menu" aria-label="Mais ações">' +
      '<button type="button" role="menuitem" class="menu-item" data-action="share">' + U.icon('share') + 'Compartilhar</button>' +
      '<button type="button" role="menuitem" class="menu-item" data-action="open-report">' + U.icon('flag') + 'Denunciar bolha</button></div>', 'popover--right');
  };
  BV.actions.share = () => {
    U.closePopover();
    U.copy(location.href.split('#')[0] + '#/b/' + S.selectedId);
    U.toast('Link da bolha copiado.', 'info');
  };

  /* Arrastar a alça do bottom sheet */
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest && e.target.closest('.detail__handle');
    if (!h) return;
    const y0 = e.clientY;
    const up = (ev) => {
      document.removeEventListener('pointerup', up);
      const dy = ev.clientY - y0;
      if (Math.abs(dy) < 25) return;
      if (dy < 0 && !S.detailFull) { S.detailFull = true; DT.render(); }
      else if (dy > 0 && S.detailFull) { S.detailFull = false; DT.render(); }
      else if (dy > 0 && !S.detailFull) DT.close();
      lastDrag = Date.now();
    };
    document.addEventListener('pointerup', up);
  });
})();
