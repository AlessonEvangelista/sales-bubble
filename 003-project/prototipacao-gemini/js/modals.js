/* Bolha Venda — fluxos em diálogo: entrar (T12), Pix (T12p), sair (T12b), lance (T16a),
   escolha de lance (T16), denúncia (T03c), login e atalhos. */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const M = (BV.modals = {});

  function kicker(bb) { return (bb.type === 'SALE' ? 'Venda' : 'Compra') + ' · ' + U.esc(bb.title); }
  function afterChange(bb, oldPrice) {
    BV.canvas.refreshBubble(bb.id);
    BV.canvas.ripple(bb.id);
    BV.detail.render();
    if (BV.lista && BV.lista.isShown()) BV.lista.render();
    if (bb.type === 'SALE' && oldPrice != null && D.price(bb) < oldPrice) U.announce('Novo preço: ' + U.brl(D.price(bb)) + ' por cota.');
  }

  /* ---------- T12 / T12p: entrar na bolha ---------- */
  let J = null, pixTimer = 0;
  BV.actions['open-join'] = () => {
    const bb = D.find(S.selectedId);
    if (!bb) return;
    J = { id: bb.id, step: 'form', pay: 'card', qty: 1, aceite: false, tried: false, errTop: '', errPay: false, pixEnd: 0, copied: false };
    J.dlg = U.dialog({ render: renderJoin, onClose: onJoinClose });
  };
  function onJoinClose() {
    clearInterval(pixTimer);
    const bb = J && D.find(J.id);
    if (J && J.step === 'pix' && bb) { bb.reservedPix = Math.max(0, bb.reservedPix - J.qty); U.toast('Reserva cancelada. Nenhum valor foi cobrado.', 'info'); }
    J = null;
  }
  function joinLimits(bb) {
    const pj = D.persona().kind === 'PJ';
    const free = bb.max - bb.q - bb.reservedPix;
    return { pj, max: pj ? Math.max(1, Math.min(D.pjLimit(bb), free)) : 1 };
  }
  function renderJoin() {
    const bb = D.find(J.id), lim = joinLimits(bb);
    const reserveEach = D.reserve(bb), total = reserveEach * J.qty;
    const pixOff = S.payScenario === 'pixoff' || D.left(bb) < 5 * 60000;
    if (pixOff && J.pay === 'pix') J.pay = 'card';
    if (J.step === 'proc') {
      return U.dlgHead('Entrar na bolha', kicker(bb)) +
        '<div class="dialog__body" style="align-items:center;text-align:center;padding:40px 24px" role="status">' +
        '<span style="width:48px;height:48px;color:var(--link)">' + U.icon('loader', 'spinner') + '</span>' +
        '<p style="font-size:16px;font-weight:600">' + (J.pay === 'pix' ? 'Gerando o QR Code do Pix…' : 'Autorizando pagamento…') + '</p>' +
        '<p style="color:var(--text-2);font-size:14px">Não feche esta janela.</p></div>';
    }
    if (J.step === 'ok') {
      return U.dlgHead('Você está na bolha!', kicker(bb)) +
        '<div class="dialog__body"><div class="alert alert--ok" role="status">' + U.icon('checkCircle') + '<div><strong>Cota confirmada.</strong> ' +
        (J.qty === 1 ? '1 cota' : J.qty + ' cotas') + ' · reservado ' + U.brl(total) + '.</div></div>' +
        '<p style="font-size:14px;color:var(--text-2)">' + (bb.type === 'SALE' ? 'Você paga o preço final da bolha, que pode ser menor. A diferença é liberada no fechamento.' : 'Você paga o valor do lance escolhido. A diferença é liberada.') + '</p>' +
        '<p style="font-size:14px;color:var(--text-2)">Avisaremos quando o preço cair e quando a bolha fechar.</p></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--primary btn--lg" data-action="dialog-close" data-autofocus>Voltar ao mapa</button></div>';
    }
    if (J.step === 'pixexp') {
      return U.dlgHead('O tempo do Pix acabou', kicker(bb)) +
        '<div class="dialog__body"><div class="alert alert--warn" role="alert">' + U.icon('clock') + '<div>O tempo do Pix acabou e a reserva foi liberada. Nenhum valor foi cobrado.</div></div></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Fechar</button><button type="button" class="btn btn--primary" data-action="join-retry" data-autofocus>Tentar de novo</button></div>';
    }
    if (J.step === 'pix') {
      const code = '00020126580014br.gov.bcb.pix0136a1c3-bv-' + bb.id + '-9f2e4b7c5204000053039865406' + total.toFixed(2) + '5802BR5911BOLHA VENDA6009SAO PAULO';
      return U.dlgHead('Pagar com Pix', kicker(bb)) +
        '<div class="dialog__body pix">' +
          '<div class="box" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>' + U.esc(bb.short) + '</strong><div style="font-size:13px;color:var(--text-2)">' + J.qty + (J.qty === 1 ? ' cota' : ' cotas') + ' · preço final pode ser menor</div></div><strong class="mono" style="font-size:18px">' + U.brl(total) + '</strong></div>' +
          '<div class="pix__timer" role="timer" aria-live="off"><span>Sua cota fica reservada por</span><strong class="mono" data-pixtimer>' + pixLeft() + '</strong></div>' +
          '<div class="pix__qr">' + U.qrSvg(bb.id.length * 97 + J.qty) + '</div>' +
          '<p style="text-align:center;font-size:14px;color:var(--text-2)">Pague o Pix para confirmar. Esta tela atualiza sozinha quando o pagamento chegar.</p>' +
          '<div class="field"><label class="field__label" for="pix-code">Pix copia e cola</label><input class="input mono" id="pix-code" readonly value="' + U.esc(code) + '" style="font-size:13px"></div>' +
          '<button type="button" class="btn btn--block btn--lg" style="background:linear-gradient(135deg,#0D9488,#0891B2);color:#fff" data-action="pix-copy" data-autofocus>' + U.icon(J.copied ? 'check' : 'copy') + (J.copied ? 'Código copiado' : 'Copiar código Pix') + '</button>' +
          '<ol class="pix__steps"><li>Abra o app do seu banco e escolha Pix.</li><li>Escaneie o QR Code ou cole o código.</li><li>Confirme o pagamento de ' + U.brl(total) + '.</li></ol>' +
        '</div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary btn--block" style="border-style:dashed" data-action="pix-paid">' + U.icon('flask') + 'Protótipo: simular Pix recebido</button></div>';
    }
    // Formulário
    const t = bb.type === 'SALE' ? D.tier(bb) : null;
    const metaOk = bb.q >= bb.meta;
    const aceiteInv = J.tried && !J.aceite;
    const offline = S.canvasState === 'offline';
    return U.dlgHead('Entrar na bolha', kicker(bb)) +
      '<div class="dialog__body">' +
      (J.errTop ? '<div class="alert alert--danger" role="alert" tabindex="-1" id="join-err" data-autofocus>' + U.icon('alert') + '<div>' + J.errTop +
        ' <button type="button" class="btn btn--sm btn--secondary" style="margin-top:8px" data-action="join-similar">Ver bolhas parecidas</button></div></div>' : '') +
      '<dl class="kv box">' +
        (bb.type === 'SALE'
          ? '<dt>Se fechar agora</dt><dd class="mono">' + U.brl(t.price) + ' / cota</dd><dt>Próximo degrau</dt><dd style="color:var(--sale-text)">' + U.esc(D.nextText(bb)) + '</dd>'
          : '<dt>Preço-alvo</dt><dd class="mono">até ' + U.brl(bb.alvo) + '</dd><dt>Lances</dt><dd>' + bb.bids.length + (D.bestBid(bb) ? ' · melhor ' + U.brl(D.bestBid(bb).price) : '') + '</dd>') +
        '<dt>Meta</dt><dd style="color:' + (metaOk ? 'var(--ok)' : 'var(--amber-text)') + '">' + bb.meta + ' cotas · ' + (metaOk ? 'atingida' : 'faltam ' + (bb.meta - bb.q)) + '</dd>' +
        '<dt>Termina em</dt><dd>' + U.left(D.left(bb), true) + '</dd>' +
        '<dt>Envio</dt><dd>até ' + bb.ship + ' dias após o fechamento</dd></dl>' +
      '<fieldset class="fieldset"><legend class="field__label">Quantidade</legend>' +
        (lim.pj
          ? '<div class="stepper"><button type="button" class="btn btn--secondary btn--icon" id="qty-minus" data-action="qty" data-d="-1" aria-label="Diminuir quantidade"' + (J.qty <= 1 ? ' disabled' : '') + '>' + U.icon('minus') + '</button>' +
            '<output class="stepper__val mono" aria-live="polite" id="qty-out">' + J.qty + (J.qty === 1 ? ' cota' : ' cotas') + '</output>' +
            '<button type="button" class="btn btn--secondary btn--icon" id="qty-plus" data-action="qty" data-d="1" aria-label="Aumentar quantidade"' + (J.qty >= lim.max ? ' disabled' : '') + '>' + U.icon('plus') + '</button></div>' +
            '<p class="field__hint">Sua empresa pode comprar até ' + D.pjLimit(bb) + ' cotas nesta bolha (' + bb.pjCap + '% do lote).</p>'
          : '<div class="box" style="display:flex;justify-content:space-between;gap:10px"><strong>1 cota</strong><span style="font-size:13px;color:var(--text-2)">Limite de 1 cota por pessoa</span></div>') +
      '</fieldset>' +
      '<fieldset class="fieldset" aria-describedby="' + (J.errPay ? 'pay-err' : '') + '"><legend class="field__label">Forma de pagamento</legend><div class="stack-8">' +
        '<label class="radio-card"><input type="radio" name="pay" value="card" data-change="join-pay"' + (J.pay === 'card' ? ' checked' : '') + '>' + U.icon('card') +
          '<span><span class="radio-card__title">Cartão de crédito</span><br><span class="radio-card__sub">Visa •••• 4242 · reserva liberada na hora</span></span></label>' +
        '<label class="radio-card"><input type="radio" name="pay" value="pix" data-change="join-pay"' + (J.pay === 'pix' ? ' checked' : '') + (pixOff ? ' disabled aria-describedby="pix-off"' : '') + '>' + U.icon('pix') +
          '<span><span class="radio-card__title">Pix</span><br><span class="radio-card__sub" id="pix-off"' + (pixOff ? ' style="color:var(--amber-text)"' : '') + '>' + (pixOff ? 'Faltam menos de 5 minutos: use cartão para entrar.' : 'QR Code válido por até 15 minutos') + '</span></span></label>' +
      '</div>' +
      (J.errPay ? '<p class="field__error" id="pay-err" role="alert">' + U.icon('alert') + 'O cartão recusou a reserva. Nenhum valor foi cobrado. Tente outro cartão ou use Pix.</p>' : '') + '</fieldset>' +
      '<div class="box" style="background:var(--info-bg);border-color:rgba(96,165,250,.4)"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><strong>Total reservado agora</strong><strong class="mono" style="font-size:20px">' + U.brl(total) + '</strong></div>' +
        '<p style="font-size:13px;margin-top:6px;color:var(--text-2)">' + (bb.type === 'SALE'
          ? 'Reservamos ' + U.brl(total) + ' agora (preço inicial). Você paga o preço final da bolha, que pode ser menor. A diferença é liberada.'
          : 'Reservamos até ' + U.brl(total) + ' (preço-alvo). Você paga o valor do lance escolhido. A diferença é liberada.') + '</p></div>' +
      '<div class="field"><label class="check"><input type="checkbox" id="join-aceite" data-change="join-aceite"' + (J.aceite ? ' checked' : '') + (aceiteInv ? ' aria-invalid="true" aria-describedby="aceite-err"' : '') + '>' +
        '<span>Li e concordo com as <a href="#" data-action="join-rules">regras desta bolha</a></span></label>' +
        (aceiteInv ? '<p class="field__error" id="aceite-err">' + U.icon('alert') + 'Para continuar, confirme que leu as regras desta bolha.</p>' : '') + '</div>' +
      '</div>' +
      '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Voltar</button>' +
      '<button type="button" class="btn btn--primary" id="join-confirm" data-action="join-confirm"' + (offline ? ' disabled' : '') + '>' + (offline ? 'Sem conexão' : 'Confirmar e reservar ' + U.brl(total)) + '</button></div>';
  }
  function pixLeft() { const ms = Math.max(0, J.pixEnd - Date.now()); return U.pad(Math.floor(ms / 60000)) + ':' + U.pad(Math.floor((ms % 60000) / 1000)); }

  BV.inputs['join-pay'] = (el) => { J.pay = el.value; J.errPay = false; J.dlg.render(); };
  BV.inputs['join-aceite'] = (el) => { J.aceite = el.checked; if (J.tried) J.dlg.render(); };
  BV.actions.qty = (btn) => { const lim = joinLimits(D.find(J.id)); J.qty = U.clamp(J.qty + Number(btn.dataset.d), 1, lim.max); J.dlg.render(); };
  BV.actions['join-rules'] = (btn, e) => { e.preventDefault(); U.toast('Regras: preço por degraus, reserva do preço inicial, saída bloqueada na última hora e 7 dias para desistir após receber.', 'info'); };
  BV.actions['join-similar'] = () => { const bb = D.find(J.id); J.dlg.close(); S.filters.cats = [bb.category]; BV.app.applyFilters(); location.hash = '#/lista'; };
  BV.actions['join-retry'] = () => { J.step = 'form'; J.errTop = ''; J.dlg.render(); };
  BV.actions['join-confirm'] = () => {
    const bb = D.find(J.id);
    if (!J.aceite) { J.tried = true; J.dlg.render(); const c = U.$('#join-aceite'); if (c) c.focus(); U.alert('Para continuar, confirme que leu as regras desta bolha.'); return; }
    if (S.payScenario === 'esgotadas') { J.errTop = 'As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.'; J.dlg.render(); setTimeout(() => { const e = U.$('#join-err'); if (e) e.focus(); }, 30); return; }
    J.step = 'proc'; J.dlg.render();
    setTimeout(() => {
      if (!J) return;
      if (S.payScenario === 'recusado' && J.pay === 'card') { J.step = 'form'; J.errPay = true; J.dlg.render(); return; }
      if (J.pay === 'pix') {
        J.step = 'pix';
        J.pixEnd = Date.now() + Math.min(15 * 60000, D.left(bb));
        bb.reservedPix += J.qty;
        J.dlg.render();
        clearInterval(pixTimer);
        pixTimer = setInterval(() => {
          if (!J || J.step !== 'pix') { clearInterval(pixTimer); return; }
          const el = U.$('[data-pixtimer]');
          if (el) el.textContent = pixLeft();
          if (J.pixEnd - Date.now() <= 0) { clearInterval(pixTimer); bb.reservedPix = Math.max(0, bb.reservedPix - J.qty); J.step = 'pixexp'; J.dlg.render(); }
        }, 1000);
        return;
      }
      confirmQuota(bb);
    }, 1400);
  };
  function confirmQuota(bb) {
    const old = bb.type === 'SALE' ? D.price(bb) : null;
    bb.q = Math.min(bb.max, bb.q + J.qty);
    bb.mine[S.persona] = (bb.mine[S.persona] || 0) + J.qty;
    J.step = 'ok';
    J.dlg.render();
    U.announce('Você está na bolha!');
    afterChange(bb, old);
  }
  BV.actions['pix-copy'] = () => { const v = U.$('#pix-code').value; U.copy(v); J.copied = true; J.dlg.render(); U.announce('Código Pix copiado.'); };
  BV.actions['pix-paid'] = () => { const bb = D.find(J.id); clearInterval(pixTimer); bb.reservedPix = Math.max(0, bb.reservedPix - J.qty); confirmQuota(bb); };

  /* ---------- T12b: sair da bolha ---------- */
  BV.actions['open-exit'] = () => {
    const bb = D.find(S.selectedId), mine = D.mine(bb), val = D.reserve(bb) * mine;
    const dlg = U.dialog({
      role: 'alertdialog', cls: 'dialog--sm',
      render: () => U.dlgHead('Sair da bolha?', kicker(bb)) +
        '<div class="dialog__body"><p>A reserva de <strong>' + U.brl(val) + '</strong> será liberada e o preço será recalculado para todos.</p>' +
        '<p style="font-size:14px;color:var(--text-2)">Você poderá entrar de novo enquanto houver cotas, exceto na última hora.</p></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close" data-autofocus>Continuar na bolha</button>' +
        '<button type="button" class="btn btn--danger-solid" data-action="exit-confirm">Sair da bolha</button></div>'
    });
    BV.actions['exit-confirm'] = () => {
      const old = bb.type === 'SALE' ? D.price(bb) : null;
      bb.q = Math.max(0, bb.q - mine);
      bb.mine[S.persona] = 0;
      dlg.close();
      U.toast('Você saiu da bolha. A reserva de ' + U.brl(val) + ' foi liberada.');
      afterChange(bb, old);
    };
  };

  /* ---------- T16a: enviar / substituir lance (PJ) ---------- */
  BV.actions['open-bid'] = () => {
    const bb = D.find(S.selectedId), me = D.persona().pseudo;
    const cur = (bb.bids || []).find((b) => b.ps === me);
    const F = { price: cur ? U.money(cur.price) : '', days: cur ? String(cur.days) : '10', terms: cur ? cur.terms : '', tried: false, busy: false };
    const errs = () => {
      const e = {}, p = U.num(F.price), d = Number(F.days);
      if (isNaN(p) || p < 1) e.price = 'Informe o preço por cota (mínimo R$ 1,00).';
      else if (p > bb.alvo) e.price = 'O lance precisa ser igual ou menor que o preço-alvo de ' + U.brl(bb.alvo) + '.';
      if (!Number.isInteger(d) || d < 1 || d > 30) e.days = 'O prazo de entrega vai de 1 a 30 dias.';
      if (F.terms.length > 280) e.terms = 'Use até 280 caracteres.';
      return e;
    };
    const dlg = U.dialog({
      render: () => {
        const e = F.tried ? errs() : {}, keys = Object.keys(e);
        const fld = (k) => (e[k] ? ' aria-invalid="true" aria-describedby="bid-' + k + '-err"' : '');
        const er = (k) => (e[k] ? '<p class="field__error" id="bid-' + k + '-err">' + U.icon('alert') + e[k] + '</p>' : '');
        return U.dlgHead(cur ? 'Substituir meu lance' : 'Enviar lance', kicker(bb)) +
          '<div class="dialog__body">' +
          (keys.length ? '<div class="error-summary" role="alert" tabindex="-1" id="bid-sum" data-autofocus><strong>Corrija ' + (keys.length === 1 ? '1 campo' : keys.length + ' campos') + ' para enviar</strong><ul>' +
            keys.map((k) => '<li><a href="#bid-' + k + '">' + e[k] + '</a></li>').join('') + '</ul></div>' : '') +
          '<p class="alert alert--info">' + U.icon('info') + '<span>Preço-alvo de quem criou: até <strong>' + U.brl(bb.alvo) + '</strong> por cota · ' + bb.max + ' unidades. Melhor lance atual: ' + (D.bestBid(bb) ? U.brl(D.bestBid(bb).price) : 'nenhum') + '.</span></p>' +
          '<div class="grid-2"><div class="field"><label class="field__label" for="bid-price">Preço por cota</label><div class="input-affix input-affix--prefix"><span class="input-affix__text">R$</span>' +
            '<input class="input mono" id="bid-price" inputmode="decimal" value="' + U.esc(F.price) + '" data-input="bid-f" data-k="price"' + fld('price') + '></div>' + er('price') + '</div>' +
          '<div class="field"><label class="field__label" for="bid-days">Prazo de entrega</label><div class="input-affix"><input class="input mono" id="bid-days" inputmode="numeric" value="' + U.esc(F.days) + '" data-input="bid-f" data-k="days"' + fld('days') + '><span class="input-affix__text">dias</span></div>' + er('days') + '</div></div>' +
          '<div class="field"><label class="field__label" for="bid-terms">Condições <span style="font-weight:400;color:var(--text-3)">(opcional)</span></label><textarea class="textarea" id="bid-terms" maxlength="300" data-input="bid-f" data-k="terms"' + fld('terms') + '>' + U.esc(F.terms) + '</textarea><span class="field__hint">Frete, garantia, montagem. Até 280 caracteres.</span>' + er('terms') + '</div>' +
          '<p style="font-size:13px;color:var(--text-2)">Seu lance é vinculante até a escolha do vencedor. Você pode substituí-lo por um preço menor enquanto a bolha estiver aberta.</p>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Cancelar</button>' +
          '<button type="button" class="btn btn--primary" id="bid-send" data-action="bid-send"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? U.icon('loader', 'spinner') : '') + (cur ? 'Substituir lance' : 'Enviar lance') + '</button></div>';
      }
    });
    BV.inputs['bid-f'] = (el) => { F[el.dataset.k] = el.value; };
    BV.actions['bid-send'] = () => {
      F.tried = true;
      if (Object.keys(errs()).length) { dlg.render(); setTimeout(() => { const s = U.$('#bid-sum'); if (s) s.focus(); }, 20); return; }
      F.busy = true; dlg.render();
      setTimeout(() => {
        bb.bids = (bb.bids || []).filter((b) => b.ps !== me);
        bb.bids.push({ ps: me, band: D.persona().band, price: U.num(F.price), days: Number(F.days), terms: F.terms || 'Sem condições adicionais.' });
        dlg.close();
        U.toast(cur ? 'Lance substituído. Ele vale até a escolha do vencedor.' : 'Lance enviado. Ele vale até a escolha do vencedor.');
        BV.detail.render(); BV.canvas.refreshBubble(bb.id);
      }, 700);
    };
  };

  /* ---------- T16: escolher lance (criador) ---------- */
  BV.actions['choose-bid'] = (btn) => {
    const bb = D.find(S.selectedId), bid = bb.bids.find((b) => b.ps === btn.dataset.ps);
    const dlg = U.dialog({
      role: 'alertdialog', cls: 'dialog--sm',
      render: () => U.dlgHead('Escolher este lance?', kicker(bb)) +
        '<div class="dialog__body"><p><strong>' + U.esc(bid.ps) + '</strong> por <strong>' + U.brl(bid.price) + '</strong> por cota, entrega em ' + bid.days + ' dias.</p>' +
        '<p style="font-size:14px;color:var(--text-2)">Os participantes pagam ' + U.brl(bid.price) + ' por cota e a diferença da reserva é liberada. Esta escolha não pode ser desfeita.</p></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close" data-autofocus>Voltar</button><button type="button" class="btn btn--primary" data-action="choose-bid-ok">Escolher lance</button></div>'
    });
    BV.actions['choose-bid-ok'] = () => {
      bb.winner = bid.ps; bb.finalPrice = bid.price;
      dlg.close();
      U.toast('Lance de ' + bid.ps + ' escolhido. Fornecedor e participantes foram avisados.');
      BV.detail.render(); BV.canvas.refreshBubble(bb.id);
    };
  };

  /* ---------- T03c: denunciar ---------- */
  BV.actions['open-report'] = () => {
    U.closePopover();
    const bb = D.find(S.selectedId), F = { cat: '', txt: '', tried: false };
    const cats = ['Item proibido', 'Anúncio enganoso', 'Suspeita de fraude', 'Outro motivo'];
    const dlg = U.dialog({
      render: () => {
        const inv = F.tried && !F.cat;
        return U.dlgHead('Denunciar bolha', kicker(bb)) + '<div class="dialog__body">' +
          '<fieldset class="fieldset"' + (inv ? ' aria-describedby="rep-err"' : '') + '><legend class="field__label">Qual é o problema?</legend><div class="stack-8">' +
          cats.map((c, i) => '<label class="radio-card"><input type="radio" name="rep" value="' + c + '" data-change="rep-cat"' + (F.cat === c ? ' checked' : '') + (i === 0 ? ' id="rep-first"' : '') + '><span class="radio-card__title">' + c + '</span></label>').join('') +
          '</div>' + (inv ? '<p class="field__error" id="rep-err" role="alert">' + U.icon('alert') + 'Escolha o motivo da denúncia.</p>' : '') + '</fieldset>' +
          '<div class="field"><label class="field__label" for="rep-txt">Detalhes <span style="font-weight:400;color:var(--text-3)">(opcional)</span></label><textarea class="textarea" id="rep-txt" data-input="rep-txt">' + U.esc(F.txt) + '</textarea></div>' +
          '<p style="font-size:13px;color:var(--text-2)">A moderação analisa em até 24 h. Quem criou a bolha não vê quem denunciou.</p></div>' +
          '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Cancelar</button><button type="button" class="btn btn--primary" data-action="rep-send">Enviar denúncia</button></div>';
      }
    });
    BV.inputs['rep-cat'] = (el) => { F.cat = el.value; if (F.tried) dlg.render(); };
    BV.inputs['rep-txt'] = (el) => { F.txt = el.value; };
    BV.actions['rep-send'] = () => {
      if (!F.cat) { F.tried = true; dlg.render(); U.$('#rep-first').focus(); return; }
      dlg.close(); U.toast('Denúncia enviada. Vamos analisar em até 24 h.');
    };
  };

  /* ---------- Sem permissão: visitante ---------- */
  BV.actions['need-login'] = () => {
    U.dialog({
      cls: 'dialog--sm',
      render: () => U.dlgHead('Entre para continuar') +
        '<div class="dialog__body"><p>Crie sua conta ou entre para participar das bolhas. Leva menos de 2 minutos.</p></div>' +
        '<div class="dialog__foot"><a class="btn btn--secondary" href="#/cadastro" data-action="dialog-close-nav">Criar conta</a>' +
        '<button type="button" class="btn btn--primary" data-action="login-demo" data-autofocus>Entrar como Carlos (demo)</button></div>'
    });
  };
  BV.actions['dialog-close-nav'] = () => { const d = U.topDialog(); if (d) d.close(); };
  BV.actions['login-demo'] = () => { U.topDialog().close(); BV.app.setPersona('pf'); };

  /* ---------- Ajuda de atalhos ---------- */
  BV.actions['open-help'] = () => {
    const rows = [['Tab / Shift+Tab', 'Percorrer controles e bolhas'], ['Setas (numa bolha)', 'Ir para a bolha vizinha naquela direção'], ['Shift + setas', 'Mover o mapa'],
      ['+ / −', 'Aproximar / afastar'], ['0', 'Centralizar e voltar ao zoom 100%'], ['Enter / Espaço', 'Abrir o detalhe da bolha'], ['Esc', 'Fechar detalhe ou menu'],
      ['L', 'Alternar Canvas / Lista'], ['/', 'Ir para a busca'], ['?', 'Abrir esta ajuda']];
    U.dialog({
      cls: 'dialog--sm',
      render: () => U.dlgHead('Atalhos de teclado') + '<div class="dialog__body"><table class="kbd-table"><thead><tr><th scope="col">Tecla</th><th scope="col">Ação</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table>' +
        '<p style="font-size:13px;color:var(--text-2)">Atalhos de uma tecla funcionam com o foco dentro do mapa. Arrastar nunca é obrigatório: use os botões de zoom ou as setas.</p></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--primary" data-action="dialog-close" data-autofocus>Entendi</button></div>'
    });
  };

  M.closeJoinIfFor = (id) => { if (J && J.id === id && J.dlg) J.dlg.close(); };
})();
