/* Bolha Venda — estado global, dados simulados e regras de domínio do protótipo. */
(function () {
  'use strict';
  const BV = window.BV;
  const U = BV.util;
  const now = Date.now();
  const MIN = 60000, H = 60 * MIN, DAY = 24 * H;

  BV.PERSONAS = {
    pf: { id: 'pf', kind: 'PF', name: 'Carlos Silva', first: 'Carlos', initials: 'CS', pseudo: 'Bolhista#4F2A', score: 742, band: 'Bom' },
    pj: { id: 'pj', kind: 'PJ', name: 'TecnoLotes Comércio Ltda', first: 'TecnoLotes', initials: 'TL', pseudo: 'TecnoLotes#9C1D', score: 702, band: 'Bom' },
    guest: { id: 'guest', kind: 'GUEST', name: 'Visitante', first: 'Entrar', initials: '?', pseudo: '', score: null, band: '' }
  };

  BV.CATEGORIES = ['Eletrônicos', 'Alimentos', 'Casa', 'Esporte', 'Móveis', 'Informática', 'Papelaria', 'Áudio'];
  BV.PRICE_RANGES = [
    { id: 'any', label: 'Qualquer preço', test: () => true },
    { id: 'lt100', label: 'Até R$ 100,00', test: (p) => p <= 100 },
    { id: '100to500', label: 'R$ 100,00 a R$ 500,00', test: (p) => p > 100 && p <= 500 },
    { id: 'gt500', label: 'Acima de R$ 500,00', test: (p) => p > 500 }
  ];

  const b = (o) => Object.assign({ status: 'ACTIVE', reservedPix: 0, mine: {}, imgs: 2, pjCap: 50, bids: [] }, o);

  BV.state = {
    persona: 'pf',
    theme: 'dark',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    canvasState: 'pronto',          // pronto | carregando | vazio | offline
    payScenario: 'normal',          // normal | esgotadas | recusado | pixoff
    liveSim: true,
    filters: { sale: true, buy: true, cats: [], price: 'any', mine: false, q: '' },
    view: { x: 0, y: 0, z: 1 },
    selectedId: null,
    detailFull: false,
    sort: 'time',
    listOrder: null,
    listChanged: new Set(),
    notifications: [
      { id: 'n1', unread: true, icon: 'tag', text: 'Fone XT-500 chegou a R$ 90,00 por cota.', when: 'há 12 min' },
      { id: 'n2', unread: true, icon: 'clock', text: '30 cadeiras termina em menos de 1 hora.', when: 'há 20 min' },
      { id: 'n3', unread: true, icon: 'truck', text: 'Seu pedido do lote de novembro foi enviado.', when: 'ontem' }
    ],
    bubbles: [
      b({ id: 'fone', type: 'SALE', title: 'Fone Bluetooth XT-500', short: 'Fone XT-500', category: 'Eletrônicos', creator: 'TecnoLotes#9C1D', creatorScore: 702,
        desc: 'Fone sem fio com cancelamento de ruído, 30 h de bateria e estojo de carga. Lote lacrado, nota fiscal e garantia de 12 meses.',
        max: 100, meta: 40, q: 65, reservedPix: 2, endsAt: now + 2 * DAY + 4 * H + 12 * MIN, ship: 7, tiers: [[0, 100], [40, 90], [70, 80], [100, 75]],
        x: 380, y: 300, d: 212, imgs: 3, mine: { pf: 1 } }),
      b({ id: 'cafe', type: 'SALE', title: 'Kit café especial 1 kg', short: 'Kit café', category: 'Alimentos', creator: 'TorraFina#21AB', creatorScore: 884,
        desc: 'Microlote da Mantiqueira de Minas, 86 pontos SCA. Torra da semana, em grãos ou moído.',
        max: 100, meta: 50, q: 84, endsAt: now + 9 * H + 12 * MIN, ship: 5, tiers: [[0, 62], [50, 55], [90, 48]], x: 860, y: 560, d: 184, pjCap: 30 }),
      b({ id: 'cadeiras', type: 'PURCHASE', title: '30 cadeiras ergonômicas', short: '30 cadeiras', category: 'Móveis', creator: 'Bolhista#4F2A', creatorScore: 742,
        desc: 'Demanda para renovar um escritório compartilhado. Encosto em tela, braços 3D, laudo NR-17 e entrega única em São Paulo.',
        max: 30, meta: 20, q: 18, endsAt: now + 42 * MIN, ship: 15, alvo: 890, x: 1020, y: 190, d: 196, imgs: 1, mine: { pf: 1 },
        bids: [
          { ps: 'Fornecedora#A1C3', band: 'Excelente', price: 799, days: 12, terms: 'Frete grátis para entrega única.' },
          { ps: 'MóveisPro#77D0', band: 'Bom', price: 845, days: 8, terms: 'Montagem inclusa.' },
          { ps: 'ErgoCia#3B19', band: 'Regular', price: 870, days: 15, terms: 'Garantia estendida de 3 anos.' }
        ] }),
      b({ id: 'tenis', type: 'SALE', title: 'Tênis de corrida RX Pro', short: 'Tênis RX', category: 'Esporte', creator: 'PassoCerto#0E77', creatorScore: 733,
        desc: 'Amortecimento responsivo, cabedal respirável e solado de borracha de alta tração. Grade do 36 ao 44.',
        max: 200, meta: 60, q: 12, endsAt: now + 4 * DAY + 11 * H, ship: 10, tiers: [[0, 329.9], [40, 289.9], [80, 259.9], [150, 239.9]], x: 150, y: 720, d: 166, imgs: 4 }),
      b({ id: 'notebook', type: 'PURCHASE', title: 'Notebooks 14" para escritório', short: 'Notebooks 14"', category: 'Informática', creator: 'Bolhista#B812', creatorScore: 548,
        desc: 'Notebooks com 16 GB de RAM, SSD de 512 GB e Windows Pro. Entrega com nota fiscal para CNPJ.',
        max: 20, meta: 10, q: 6, endsAt: now + 3 * DAY + 2 * H, ship: 20, alvo: 3200, x: 1290, y: 660, d: 156, imgs: 1,
        bids: [{ ps: 'InfoLote#5D02', band: 'Bom', price: 2980, days: 10, terms: 'Garantia on-site de 1 ano.' }] }),
      b({ id: 'garrafa', type: 'SALE', title: 'Garrafa térmica 750 ml', short: 'Garrafa', category: 'Casa', creator: 'CasaViva#8A30', creatorScore: 690,
        desc: 'Aço inox de parede dupla. Mantém gelado por 24 h e quente por 12 h.',
        max: 60, meta: 30, q: 40, endsAt: now + 1 * DAY + 6 * H, ship: 6, tiers: [[0, 79.9], [30, 69.9], [60, 59.9]], x: 660, y: 110, d: 124 }),
      b({ id: 'mochila', type: 'PURCHASE', title: 'Mochilas escolares', short: 'Mochilas', category: 'Papelaria', creator: 'Bolhista#D3C1', creatorScore: 655,
        desc: 'Mochilas resistentes com alças acolchoadas para o ano letivo. Cores variadas.',
        max: 40, meta: 20, q: 9, endsAt: now + 2 * DAY + 20 * H, ship: 10, alvo: 149.9, x: 590, y: 850, d: 118, imgs: 1 }),
      b({ id: 'caixa', type: 'SALE', status: 'CLOSED_OK', title: 'Caixa de som portátil 40 W', short: 'Caixa de som', category: 'Áudio', creator: 'SomMax#44E9', creatorScore: 712,
        desc: 'Resistente à água (IPX7), 24 h de bateria e pareamento estéreo.',
        max: 80, meta: 40, q: 72, endsAt: now - 2 * H, ship: 5, tiers: [[0, 229], [40, 199], [70, 189]], finalPrice: 189, x: 1360, y: 360, d: 128 }),
      b({ id: 'teclado', type: 'SALE', title: 'Teclado mecânico compacto 75%', short: 'Teclado 75%', category: 'Informática', creator: 'GamerGear#991A', creatorScore: 680,
        desc: 'Hot-swap, switches lineares e conexão tripla (2,4 GHz, Bluetooth e USB-C).',
        max: 100, meta: 60, q: 92, endsAt: now + 31 * MIN, ship: 5, tiers: [[0, 340], [60, 290], [90, 240], [100, 219]], x: 980, y: 900, d: 150 }),
      b({ id: 'relogio', type: 'SALE', title: 'Smartwatch AMOLED Sport', short: 'Smartwatch', category: 'Eletrônicos', creator: 'GadgetHub#55D1', creatorScore: 715,
        desc: 'Tela AMOLED de 1,96", GPS de dupla frequência e 14 dias de bateria.',
        max: 50, meta: 25, q: 12, endsAt: now + 3 * DAY + 4 * H, ship: 7, tiers: [[0, 420], [25, 350], [50, 299]], x: -110, y: 330, d: 142 })
    ]
  };

  /* ---------- Regras ---------- */
  const D = (BV.data = {});
  D.persona = () => BV.PERSONAS[BV.state.persona];
  D.find = (id) => BV.state.bubbles.find((x) => x.id === id);
  D.active = (bb) => bb.status === 'ACTIVE';
  D.left = (bb) => bb.endsAt - Date.now();
  D.isExp = (bb) => D.active(bb) && D.left(bb) < H;
  D.isNear = (bb) => D.active(bb) && bb.q / bb.max >= 0.8;
  D.mine = (bb) => (bb.mine && bb.mine[BV.state.persona]) || 0;
  D.isCreator = (bb) => bb.creator === D.persona().pseudo;
  D.reserve = (bb) => (bb.type === 'SALE' ? bb.tiers[0][1] : bb.alvo);
  D.pjLimit = (bb) => Math.floor((bb.max * bb.pjCap) / 100);
  D.band = (s) => (s >= 800 ? 'Excelente' : s >= 600 ? 'Bom' : s >= 400 ? 'Regular' : 'Risco');
  D.tier = (bb, q) => {
    q = q == null ? bb.q : q;
    let cur = 0;
    bb.tiers.forEach((t, i) => { if (q >= t[0]) cur = i; });
    const nx = bb.tiers[cur + 1];
    return { cur, price: bb.tiers[cur][1], next: nx ? { at: nx[0], price: nx[1], missing: nx[0] - q } : null };
  };
  D.bestBid = (bb) => (bb.bids && bb.bids.length ? bb.bids.slice().sort((a, c) => a.price - c.price)[0] : null);
  D.price = (bb) => {
    if (bb.status !== 'ACTIVE') return bb.finalPrice;
    return bb.type === 'SALE' ? D.tier(bb).price : bb.alvo;
  };
  D.priceForFilter = (bb) => (bb.type === 'SALE' ? D.price(bb) || bb.tiers[0][1] : bb.alvo);
  D.nextText = (bb) => {
    if (bb.status === 'CLOSED_OK') return 'Fechou a ' + U.brl(bb.finalPrice);
    if (bb.status === 'CLOSED_FAIL') return 'Não atingiu a meta';
    if (bb.type === 'SALE') {
      const t = D.tier(bb);
      return t.next ? 'Faltam ' + t.next.missing + (t.next.missing === 1 ? ' cota' : ' cotas') + ' para ' + U.brl(t.next.price) : 'Menor preço atingido';
    }
    return bb.q < bb.meta ? 'Faltam ' + (bb.meta - bb.q) + ' cotas para a meta' : 'Meta atingida';
  };
  D.typeLabel = (bb) => (bb.status !== 'ACTIVE' ? 'Encerrada' : bb.type === 'SALE' ? 'Venda' : 'Compra');
  D.ariaLabel = (bb) => {
    const parts = [D.typeLabel(bb) + ': ' + bb.title + '.'];
    if (bb.status === 'ACTIVE') {
      parts.push((bb.type === 'SALE' ? U.brl(D.price(bb)) + ' por cota' : 'Preço-alvo até ' + U.brl(bb.alvo)) + '.');
      parts.push(bb.q + ' de ' + bb.max + ' cotas, meta ' + bb.meta + (bb.q >= bb.meta ? ' atingida.' : '.'));
      parts.push('Termina em ' + U.left(D.left(bb)) + '.');
      if (D.isNear(bb)) parts.push('Quase cheia.');
      if (D.isExp(bb)) parts.push('Expirando.');
      if (D.mine(bb)) parts.push('Você participa.');
    } else if (bb.status === 'CLOSED_OK') parts.push('Fechou a ' + U.brl(bb.finalPrice) + ' por cota.');
    else parts.push('Não atingiu a meta.');
    return parts.join(' ');
  };
  D.visible = (bb) => {
    const f = BV.state.filters;
    if (bb.type === 'SALE' && !f.sale) return false;
    if (bb.type === 'PURCHASE' && !f.buy) return false;
    if (f.cats.length && f.cats.indexOf(bb.category) < 0) return false;
    const pr = BV.PRICE_RANGES.find((r) => r.id === f.price);
    if (pr && !pr.test(D.priceForFilter(bb))) return false;
    if (f.mine && !D.mine(bb) && !D.isCreator(bb)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      if ((bb.title + ' ' + bb.category + ' ' + bb.creator).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  };
  D.filtersActive = () => {
    const f = BV.state.filters;
    return (!f.sale || !f.buy ? 1 : 0) + f.cats.length + (f.price !== 'any' ? 1 : 0) + (f.mine ? 1 : 0);
  };
  D.participants = (bb) => {
    const names = ['Bolhista#4F2A', 'Ana#A3F1', 'Mercadão#11C0', 'Pedro#E7B2', 'Bolhista#77B0', 'Loja2B#5C21', 'Bolhista#C4E8', 'Marina#62AA', 'Rafael#1A9F', 'Bolhista#09DD'];
    return names.slice(0, Math.min(10, bb.q));
  };
})();
