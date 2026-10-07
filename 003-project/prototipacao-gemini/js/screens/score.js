/* Bolha Venda — meu score (T20) e contestação (T21). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const SC = (BV.score = {});
  const EVENTS = {
    pf: [
      { id: 'e1', date: '03/12', txt: 'Pagamento confirmado na hora · Fone XT-500', d: 10, w: 1, st: 'conta' },
      { id: 'e2', date: '28/11', txt: 'Compra concluída sem atrito · Caixa de som', d: 15, w: 0.98, st: 'conta' },
      { id: 'e3', date: '20/11', txt: 'Reserva Pix expirada sem pagamento · Kit café', d: -12, w: 0.94, st: 'conta', contest: '09/12' },
      { id: 'e4', date: '15/10', txt: 'Caso "não recebi" julgado a seu favor', d: 0, w: 0.82, st: 'revertido' },
      { id: 'e5', date: '10/09', txt: 'Avaliação positiva de vendedor', d: 8, w: 0.71, st: 'conta' }
    ],
    pj: [
      { id: 'e1', date: '03/12', txt: 'Entrega confirmada no prazo · Fone XT-500', d: 12, w: 1, st: 'conta' },
      { id: 'e2', date: '28/11', txt: 'Bolha concluída como vendedor (72 compradores)', d: 25, w: 0.98, st: 'conta' },
      { id: 'e3', date: '20/11', txt: 'Envio com 2 dias de atraso · Kit café', d: -18, w: 0.94, st: 'conta', contest: '09/12' },
      { id: 'e4', date: '15/10', txt: 'Caso "produto diferente" julgado improcedente', d: 0, w: 0.82, st: 'revertido' },
      { id: 'e5', date: '10/09', txt: 'Avaliação positiva de comprador', d: 8, w: 0.71, st: 'conta' }
    ]
  };

  function score() {
    const p = D.persona(), ev = EVENTS[S.persona] || [];
    return Math.round(p.score - ev.filter((e) => e.st === 'revisao').reduce((s, e) => s + e.d * e.w, 0));
  }

  SC.render = () => {
    const root = U.$('#view-page'), p = D.persona();
    if (p.kind === 'GUEST') {
      root.innerHTML = '<div class="page"><div class="page__wrap page__wrap--narrow"><div class="card card--pad" style="text-align:center"><h1 class="page-title" id="page-h" tabindex="-1">Entre para ver seu score</h1><p style="color:var(--text-2);margin:8px 0 18px">O score mostra quanto o grupo pode confiar em você.</p><button type="button" class="btn btn--primary" data-action="login-demo-score">Entrar como Carlos (demo)</button></div></div></div>';
      return;
    }
    const ev = EVENTS[S.persona], sc = score(), band = D.band(sc), review = ev.some((e) => e.st === 'revisao');
    const pos = U.clamp(sc / 10, 0, 100);
    const bandCls = { Risco: 'pill--danger', Regular: 'pill--amber', Bom: 'pill--info', Excelente: 'pill--ok' }[band];
    U.rerender(root,
      '<div class="page"><div class="page__wrap page__wrap--mid">' +
      '<h1 class="page-title" id="page-h" tabindex="-1">Meu score</h1><p style="color:var(--text-2)">' + U.esc(p.pseudo) + ' · ' + U.esc(p.name) + '</p>' +
      '<section class="card card--pad score-card" aria-labelledby="sc-h"><h2 class="sr-only" id="sc-h">Seu score atual</h2>' +
        '<div class="score-num"><span class="mono">' + sc + '</span><span class="pill ' + bandCls + '">' + band + '</span>' + (review ? '<span class="field__hint">provisório</span>' : '') + '</div>' +
        '<div class="score-scale"><div class="score-bar" role="meter" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="' + sc + '" aria-valuetext="' + sc + ' de 1000, faixa ' + band + '">' +
          '<span style="flex:40;background:#B91C1C"></span><span style="flex:20;background:#D97706"></span><span style="flex:20;background:#2563EB"></span><span style="flex:20;background:#059669"></span>' +
          '<span class="score-bar__mark" style="left:' + pos + '%" aria-hidden="true"><span class="mono">' + sc + '</span></span></div>' +
          '<div class="score-legend" aria-hidden="true"><span style="flex:40">Risco · 0–399</span><span style="flex:20">Regular</span><span style="flex:20">Bom</span><span style="flex:20;text-align:right">Excelente</span></div>' +
          '<details class="d-acc" style="margin-top:12px"><summary>' + U.icon('right', 'chev') + 'Como o score é calculado</summary><div class="d-acc__body">' +
            '<p>Todo mundo começa com 600. Cada evento soma ou subtrai pontos: pagar na hora, enviar no prazo, casos julgados e avaliações.</p>' +
            '<p>O peso de cada evento cai pela metade a cada 180 dias, então o que você fez recentemente conta mais.</p>' +
            '<p>Faixas: Risco 0–399 · Regular 400–599 · Bom 600–799 · Excelente 800–1000.</p>' +
            '<p>Eventos contestados ficam fora do cálculo até a decisão.</p></div></details></div>' +
      '</section>' +
      (review ? '<div class="alert alert--info" style="margin-top:16px" role="status">' + U.icon('info') + '<span>Em revisão — este evento não conta no seu score até a decisão. Respondemos em até 5 dias úteis.</span></div>' : '') +
      '<section class="card card--pad" style="margin-top:16px" aria-labelledby="sc-ev-h"><h2 class="section-title" id="sc-ev-h">Eventos</h2>' +
        '<ul class="events">' + ev.map((e) => {
          const chip = e.st === 'revertido' ? '<span class="pill pill--ok">Revertido</span>' : e.st === 'revisao' ? '<span class="pill pill--amber">Em revisão</span>' : '<span class="pill pill--muted">Conta</span>';
          return '<li class="event"><span class="event__date mono">' + e.date + '</span><span class="event__txt">' + U.esc(e.txt) + '</span>' +
            '<span class="event__d mono" style="color:' + (e.d > 0 ? 'var(--ok)' : e.d < 0 ? 'var(--danger-text)' : 'var(--text-2)') + '">' + (e.d > 0 ? '+' : e.d < 0 ? '−' : '') + Math.abs(e.d) + '<span class="sr-only"> pontos</span></span>' +
            '<span class="event__w">peso ' + Math.round(e.w * 100) + '%</span>' + chip +
            (e.contest && e.st === 'conta' ? '<button type="button" class="btn btn--secondary btn--sm" data-action="sc-contest" data-id="' + e.id + '" aria-label="Contestar o evento ' + U.esc(e.txt) + ' até ' + e.contest + '">Contestar até ' + e.contest + '</button>' : '<span></span>') + '</li>';
        }).join('') + '</ul></section>' +
      '</div></div>');
  };

  BV.actions['login-demo-score'] = () => { BV.app.setPersona('pf'); SC.render(); };
  BV.actions['sc-contest'] = (btn) => {
    const e = EVENTS[S.persona].find((x) => x.id === btn.dataset.id);
    const F = { txt: '', files: 0, tried: false, busy: false };
    const dlg = U.dialog({
      render: () => {
        const bad = F.tried && F.txt.trim().length < 30;
        return U.dlgHead('Contestar evento', e.date + ' · ' + U.esc(e.txt)) + '<div class="dialog__body">' +
          '<p>Discorda deste evento? Você pode contestar até ' + e.contest + '.</p>' +
          '<div class="box" style="display:flex;justify-content:space-between"><span>Impacto atual</span><strong class="mono" style="color:var(--danger-text)">−' + Math.abs(e.d) + ' pontos</strong></div>' +
          '<div class="field"><label class="field__label" for="sc-txt">Por que este evento está errado?</label><textarea class="textarea" id="sc-txt" data-input="sc-txt" data-autofocus' + (bad ? ' aria-invalid="true" aria-describedby="sc-txt-err"' : '') + '>' + U.esc(F.txt) + '</textarea>' +
          (bad ? '<p class="field__error" id="sc-txt-err" role="alert">' + U.icon('alert') + 'Explique com pelo menos 30 caracteres.</p>' : '<span class="field__hint">Ex.: o atraso foi da transportadora; anexe o comprovante de postagem.</span>') + '</div>' +
          '<div style="display:flex;align-items:center;gap:12px"><button type="button" class="btn btn--secondary" data-action="sc-file">' + U.icon('upload') + 'Anexar comprovante</button><span class="field__hint" aria-live="polite">' + (F.files ? F.files + (F.files === 1 ? ' arquivo anexado' : ' arquivos anexados') : 'Opcional') + '</span></div>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Cancelar</button><button type="button" class="btn btn--primary" data-action="sc-send"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? U.icon('loader', 'spinner') : '') + 'Enviar contestação</button></div>';
      }
    });
    BV.inputs['sc-txt'] = (el) => { F.txt = el.value; };
    BV.actions['sc-file'] = () => { F.files++; dlg.render(); };
    BV.actions['sc-send'] = () => {
      if (F.txt.trim().length < 30) { F.tried = true; dlg.render(); U.$('#sc-txt').focus(); return; }
      F.busy = true; dlg.render();
      setTimeout(() => { e.st = 'revisao'; dlg.close(); SC.render(); U.toast('Contestação enviada. O evento fica fora do seu score até a decisão.'); U.$('#page-h').focus(); }, 800);
    };
  };
})();
