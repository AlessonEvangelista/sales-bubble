/* Bolha Venda — item de triagem do comprador (T18), arrependimento (T19) e caso (T25). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util;
  const TC = (BV.triagemComprador = {});
  const B = { stage: 'enviado', caseReason: '', when: '' };   // enviado | entregue | arrep | caso | concluido

  function steps() {
    const order = ['pago', 'aguard', 'enviado', 'entregue', 'janela', 'concluido'];
    const curIdx = { enviado: 2, entregue: 4, arrep: 4, caso: 3, concluido: 6 }[B.stage];
    const data = [
      ['Pago', '26/11 · R$ 80,00 capturados'],
      ['Aguardando envio', 'Prazo do vendedor: 03/12, 12h'],
      ['Enviado', 'Postado em 01/12 · Correios'],
      ['Entregue', B.stage === 'enviado' || B.stage === 'caso' ? 'Previsão: 04/12' : 'Entregue em ' + (B.when || '03/12')],
      ['Janela de arrependimento', B.stage === 'arrep' ? 'Desistência solicitada em ' + B.when : 'Até 10/12'],
      ['Concluído', 'Repasse liberado ao vendedor']
    ];
    return order.map((k, i) => {
      const done = i < curIdx, cur = i === curIdx;
      return '<li class="tl__item' + (done ? ' is-done' : cur ? ' is-cur' : '') + '"' + (cur ? ' aria-current="step"' : '') + '><span class="tl__dot" aria-hidden="true">' + (done ? U.icon('check') : i + 1) + '</span>' +
        '<div><strong>' + data[i][0] + '</strong><span class="sr-only">' + (done ? ' (concluído)' : cur ? ' (etapa atual)' : ' (pendente)') + '</span><div class="field__hint">' + data[i][1] + '</div></div></li>';
    }).join('');
  }

  TC.render = () => {
    const root = U.$('#view-page');
    let banner = '', actions = '';
    if (B.stage === 'enviado') {
      actions = '<button type="button" class="btn btn--primary" data-action="tc-recebi">Confirmar recebimento</button>' +
        '<button type="button" class="btn btn--secondary" data-action="tc-caso" data-r="Não recebi">Não recebi</button>' +
        '<button type="button" class="btn btn--secondary" data-action="tc-arrep">Desistir da compra</button>';
    } else if (B.stage === 'entregue') {
      actions = '<button type="button" class="btn btn--secondary" data-action="tc-caso" data-r="Produto diferente do anúncio">Tive um problema</button>' +
        '<button type="button" class="btn btn--secondary" data-action="tc-arrep">Desistir da compra</button>' +
        '<button type="button" class="btn btn--ghost" data-action="tc-concluir">Simular fim da janela</button>';
    }
    if (B.stage === 'caso') banner = '<div class="alert alert--warn" role="status">' + U.icon('alert') + '<div><strong>Caso aberto em ' + B.when + ': ' + U.esc(B.caseReason) + '.</strong><br>O vendedor tem 3 dias úteis para responder. Se não responder, você recebe o estorno integral.</div></div>';
    if (B.stage === 'arrep') banner = '<div class="alert alert--info" role="status">' + U.icon('info') + '<div><strong>Desistência registrada.</strong><br>Enviamos a etiqueta de devolução para o seu e-mail. Poste em até 7 dias. Os R$ 80,00 voltam ao seu cartão em até 5 dias úteis depois que o vendedor receber.</div></div>';
    if (B.stage === 'concluido') banner = '<div class="alert alert--ok" role="status">' + U.icon('checkCircle') + '<div><strong>Compra concluída.</strong> O pagamento foi liberado ao vendedor. Obrigado por participar!</div></div>';
    U.rerender(root,
      '<div class="page"><div class="page__wrap page__wrap--mid">' +
      '<a class="back-link" href="#/">' + U.icon('left') + 'Voltar ao mapa</a>' +
      '<h1 class="page-title" id="page-h" tabindex="-1">Fone Bluetooth XT-500</h1>' +
      '<p style="color:var(--text-2)">1 cota · bolha encerrada em 26/11 a R$ 80,00 por cota</p>' +
      '<div class="tc-grid"><section class="card card--pad" aria-labelledby="tc-h"><h2 class="section-title" id="tc-h">Acompanhamento</h2>' +
        (banner ? '<div style="margin-top:14px">' + banner + '</div>' : '') +
        '<ol class="tl">' + steps() + '</ol>' +
        (actions ? '<div class="tc-actions">' + actions + '</div>' : '') +
        (B.stage === 'enviado' || B.stage === 'entregue' ? '<p class="field__hint" style="margin-top:10px">Você pode desistir da compra até 10/12, sem precisar justificar.</p>' : '') +
      '</section>' +
      '<div class="tc-side"><section class="card card--pad" aria-labelledby="tc-val-h"><h2 class="section-title" id="tc-val-h">Valores</h2><dl class="kv" style="margin-top:12px">' +
        '<dt>Reservado</dt><dd class="mono">R$ 100,00</dd><dt>Pago</dt><dd class="mono">R$ 80,00</dd><dt>Liberado</dt><dd class="mono" style="color:var(--ok)">R$ 20,00</dd>' +
        (B.stage === 'arrep' || B.stage === 'caso' ? '<dt>Estorno ' + (B.stage === 'caso' ? 'possível' : 'previsto') + '</dt><dd class="mono" style="color:var(--link)">R$ 80,00</dd>' : '') + '</dl></section>' +
      '<section class="card card--pad" aria-labelledby="tc-sel-h"><h2 class="section-title" id="tc-sel-h">Vendedor</h2><p style="margin-top:10px"><strong>TecnoLotes Comércio Ltda</strong></p><p class="field__hint">TecnoLotes#9C1D · Score Bom (702)</p>' +
        '<div class="box" style="margin-top:12px"><span class="field__hint">Rastreio · Correios</span><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px"><strong class="mono">QB123456789BR</strong>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="tc-track">Acompanhar</button></div></div></section></div></div>' +
      '</div></div>');
  };

  BV.actions['tc-track'] = () => U.toast('Último evento: objeto saiu para entrega em São Paulo/SP.', 'info');
  BV.actions['tc-concluir'] = () => { B.stage = 'concluido'; TC.render(); U.$('#tc-h').setAttribute('tabindex', '-1'); U.$('#tc-h').focus(); U.announce('Compra concluída.'); };
  BV.actions['tc-recebi'] = () => {
    const dlg = U.dialog({
      role: 'alertdialog', cls: 'dialog--sm',
      render: () => U.dlgHead('Confirmar que recebeu?') + '<div class="dialog__body"><p>Ao confirmar, começa a janela de 7 dias para desistir. Depois dela, o pagamento é liberado ao vendedor.</p></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Ainda não</button><button type="button" class="btn btn--primary" data-action="tc-recebi-ok" data-autofocus>Sim, recebi</button></div>'
    });
    BV.actions['tc-recebi-ok'] = () => { B.stage = 'entregue'; B.when = U.today(); dlg.close(); TC.render(); U.toast('Recebimento confirmado. Você tem até 10/12 para desistir, se precisar.'); U.$('#page-h').focus(); };
  };
  BV.actions['tc-arrep'] = () => {
    const F = { motivo: '' };
    const dlg = U.dialog({
      render: () => U.dlgHead('Desistir da compra') + '<div class="dialog__body">' +
        '<p>Você pode desistir da compra até 10/12, sem precisar justificar.</p>' +
        '<ol class="num-list"><li>Você recebe uma etiqueta de devolução por e-mail.</li><li>Poste o produto em até 7 dias, na embalagem original.</li><li>Os R$ 80,00 voltam ao seu cartão em até 5 dias úteis depois que o vendedor receber.</li></ol>' +
        '<div class="field"><label class="field__label" for="tc-motivo">Motivo <span style="font-weight:400;color:var(--text-3)">(opcional)</span></label><select class="select" id="tc-motivo" data-change="tc-motivo">' +
        ['', 'Mudei de ideia', 'Encontrei mais barato', 'Comprei por engano', 'Outro'].map((m) => '<option value="' + m + '"' + (F.motivo === m ? ' selected' : '') + '>' + (m || 'Prefiro não dizer') + '</option>').join('') + '</select></div></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close" data-autofocus>Manter a compra</button><button type="button" class="btn btn--danger-solid" data-action="tc-arrep-ok">Desistir da compra</button></div>'
    });
    BV.inputs['tc-motivo'] = (el) => { F.motivo = el.value; };
    BV.actions['tc-arrep-ok'] = () => { B.stage = 'arrep'; B.when = U.today(); dlg.close(); TC.render(); U.toast('Desistência registrada. Enviamos a etiqueta de devolução por e-mail.'); U.$('#page-h').focus(); };
  };
  BV.actions['tc-caso'] = (btn) => {
    const F = { r: btn.dataset.r, txt: '', files: 0, tried: false };
    const reasons = ['Não recebi', 'Produto diferente do anúncio', 'Produto com defeito'];
    const dlg = U.dialog({
      render: () => {
        const bad = F.tried && F.txt.trim().length < 20;
        return U.dlgHead('Abrir caso', 'Fone Bluetooth XT-500') + '<div class="dialog__body">' +
          '<fieldset class="fieldset"><legend class="field__label">O que aconteceu?</legend><div class="stack-8">' + reasons.map((r) =>
            '<label class="radio-card"><input type="radio" name="tc-r" value="' + r + '" data-change="tc-r"' + (F.r === r ? ' checked' : '') + '><span class="radio-card__title">' + r + '</span></label>').join('') + '</div></fieldset>' +
          '<div class="field"><label class="field__label" for="tc-txt">Descreva o problema</label><textarea class="textarea" id="tc-txt" data-input="tc-txt"' + (bad ? ' aria-invalid="true" aria-describedby="tc-txt-err"' : '') + '>' + U.esc(F.txt) + '</textarea>' +
          (bad ? '<p class="field__error" id="tc-txt-err" role="alert">' + U.icon('alert') + 'Conte com pelo menos 20 caracteres o que aconteceu.</p>' : '<span class="field__hint">O vendedor vê sua mensagem, mas não seus dados pessoais.</span>') + '</div>' +
          '<div style="display:flex;align-items:center;gap:12px"><button type="button" class="btn btn--secondary" data-action="tc-file">' + U.icon('upload') + 'Anexar fotos</button><span class="field__hint" aria-live="polite">' + (F.files ? F.files + (F.files === 1 ? ' foto anexada' : ' fotos anexadas') : 'Opcional, até 5 fotos') + '</span></div>' +
          '</div><div class="dialog__foot"><button type="button" class="btn btn--secondary" data-action="dialog-close">Cancelar</button><button type="button" class="btn btn--primary" data-action="tc-caso-ok">Abrir caso</button></div>';
      }
    });
    BV.inputs['tc-r'] = (el) => { F.r = el.value; };
    BV.inputs['tc-txt'] = (el) => { F.txt = el.value; };
    BV.actions['tc-file'] = () => { F.files = Math.min(5, F.files + 1); dlg.render(); };
    BV.actions['tc-caso-ok'] = () => {
      if (F.txt.trim().length < 20) { F.tried = true; dlg.render(); U.$('#tc-txt').focus(); return; }
      B.stage = 'caso'; B.caseReason = F.r; B.when = U.today(); dlg.close(); TC.render();
      U.toast('Caso aberto. Avisaremos quando o vendedor responder.'); U.$('#page-h').focus();
    };
  };
})();
