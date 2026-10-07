/* Bolha Venda — tokens, componentes e estados (referência visual do protótipo). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util;
  BV.tokens = {
    render() {
      const now = Date.now();
      const base = { id: 'tk', status: 'ACTIVE', mine: {}, bids: [], creatorScore: 700, creator: 'Demo#0000', endsAt: now + 2 * 86400000 + 4 * 3600000 };
      const sale = Object.assign({}, base, { type: 'SALE', title: 'Fone XT-500', short: 'Fone XT-500', max: 100, meta: 40, q: 65, tiers: [[0, 100], [40, 90], [70, 80], [100, 75]] });
      const buy = Object.assign({}, base, { type: 'PURCHASE', title: '30 cadeiras', short: '30 cadeiras', max: 30, meta: 20, q: 12, alvo: 890 });
      const near = Object.assign({}, sale, { title: 'Kit café', short: 'Kit café', q: 86, tiers: [[0, 62], [50, 55], [90, 48]] });
      const exp = Object.assign({}, buy, { endsAt: now + 41 * 60000, q: 18 });
      const closed = Object.assign({}, sale, { status: 'CLOSED_OK', finalPrice: 189, short: 'Caixa de som', title: 'Caixa de som', q: 72, max: 80 });
      const sw = (name, hex, note) => '<div class="tk-sw"><div class="tk-sw__c" style="background:' + hex + '"></div><div class="tk-sw__t"><strong>' + name + '</strong>' + (note ? ' · ' + note : '') + '<br><span class="mono">' + hex.replace(/linear-gradient\(135deg, ?/, '').replace(')', '').replace(',', ' →') + '</span></div></div>';
      const cell = (bb, label, sub) => '<figure class="tk-bubble">' + BV.canvas.staticBubble(bb, 170) + '<figcaption><strong>' + label + '</strong><br>' + sub + '</figcaption></figure>';
      U.$('#view-page').innerHTML =
        '<div class="page"><div class="page__wrap">' +
        '<h1 class="page-title" id="page-h" tabindex="-1">Tokens, componentes e estados</h1>' +
        '<p style="color:var(--text-2)">Tema escuro do R1, com tema claro de apoio. Base: style guide e especificação de telas §1. Pares de texto e fundo com contraste AA.</p>' +
        '<section class="tk-sec" aria-labelledby="tk-c"><h2 class="section-title" id="tk-c">Cores</h2><div class="tk-grid">' +
          sw('canvas', '#0B0F19') + sw('surface', '#111827', 'painéis') + sw('surface-inset', '#0F172A') + sw('text / text-2', '#F1F5F9') +
          sw('primary (CTA)', 'linear-gradient(135deg,#2563EB,#7C3AED)', 'branco ≥ 5:1') + sw('focus-ring', '#FBBF24', '3 px') + '</div></section>' +
        '<section class="tk-sec" aria-labelledby="tk-b"><h2 class="section-title" id="tk-b">Bolhas de sabão: tipo + canal não cromático</h2>' +
          '<p class="section-sub">Película translúcida com borda colorida, reflexo iridescente e brilho especular. Flags são camadas e nunca trocam a cor do tipo. Ao encerrar, a bolha estoura em gotículas.</p>' +
          '<div class="tk-bubbles">' + cell(sale, 'Venda', '#3B82F6 → #8B5CF6 · borda sólida + etiqueta') + cell(buy, 'Compra', '#10B981 → #06B6D4 · borda tracejada + carrinho') +
          cell(near, 'Quase cheia (flag)', 'borda #F59E0B + selo') + cell(exp, 'Expirando (flag)', 'relógio vermelho + pulso') + cell(closed, 'Encerrada', 'cinza + ícone de concluída') + '</div>' +
          '<h3 class="d-sec-title" style="margin-top:22px">Nível de detalhe pelo tamanho na tela</h3><p class="section-sub">O texto nunca sai da bolha: com pouco espaço, mostra menos informação.</p>' +
          '<div class="tk-bubbles tk-bubbles--lod">' + [70, 110, 150, 210].map((d) => '<figure class="tk-bubble">' + BV.canvas.staticBubble(sale, d) + '<figcaption>' + d + ' px</figcaption></figure>').join('') + '</div></section>' +
        '<section class="tk-sec" aria-labelledby="tk-t"><h2 class="section-title" id="tk-t">Tipografia · Inter + JetBrains Mono</h2><div class="tk-grid">' +
          '<div class="card card--pad"><div style="font-size:28px;font-weight:800">Título de tela</div><span class="field__hint">28 / 800</span></div>' +
          '<div class="card card--pad"><div style="font-size:16px;font-weight:600">Título da bolha</div><span class="field__hint">16 / 600</span></div>' +
          '<div class="card card--pad"><div style="font-size:20px;font-weight:700">R$ 90,00</div><span class="field__hint">Preço 20 / 700</span></div>' +
          '<div class="card card--pad"><div class="mono" style="font-size:14px;font-weight:600">2d 04h 12m · 65/100</div><span class="field__hint">Contadores 14 / mono tabular</span></div></div></section>' +
        '<section class="tk-sec" aria-labelledby="tk-k"><h2 class="section-title" id="tk-k">Componentes e estados</h2><div class="tk-grid tk-grid--4">' +
          '<div class="card card--pad stack-8"><h3 class="d-sec-title">Botão primário</h3><button type="button" class="btn btn--primary">Padrão</button><button type="button" class="btn btn--primary" style="filter:brightness(1.15)">Hover (+15% brilho)</button>' +
            '<button type="button" class="btn btn--primary" style="outline:3px solid var(--focus);outline-offset:3px">Foco</button><button type="button" class="btn btn--primary" disabled>' + U.icon('loader', 'spinner') + 'Processando</button><button type="button" class="btn btn--primary" disabled>Desabilitado</button></div>' +
          '<div class="card card--pad stack-8"><h3 class="d-sec-title">Secundário, destrutivo, chip</h3><button type="button" class="btn btn--secondary">Secundário</button><button type="button" class="btn btn--danger">Sair da bolha</button>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="chip" aria-pressed="false">Chip desligado</button><button type="button" class="chip" aria-pressed="true">Chip ligado</button></div><p class="field__hint">Alvos de toque ≥ 44 × 44 px.</p></div>' +
          '<div class="card card--pad stack-8"><h3 class="d-sec-title">Campo de texto</h3><label class="sr-only" for="tk-i1">Padrão</label><input class="input" id="tk-i1" placeholder="Padrão">' +
            '<label class="sr-only" for="tk-i2">Erro</label><input class="input mono" id="tk-i2" value="R$ 95,00" aria-invalid="true" aria-describedby="tk-i2e"><p class="field__error" id="tk-i2e">' + U.icon('alert') + 'O preço precisa cair de um degrau para o seguinte.</p>' +
            '<label class="sr-only" for="tk-i3">Desabilitado</label><input class="input" id="tk-i3" value="Desabilitado (degrau fixo)" disabled></div>' +
          '<div class="card card--pad stack-8"><h3 class="d-sec-title">Avisos e feedback</h3><div class="banner banner--offline" style="border-radius:12px">Sem conexão. Os dados podem estar desatualizados.</div>' +
            '<div class="alert alert--warn">' + U.icon('alert') + '<span>12 envios vencem amanhã.</span></div><div class="alert alert--danger">' + U.icon('alert') + '<span>As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.</span></div>' +
            '<div class="toast" style="animation:none">' + U.icon('checkCircle') + '<span>Envio registrado. O comprador foi avisado.</span></div><div class="alert alert--info">' + U.icon('info') + '<span>Reservamos R$ 100,00 agora (preço inicial).</span></div></div>' +
        '</div></section>' +
        '<section class="tk-sec" aria-labelledby="tk-m"><h2 class="section-title" id="tk-m">Medidas</h2><dl class="kv kv--left card card--pad" style="max-width:520px"><dt>Raios</dt><dd class="mono">10 · 12 · 14 · 16 · 20 · 24 · 999</dd><dt>Espaços</dt><dd class="mono">4 · 8 · 12 · 16 · 20 · 24 · 32</dd>' +
          '<dt>Drawer</dt><dd class="mono">440 px (desktop) · 420 px (tablet) · sheet (mobile)</dd><dt>Breakpoints</dt><dd class="mono">&lt; 640 · 640–1023 · ≥ 1024</dd><dt>Movimento</dt><dd>200 ms ease-out · desligado com movimento reduzido</dd></dl></section>' +
        '</div></div>';
      U.$$('.b-static', U.$('#view-page')).forEach((b) => BV.canvas.fitTexts(b));
    }
  };
})();
