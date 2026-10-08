/* Bolha Venda — criar bolha de venda (T10, 5 etapas) e de compra (T11). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util, D = BV.data, S = BV.state;
  const CR = (BV.criar = {});
  let root, F;

  const DUR = {
    SALE: [['24h', '24 horas', 24], ['3d', '3 dias', 72], ['5d', '5 dias', 120], ['7d', '7 dias', 168]],
    PURCHASE: [['24h', '24 horas', 24], ['2d', '2 dias', 48], ['3d', '3 dias', 72], ['4d', '4 dias', 96]]
  };
  const LABELS = { SALE: ['Produto', 'Cotas', 'Preço', 'Prazos', 'Revisão'], PURCHASE: ['Item', 'Cotas', 'Preço-alvo', 'Prazos', 'Revisão'] };

  function fresh(type) {
    return {
      type: type || 'SALE', step: 1, tried: false, busy: false, savedAt: null,
      title: 'Fone Bluetooth XT-500', desc: 'Fone sem fio com cancelamento de ruído, 30 h de bateria e estojo de carga. Lote lacrado, nota fiscal e garantia de 12 meses.',
      cat: 'Eletrônicos', photos: 2, cap: '100', meta: '40', teto: 50,
      tiers: [{ c: '0', p: '100,00' }, { c: '40', p: '90,00' }, { c: '70', p: '80,00' }, { c: '100', p: '75,00' }],
      alvo: '890,00', invited: '', dur: '3d', ship: '7', aceite: false
    };
  }

  /* ---------- Validação ---------- */
  function tierErrors() {
    const cap = U.num(F.cap);
    return F.tiers.map((r, i) => {
      const c = U.num(r.c), p = U.num(r.p), prev = F.tiers[i - 1];
      if (isNaN(p) || p < 1) return { k: 'p', msg: 'O preço mínimo por cota é R$ 1,00.' };
      if (i > 0 && !isNaN(U.num(prev.p)) && p >= U.num(prev.p)) return { k: 'p', msg: 'O preço precisa cair de um degrau para o seguinte.' };
      if (i > 0 && (isNaN(c) || c <= U.num(prev.c))) return { k: 'c', msg: 'Cada degrau precisa de mais cotas que o anterior.' };
      if (!isNaN(cap) && c > cap) return { k: 'c', msg: 'O degrau não pode passar da capacidade (' + cap + ' cotas).' };
      return null;
    });
  }
  function errors(step) {
    const e = [];
    const add = (id, msg) => e.push({ id, msg });
    if (step === 1) {
      const t = F.title.trim();
      if (t.length < 5 || t.length > 80) add('cr-title', 'Título: use de 5 a 80 caracteres.');
      if (F.desc.trim().length < 20) add('cr-desc', 'Descrição: conte pelo menos 20 caracteres sobre o ' + (F.type === 'SALE' ? 'produto' : 'item') + '.');
      if (F.photos < 1 && F.type === 'SALE') add('cr-photos', 'Fotos: adicione pelo menos 1 foto do produto.');
    }
    if (step === 2) {
      const cap = U.num(F.cap), meta = U.num(F.meta);
      if (!Number.isInteger(cap) || cap < 2 || cap > 10000) add('cr-cap', 'Capacidade: de 2 a 10.000 cotas.');
      if (!Number.isInteger(meta) || meta < 1 || (!isNaN(cap) && meta > cap)) add('cr-meta', 'Meta: de 1 cota até a capacidade.');
    }
    if (step === 3) {
      if (F.type === 'SALE') tierErrors().forEach((x, i) => { if (x) add('cr-t' + x.k + i, 'Degrau ' + (i + 1) + ': ' + x.msg); });
      else { const a = U.num(F.alvo); if (isNaN(a) || a < 1) add('cr-alvo', 'Preço-alvo: informe um valor a partir de R$ 1,00.'); }
    }
    if (step === 4) {
      const s = U.num(F.ship);
      if (!Number.isInteger(s) || s < 1 || s > 30) add('cr-ship', 'Prazo de ' + (F.type === 'SALE' ? 'envio' : 'entrega') + ': de 1 a 30 dias.');
    }
    if (step === 5 && !F.aceite) add('cr-aceite', 'Confirme que entendeu que a oferta é vinculante.');
    return e;
  }
  const errFor = (errs, id) => errs.find((x) => x.id === id);
  const inv = (errs, id) => (errFor(errs, id) ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '');
  const errP = (errs, id) => { const x = errFor(errs, id); return x ? '<p class="field__error" id="' + id + '-err">' + U.icon('alert') + U.esc(x.msg.replace(/^[^:]+: /, '')) + '</p>' : ''; };

  /* ---------- Prévia ---------- */
  function previewBubble() {
    const durH = (DUR[F.type].find((d) => d[0] === F.dur) || DUR[F.type][1])[2];
    const cap = U.num(F.cap) || 100, meta = U.num(F.meta) || 1;
    const fake = {
      id: 'preview', type: F.type, status: 'ACTIVE', title: F.title || 'Sua bolha', short: (F.title || 'Sua bolha').slice(0, 18), max: cap, meta: Math.min(meta, cap),
      q: F.type === 'PURCHASE' ? 1 : 0, endsAt: Date.now() + durH * 3600000, mine: {}, bids: [], creator: D.persona().pseudo, creatorScore: 700,
      tiers: F.tiers.map((t) => [U.num(t.c) || 0, U.num(t.p) || 0]), alvo: U.num(F.alvo) || 0
    };
    return BV.canvas.staticBubble(fake, U.isMobile() ? 160 : 190);
  }
  function chart() {
    if (F.type !== 'SALE') {
      return '<div class="box"><strong>Preço-alvo: até ' + U.brl(U.num(F.alvo)) + ' por cota</strong><p style="font-size:13px;color:var(--text-2);margin-top:4px">Fornecedores dão lances iguais ou menores. Você escolhe o vencedor depois do fechamento.</p></div>';
    }
    const errs = tierErrors();
    const prices = F.tiers.map((t) => U.num(t.p)).filter((v) => !isNaN(v));
    const max = Math.max.apply(null, prices.concat([1]));
    const first = U.num(F.tiers[0].p), last = U.num(F.tiers[F.tiers.length - 1].p);
    const ex = F.tiers[Math.min(2, F.tiers.length - 1)];
    return '<h3 class="d-sec-title">Cotas × preço por cota</h3>' +
      '<div class="bars" role="img" aria-label="Preço por cota cai de ' + U.brl(first) + ' com 0 cotas para ' + U.brl(last) + ' com ' + U.esc(F.tiers[F.tiers.length - 1].c) + ' cotas.">' +
      F.tiers.map((t, i) => { const p = U.num(t.p); const h = isNaN(p) ? 4 : Math.max(8, Math.round((p / max) * 120));
        return '<div class="bars__col"><span class="bars__val mono">' + (isNaN(p) ? '—' : 'R$ ' + Math.round(p)) + '</span><span class="bars__bar' + (errs[i] ? ' is-err' : '') + '" style="height:' + h + 'px"></span><span class="bars__lbl mono">' + U.esc(t.c) + '</span></div>'; }).join('') +
      '</div><p class="box" style="font-size:14px;margin-top:12px">Com ' + U.esc(ex.c) + ' cotas, cada uma sai por ' + U.brl(U.num(ex.p)) + '.</p>';
  }
  function asideHTML() {
    return '<div class="criar-stage">' + previewBubble() + '</div>' + chart() +
      '<p style="font-size:13px;color:var(--text-2);margin-top:12px">Capacidade: ' + U.esc(F.cap) + ' · Meta: ' + U.esc(F.meta) + (F.type === 'SALE' ? ' · Até ' + Math.floor((U.num(F.cap) || 0) * F.teto / 100) + ' cotas por empresa' : '') + '</p>';
  }

  /* ---------- Etapas ---------- */
  function stepBody(errs) {
    const sale = F.type === 'SALE';
    if (F.step === 1) {
      return '<div class="field"><label class="field__label" for="cr-title">Título</label><input class="input" id="cr-title" maxlength="80" value="' + U.esc(F.title) + '" data-input="cr" data-k="title"' + inv(errs, 'cr-title') + '>' +
        '<span class="field__hint" id="cr-title-count">' + F.title.length + '/80</span>' + errP(errs, 'cr-title') + '</div>' +
        '<div class="field"><label class="field__label" for="cr-desc">Descrição</label><textarea class="textarea" id="cr-desc" maxlength="2000" data-input="cr" data-k="desc"' + inv(errs, 'cr-desc') + '>' + U.esc(F.desc) + '</textarea>' +
        '<span class="field__hint" id="cr-desc-count">' + F.desc.length.toLocaleString('pt-BR') + '/2.000 · estado, garantia, nota fiscal</span>' + errP(errs, 'cr-desc') + '</div>' +
        '<div class="field"><label class="field__label" for="cr-cat">Categoria</label><select class="select" id="cr-cat" data-change="cr" data-k="cat">' + BV.CATEGORIES.map((c) => '<option' + (c === F.cat ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
        '<div class="field"><span class="field__label" id="cr-photos-l">Fotos <span style="font-weight:400;color:var(--text-3)">(' + F.photos + ' de 5)</span></span>' +
        '<div class="photos" role="group" aria-labelledby="cr-photos-l">' +
          Array.from({ length: F.photos }, (_, i) => '<div class="photos__item">' + U.icon('image') + '<button type="button" class="photos__rm" data-action="cr-photo-rm" data-i="' + i + '" aria-label="Remover foto ' + (i + 1) + '">' + U.icon('x') + '</button></div>').join('') +
          (F.photos < 5 ? '<button type="button" class="photos__add" id="cr-photos" data-action="cr-photo-add"' + inv(errs, 'cr-photos') + '>' + U.icon('upload') + 'Adicionar foto</button>' : '') +
        '</div>' + errP(errs, 'cr-photos') + '</div>';
    }
    if (F.step === 2) {
      const cap = U.num(F.cap);
      return '<div class="grid-2"><div class="field"><label class="field__label" for="cr-cap">Capacidade</label><div class="input-affix"><input class="input mono" id="cr-cap" inputmode="numeric" value="' + U.esc(F.cap) + '" data-input="cr" data-k="cap"' + inv(errs, 'cr-cap') + '><span class="input-affix__text">cotas</span></div>' +
        '<span class="field__hint">Total de unidades do lote (2 a 10.000).</span>' + errP(errs, 'cr-cap') + '</div>' +
        '<div class="field"><label class="field__label" for="cr-meta">Meta mínima</label><div class="input-affix"><input class="input mono" id="cr-meta" inputmode="numeric" value="' + U.esc(F.meta) + '" data-input="cr" data-k="meta"' + inv(errs, 'cr-meta') + '><span class="input-affix__text">cotas</span></div>' +
        '<span class="field__hint">Se não chegar à meta, todo o valor reservado é devolvido.</span>' + errP(errs, 'cr-meta') + '</div></div>' +
        (sale ? '<div class="field"><label class="field__label" for="cr-teto">Teto por empresa: <output id="cr-teto-out">' + F.teto + '% · até ' + (isNaN(cap) ? '—' : Math.floor(cap * F.teto / 100)) + ' cotas</output></label>' +
          '<input type="range" class="range" id="cr-teto" min="10" max="100" step="5" value="' + F.teto + '" data-input="cr" data-k="teto" aria-valuetext="' + F.teto + ' por cento">' +
          '<span class="field__hint">Pessoa física compra 1 cota. Empresas compram várias, até este teto.</span></div>' : '');
    }
    if (F.step === 3 && sale) {
      const terr = F.tried ? tierErrors() : F.tiers.map(() => null);
      return '<div class="tiers-head" aria-hidden="true"><span>A partir de</span><span>Preço por cota</span></div><ol class="tiers-ed">' +
        F.tiers.map((t, i) => {
          const x = terr[i], idC = 'cr-tc' + i, idP = 'cr-tp' + i;
          return '<li class="tiers-ed__row"><div class="field"><label class="sr-only" for="' + idC + '">Degrau ' + (i + 1) + ': a partir de quantas cotas</label>' +
            '<div class="input-affix"><input class="input mono" id="' + idC + '" inputmode="numeric" value="' + U.esc(t.c) + '" data-input="cr-tier" data-i="' + i + '" data-k="c"' + (i === 0 ? ' disabled' : '') + (x && x.k === 'c' ? ' aria-invalid="true" aria-describedby="' + idC + '-err"' : '') + '><span class="input-affix__text">cotas</span></div></div>' +
            '<div class="field"><label class="sr-only" for="' + idP + '">Degrau ' + (i + 1) + ': preço por cota</label>' +
            '<div class="input-affix input-affix--prefix"><span class="input-affix__text">R$</span><input class="input mono" id="' + idP + '" inputmode="decimal" value="' + U.esc(t.p) + '" data-input="cr-tier" data-i="' + i + '" data-k="p"' + (x && x.k === 'p' ? ' aria-invalid="true" aria-describedby="' + idP + '-err"' : '') + '></div>' +
            (i === 0 ? '<span class="field__hint">Preço inicial (valor da reserva)</span>' : i === F.tiers.length - 1 ? '<span class="field__hint">Preço-alvo</span>' : '') + '</div>' +
            (i > 0 ? '<button type="button" class="btn btn--secondary btn--icon" data-action="cr-tier-rm" data-i="' + i + '" aria-label="Remover degrau ' + (i + 1) + '">' + U.icon('trash') + '</button>' : '<span class="tiers-ed__fixed" aria-hidden="true"></span>') +
            (x ? '<p class="field__error tiers-ed__err" id="' + (x.k === 'c' ? idC : idP) + '-err">' + U.icon('alert') + x.msg + '</p>' : '') + '</li>';
        }).join('') + '</ol>' +
        '<div style="display:flex;align-items:center;gap:12px"><button type="button" class="btn btn--secondary" id="cr-tier-add" data-action="cr-tier-add"' + (F.tiers.length >= 10 ? ' disabled' : '') + '>' + U.icon('plus') + 'Adicionar degrau</button>' +
        '<span class="field__hint">' + F.tiers.length + ' de 10</span></div>';
    }
    if (F.step === 3) {
      return '<div class="field"><label class="field__label" for="cr-alvo">Preço-alvo por cota</label><div class="input-affix input-affix--prefix"><span class="input-affix__text">R$</span><input class="input mono" id="cr-alvo" inputmode="decimal" value="' + U.esc(F.alvo) + '" data-input="cr" data-k="alvo"' + inv(errs, 'cr-alvo') + '></div>' +
        '<span class="field__hint">O máximo que cada participante aceita pagar. Reservamos este valor de quem entra.</span>' + errP(errs, 'cr-alvo') + '</div>' +
        '<div class="field"><label class="field__label" for="cr-inv">Fornecedores convidados <span style="font-weight:400;color:var(--text-3)">(opcional)</span></label><input class="input" id="cr-inv" placeholder="Ex.: Fornecedora#A1C3, MóveisPro#77D0" value="' + U.esc(F.invited) + '" data-input="cr" data-k="invited">' +
        '<span class="field__hint">Separe por vírgula. Qualquer empresa verificada também pode dar lance.</span></div>';
    }
    if (F.step === 4) {
      const opts = DUR[F.type], cur = opts.find((d) => d[0] === F.dur) || opts[1];
      return '<fieldset class="fieldset"><legend class="field__label">Duração da bolha</legend><div class="dur-grid">' +
        opts.map((d) => '<label class="radio-card"><input type="radio" name="cr-dur" value="' + d[0] + '" data-change="cr" data-k="dur"' + (F.dur === d[0] ? ' checked' : '') + '><span class="radio-card__title">' + d[1] + '</span></label>').join('') +
        '</div><p class="field__hint" style="margin-top:8px">Termina ' + U.when(Date.now() + cur[2] * 3600000) + '.' + (sale ? '' : ' Bolhas de compra duram no máximo 4 dias.') + '</p></fieldset>' +
        '<div class="field"><label class="field__label" for="cr-ship">Prazo de ' + (sale ? 'envio' : 'entrega') + '</label><div class="input-affix" style="max-width:220px"><input class="input mono" id="cr-ship" inputmode="numeric" value="' + U.esc(F.ship) + '" data-input="cr" data-k="ship"' + inv(errs, 'cr-ship') + '><span class="input-affix__text">dias</span></div>' +
        '<span class="field__hint">' + (sale ? 'Conta a partir do fechamento da bolha.' : 'Conta a partir da escolha do lance.') + '</span>' + errP(errs, 'cr-ship') + '</div>';
    }
    // Revisão
    const cur = DUR[F.type].find((d) => d[0] === F.dur) || DUR[F.type][1];
    const pIni = U.num(F.tiers[0].p), pFin = U.num(F.tiers[F.tiers.length - 1].p);
    return '<dl class="kv box review">' +
      '<dt>Título</dt><dd>' + U.esc(F.title) + '</dd><dt>Categoria</dt><dd>' + U.esc(F.cat) + '</dd>' +
      '<dt>Cotas</dt><dd>' + U.esc(F.cap) + ' (meta ' + U.esc(F.meta) + ')</dd>' +
      (sale ? '<dt>Preço</dt><dd class="mono">' + U.brl(pIni) + ' → ' + U.brl(pFin) + '</dd><dt>Degraus</dt><dd>' + F.tiers.length + '</dd><dt>Teto por empresa</dt><dd>' + F.teto + '%</dd>'
        : '<dt>Preço-alvo</dt><dd class="mono">até ' + U.brl(U.num(F.alvo)) + '</dd>') +
      '<dt>Duração</dt><dd>' + cur[1] + '</dd><dt>' + (sale ? 'Envio' : 'Entrega') + '</dt><dd>até ' + U.esc(F.ship) + ' dias</dd></dl>' +
      (sale ? '<div class="box"><strong>Taxa da plataforma: 6% sobre o valor concluído</strong><p style="font-size:14px;color:var(--text-2);margin-top:4px">Você recebe de ' + U.brl(pFin * 0.94) + ' a ' + U.brl(pIni * 0.94) + ' por cota, conforme o preço final.</p></div>'
        : '<div class="box"><strong>Sua cota de criador</strong><p style="font-size:14px;color:var(--text-2);margin-top:4px">Ao publicar, reservamos ' + U.brl(U.num(F.alvo)) + ' da sua cota. Você paga o valor do lance escolhido.</p></div>') +
      '<div class="alert alert--warn">' + U.icon('alert') + '<span>Depois de publicar, preço, cotas e prazo não podem ser alterados.</span></div>' +
      '<div class="field"><label class="check"><input type="checkbox" id="cr-aceite" data-change="cr-aceite"' + (F.aceite ? ' checked' : '') + inv(errs, 'cr-aceite') + '><span>Entendo que a oferta é vinculante e que posso ' + (sale ? 'entregar o produto' : 'pagar a minha cota') + ' nessas condições.</span></label>' + errP(errs, 'cr-aceite') + '</div>';
  }

  const STEP_TEXT = {
    SALE: [['Produto', 'Conte o que você está vendendo.'], ['Cotas', 'Quantas unidades o lote tem e quantas precisam entrar para fechar.'], ['Degraus de preço', 'Quanto mais cotas, menor o preço para todos. O primeiro degrau é o preço inicial; o último é o preço-alvo.'], ['Prazos', 'Por quanto tempo a bolha fica aberta e em quanto tempo você envia.'], ['Revisão', 'Confira tudo antes de publicar.']],
    PURCHASE: [['Item', 'Descreva o que o grupo quer comprar.'], ['Cotas', 'Quantas unidades o grupo quer e o mínimo para fechar.'], ['Preço-alvo', 'O máximo por unidade. Empresas dão lances iguais ou menores.'], ['Prazos', 'Por quanto tempo a bolha recebe participantes e lances.'], ['Revisão', 'Confira tudo antes de publicar.']]
  };

  CR.render = (focusTitle) => {
    root = U.$('#view-page');
    if (!F) F = fresh();
    if (D.persona().kind === 'GUEST') {
      root.innerHTML = '<div class="page"><div class="page__wrap page__wrap--narrow"><div class="card card--pad" style="text-align:center"><h1 class="page-title" tabindex="-1" id="page-h">Entre para criar uma bolha</h1>' +
        '<p style="color:var(--text-2);margin:8px 0 18px">Para criar bolhas de venda, conclua o cadastro. Empresas passam pela verificação do CNPJ.</p>' +
        '<div class="map-empty__actions"><a class="btn btn--secondary" href="#/cadastro">Criar conta</a><button type="button" class="btn btn--primary" data-action="login-demo-page">Entrar como Carlos (demo)</button></div></div></div></div>';
      return;
    }
    const errs = F.tried ? errors(F.step) : [];
    const labels = LABELS[F.type], st = STEP_TEXT[F.type][F.step - 1];
    U.rerender(root,
      '<div class="page page--criar"><div class="page__wrap">' +
      '<div class="criar-head"><h1 class="page-title" id="page-h" tabindex="-1">Criar bolha de ' + (F.type === 'SALE' ? 'venda' : 'compra') + '</h1>' +
        '<p class="draft" role="status" id="cr-draft">' + (F.savedAt ? U.icon('check') + 'Rascunho salvo automaticamente às ' + F.savedAt : '') + '</p></div>' +
      '<div class="segmented criar-type" role="radiogroup" aria-label="Tipo de bolha">' +
        '<button type="button" role="radio" id="cr-type-sale" aria-checked="' + (F.type === 'SALE') + '"' + (F.type === 'SALE' ? '' : ' tabindex="-1"') + ' data-action="cr-type" data-t="SALE">' + U.icon('tag') + 'Venda (oferta de lote)</button>' +
        '<button type="button" role="radio" id="cr-type-buy" aria-checked="' + (F.type === 'PURCHASE') + '"' + (F.type === 'PURCHASE' ? '' : ' tabindex="-1"') + ' data-action="cr-type" data-t="PURCHASE">' + U.icon('cart') + 'Compra (pedido em grupo)</button></div>' +
      '<nav aria-label="Etapas da criação"><ol class="steps">' + labels.map((l, i) => {
        const n = i + 1, cur = n === F.step, done = n < F.step;
        return '<li><button type="button" class="steps__item' + (cur ? ' is-cur' : done ? ' is-done' : '') + '" data-action="cr-goto" data-step="' + n + '"' + (cur ? ' aria-current="step"' : '') + (n > F.step ? ' disabled' : '') + '>' +
          '<span class="steps__dot" aria-hidden="true">' + (done ? U.icon('check') : n) + '</span><span class="steps__lbl">' + l + '</span><span class="sr-only">' + (done ? ' (concluída)' : cur ? ' (atual)' : '') + '</span></button></li>';
      }).join('') + '</ol></nav>' +
      '<div class="criar-grid"><section class="card card--pad criar-form" aria-labelledby="cr-step-h">' +
        (errs.length ? '<div class="error-summary" role="alert" tabindex="-1" id="cr-sum"><strong>' + (errs.length === 1 ? 'Corrija 1 campo para continuar' : 'Corrija ' + errs.length + ' campos para continuar') + '</strong><ul>' +
          errs.map((x) => '<li><a href="#' + x.id + '" data-action="focus-field" data-target="' + x.id + '">' + U.esc(x.msg) + '</a></li>').join('') + '</ul></div>' : '') +
        '<div><h2 class="section-title" id="cr-step-h" tabindex="-1">' + st[0] + '</h2><p class="section-sub">' + st[1] + '</p></div>' +
        stepBody(errs) +
        '<div class="criar-actions">' + (F.step > 1 ? '<button type="button" class="btn btn--secondary" data-action="cr-back">Voltar</button>' : '<a class="btn btn--secondary" href="#/">Cancelar</a>') +
          '<button type="button" class="btn btn--primary" id="cr-next" data-action="cr-next"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? U.icon('loader', 'spinner') + 'Publicando…' : F.step === 5 ? 'Publicar bolha' : 'Continuar') + '</button></div>' +
      '</section>' +
      '<aside class="card card--pad criar-aside" aria-labelledby="cr-prev-h"><h2 class="section-title" id="cr-prev-h">Prévia</h2><div id="cr-preview">' + asideHTML() + '</div></aside>' +
      '</div></div></div>');
    BV.canvas.fitTexts(U.$('#cr-preview'));
    if (focusTitle) { const h = U.$(focusTitle === 'sum' ? '#cr-sum' : '#cr-step-h'); if (h) h.focus(); }
  };

  function touch() {
    F.savedAt = U.hhmm();
    const d = U.$('#cr-draft');
    if (d) d.innerHTML = U.icon('check') + 'Rascunho salvo automaticamente às ' + F.savedAt;
    const p = U.$('#cr-preview');
    if (p) { p.innerHTML = asideHTML(); BV.canvas.fitTexts(p); }
    if (F.tried) CR.render();
  }

  BV.inputs.cr = (el) => {
    F[el.dataset.k] = el.dataset.k === 'teto' ? Number(el.value) : el.value;
    if (el.dataset.k === 'title') { const c = U.$('#cr-title-count'); if (c) c.textContent = F.title.length + '/80'; }
    if (el.dataset.k === 'desc') { const c = U.$('#cr-desc-count'); if (c) c.textContent = F.desc.length.toLocaleString('pt-BR') + '/2.000 · estado, garantia, nota fiscal'; }
    if (el.dataset.k === 'teto') { const o = U.$('#cr-teto-out'), cap = U.num(F.cap); if (o) o.textContent = F.teto + '% · até ' + (isNaN(cap) ? '—' : Math.floor(cap * F.teto / 100)) + ' cotas'; el.setAttribute('aria-valuetext', F.teto + ' por cento'); }
    if (el.dataset.k === 'dur') { CR.render(); }
    touch();
  };
  BV.inputs['cr-tier'] = (el) => { F.tiers[Number(el.dataset.i)][el.dataset.k] = el.value; touch(); };
  BV.inputs['cr-aceite'] = (el) => { F.aceite = el.checked; if (F.tried) CR.render(); };
  BV.actions['cr-type'] = (btn) => { if (F.type === btn.dataset.t) return; F.type = btn.dataset.t; F.dur = '3d'; F.step = 1; F.tried = false; F.title = F.type === 'SALE' ? 'Fone Bluetooth XT-500' : '20 cadeiras de escritório'; F.desc = F.type === 'SALE' ? fresh().desc : 'Cadeiras com encosto em tela, braços ajustáveis e laudo NR-17, para entrega única em São Paulo.'; F.cap = F.type === 'SALE' ? '100' : '20'; F.meta = F.type === 'SALE' ? '40' : '10'; CR.render(); U.$('#' + btn.id).focus(); };
  BV.actions['cr-goto'] = (btn) => { const n = Number(btn.dataset.step); if (n < F.step) { F.step = n; F.tried = false; CR.render(true); } };
  BV.actions['cr-back'] = () => { F.step = Math.max(1, F.step - 1); F.tried = false; CR.render(true); };
  BV.actions['cr-photo-add'] = () => { F.photos = Math.min(5, F.photos + 1); CR.render(); U.announce('Foto ' + F.photos + ' adicionada.'); const a = U.$('#cr-photos'); if (a) a.focus(); };
  BV.actions['cr-photo-rm'] = () => { F.photos = Math.max(0, F.photos - 1); CR.render(); U.announce('Foto removida.'); const a = U.$('#cr-photos'); if (a) a.focus(); };
  BV.actions['cr-tier-add'] = () => {
    const last = F.tiers[F.tiers.length - 1], c = U.num(last.c), p = U.num(last.p);
    F.tiers.push({ c: isNaN(c) ? '' : String(c + 10), p: isNaN(p) ? '' : U.money(Math.max(1, p - 5)) });
    CR.render(); touch(); const n = U.$('#cr-tc' + (F.tiers.length - 1)); if (n) n.focus();
    U.announce('Degrau ' + F.tiers.length + ' adicionado.');
  };
  BV.actions['cr-tier-rm'] = (btn) => { F.tiers.splice(Number(btn.dataset.i), 1); CR.render(); touch(); U.$('#cr-tier-add').focus(); U.announce('Degrau removido.'); };
  BV.actions['focus-field'] = (a, e) => { e.preventDefault(); const t = document.getElementById(a.dataset.target); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } };
  BV.actions['cr-next'] = () => {
    if (errors(F.step).length) { F.tried = true; CR.render('sum'); return; }
    F.tried = false;
    if (F.step < 5) { F.step++; CR.render(true); return; }
    F.busy = true; CR.render();
    setTimeout(publish, 900);
  };
  BV.actions['login-demo-page'] = () => { BV.app.setPersona('pf'); CR.render(true); };

  function publish() {
    const id = 'nova-' + Date.now().toString(36);
    const durH = (DUR[F.type].find((d) => d[0] === F.dur) || DUR[F.type][1])[2];
    const sale = F.type === 'SALE', cap = U.num(F.cap);
    const spot = freeSpot(sale ? 170 : 160);
    const bb = {
      id, type: F.type, status: 'ACTIVE', title: F.title.trim(), short: shortTitle(F.title.trim()), category: F.cat, creator: D.persona().pseudo, creatorScore: D.persona().score || 700,
      desc: F.desc.trim(), max: cap, meta: U.num(F.meta), q: sale ? 0 : 1, reservedPix: 0, endsAt: Date.now() + durH * 3600000, ship: U.num(F.ship), pjCap: F.teto,
      tiers: F.tiers.map((t) => [U.num(t.c), U.num(t.p)]), alvo: U.num(F.alvo), bids: [], imgs: Math.max(1, F.photos), mine: sale ? {} : { [S.persona]: 1 },
      x: spot.x, y: spot.y, d: sale ? 170 : 160
    };
    S.bubbles.push(bb);
    BV.canvas.markNew(id);
    F = null;
    location.hash = '#/';
    setTimeout(() => { BV.detail.open(id); BV.canvas.centerOn(id, 1); U.toast('Bolha publicada! Ela já aparece no mapa.'); }, 80);
  }
  function shortTitle(t) { if (t.length <= 16) return t; const w = t.split(' '); let s = ''; for (const x of w) { if ((s + ' ' + x).trim().length > 16) break; s = (s + ' ' + x).trim(); } return s || t.slice(0, 15) + '…'; }
  function freeSpot(d) {
    const v = S.view, map = U.$('#map');
    const cx = ((map.clientWidth || 800) / 2 - v.x) / v.z, cy = ((map.clientHeight || 600) / 2 - v.y) / v.z;
    for (let r = 0; r < 1600; r += 40) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (S.bubbles.every((o) => Math.hypot(o.x - x, o.y - y) > (o.d + d) / 2 + 30)) return { x: Math.round(x), y: Math.round(y) };
        if (r === 0) break;
      }
    }
    return { x: cx, y: cy };
  }
  CR.reset = () => { F = null; };
})();
