/**
 * Bolha Venda - Hi-Fi Prototype Application Logic
 * S0 / Gate A Usability Testing Edition
 * Based on Spec F1-F10, ADR-0001 a ADR-0012, Style Guide e Especificação de Telas
 */

// Initial State and Mock Data
const State = {
  theme: 'dark', // 'dark' | 'light'
  reducedMotion: false,
  viewMode: 'canvas', // 'canvas' | 'list'
  currentPersona: 'pf', // 'pf' (Carlos) | 'pj' (TecnoLotes) | 'organizer' (Juliana)
  searchQuery: '',
  filterType: 'ALL', // 'ALL' | 'SALE' | 'PURCHASE' | 'NEAR_FULL' | 'EXPIRING'
  selectedBubbleId: 'B-001',
  isDrawerOpen: false,
  activeModal: null, // null | 'join' | 'pix' | 'exit' | 'create_sale' | 'create_purchase' | 'triage_seller' | 'triage_buyer' | 'score' | 'notifications'
  
  // Canvas Viewport State
  viewport: {
    x: 0,
    y: 0,
    zoom: 1.1,
    minZoom: 0.25,
    maxZoom: 2.2,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  },

  // User Profile Data
  user: {
    pseudonym: 'Bolhista#4F2A',
    name: 'Carlos Silva',
    cnpj: null,
    score: 742,
    scoreRating: 'Bom',
    participatingBubbleIds: ['B-001']
  },

  // Bubbles Collection
  bubbles: [
    {
      id: 'B-001',
      type: 'SALE',
      title: 'Fone Bluetooth Noise-Cancelling XT-500',
      category: 'Eletrônicos',
      creator: { name: 'TecnoLotes#9C1D', score: 702, rating: 'Bom' },
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80'
      ],
      description: 'Fone de alta fidelidade sonora com cancelamento ativo de ruído ANC 35dB, bateria de 40h e drivers de 40mm banhados a titânio. Lote com garantia nacional de 1 ano.',
      capacity: 100,
      meta: 40,
      currentQuotas: 65,
      reservedPixQuotas: 3,
      durationHoursLeft: 52,
      timeLeftFormatted: '2d 04h 12m',
      isNearFull: false,
      isExpiring: false,
      shippingDays: 7,
      maxPjShare: 50,
      tiers: [
        { quotas: 0, price: 100.00, label: 'Inicial' },
        { quotas: 40, price: 90.00, label: 'Meta' },
        { quotas: 70, price: 80.00, label: 'Degrau 3' },
        { quotas: 100, price: 75.00, label: 'Preço-Alvo' }
      ],
      x: 350,
      y: 280,
      radius: 120
    },
    {
      id: 'B-002',
      type: 'SALE',
      title: 'Kit Café Especial Arábica Microlote (5x 250g)',
      category: 'Alimentos',
      creator: { name: 'FazendaCafes#3B8A', score: 840, rating: 'Excelente' },
      images: [
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
      ],
      description: 'Torra fresca artesanal de cafés especiais premiados da Mantiqueira de Minas (86+ pontos SCA). Pacote fechado em grãos ou moído.',
      capacity: 100,
      meta: 50,
      currentQuotas: 84,
      reservedPixQuotas: 4,
      durationHoursLeft: 18,
      timeLeftFormatted: '18h 30m',
      isNearFull: true,
      isExpiring: false,
      shippingDays: 3,
      maxPjShare: 30,
      tiers: [
        { quotas: 0, price: 65.00, label: 'Inicial' },
        { quotas: 50, price: 54.00, label: 'Meta' },
        { quotas: 80, price: 45.00, label: 'Degrau 3' },
        { quotas: 100, price: 38.00, label: 'Alvo' }
      ],
      x: 750,
      y: 480,
      radius: 110
    },
    {
      id: 'B-003',
      type: 'PURCHASE',
      title: 'Lote de 30 Cadeiras Ergonômicas Mesh NR-17',
      category: 'Móveis Corporativos',
      creator: { name: 'JulianaRocha#E23A', score: 790, rating: 'Excelente' },
      images: [
        'https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=800&q=80'
      ],
      description: 'Demanda consolidada para renovação de escritório compartilhado. Exige laudo ergonômico NR-17, base em alumínio e braços 3D com entrega única em SP Capital.',
      capacity: 30,
      meta: 15,
      currentQuotas: 18,
      reservedPixQuotas: 0,
      durationHoursLeft: 0.7,
      timeLeftFormatted: '42 min',
      isNearFull: false,
      isExpiring: true,
      targetPrice: 890.00,
      shippingDays: 15,
      bids: [
        { bidder: 'MoveisOffice#4A11', score: 760, price: 790.00, deliveryDays: 12, terms: 'Frete grátis para lote único', isWinner: false },
        { bidder: 'ErgoTech#89CF', score: 810, price: 820.00, deliveryDays: 10, terms: 'Garantia estendida 3 anos', isWinner: false },
        { bidder: 'MobiliCorp#1044', score: 690, price: 850.00, deliveryDays: 14, terms: 'Montagem inclusa', isWinner: false }
      ],
      x: 880,
      y: 160,
      radius: 95
    },
    {
      id: 'B-004',
      type: 'SALE',
      title: 'Teclado Mecânico Compacto Wireless RGB Pro',
      category: 'Informática',
      creator: { name: 'GamerGear#991A', score: 680, rating: 'Regular' },
      images: [
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'
      ],
      description: 'Layout 75% hot-swappable com switches magnéticos e conectividade tri-mode (2.4Ghz, BT 5.3 e Type-C).',
      capacity: 100,
      meta: 60,
      currentQuotas: 98,
      reservedPixQuotas: 2,
      durationHoursLeft: 0.5,
      timeLeftFormatted: '30 min',
      isNearFull: true,
      isExpiring: true,
      shippingDays: 5,
      maxPjShare: 40,
      tiers: [
        { quotas: 0, price: 340.00, label: 'Inicial' },
        { quotas: 60, price: 290.00, label: 'Meta' },
        { quotas: 90, price: 240.00, label: 'Degrau 3' },
        { quotas: 100, price: 219.00, label: 'Alvo' }
      ],
      x: 220,
      y: 650,
      radius: 115
    },
    {
      id: 'B-005',
      type: 'SALE',
      title: 'Smartwatch Curvo AMOLED IP68 Sport Edition',
      category: 'Eletrônicos',
      creator: { name: 'GadgetHub#55D1', score: 715, rating: 'Bom' },
      images: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'
      ],
      description: 'Display 1.96 polegadas com medição contínua de SpO2 e ECG, GPS dual-band integrado e 14 dias de bateria.',
      capacity: 50,
      meta: 25,
      currentQuotas: 12,
      reservedPixQuotas: 1,
      durationHoursLeft: 76,
      timeLeftFormatted: '3d 04h',
      isNearFull: false,
      isExpiring: false,
      shippingDays: 7,
      maxPjShare: 50,
      tiers: [
        { quotas: 0, price: 420.00, label: 'Inicial' },
        { quotas: 25, price: 350.00, label: 'Meta' },
        { quotas: 50, price: 299.00, label: 'Alvo' }
      ],
      x: -120,
      y: 240,
      radius: 90
    },
    {
      id: 'B-006',
      type: 'SALE',
      title: 'Caixa de Som Portátil 40W Bluetooth Pro',
      category: 'Áudio',
      creator: { name: 'AudioPrime#12AA', score: 880, rating: 'Excelente' },
      images: [
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80'
      ],
      description: 'Resistência à água IPX7, bateria de 24h contínuas e pareamento estéreo duplo.',
      capacity: 50,
      meta: 30,
      currentQuotas: 50,
      reservedPixQuotas: 0,
      durationHoursLeft: 0,
      timeLeftFormatted: 'Encerrada',
      isExpired: true,
      hasSucceeded: true,
      finalPrice: 80.00,
      shippingDays: 5,
      maxPjShare: 50,
      tiers: [
        { quotas: 0, price: 120.00, label: 'Inicial' },
        { quotas: 30, price: 95.00, label: 'Meta' },
        { quotas: 50, price: 80.00, label: 'Alvo' }
      ],
      x: 520,
      y: -80,
      radius: 105
    }
  ],

  // Seller triage orders (for B-001 or B-006)
  triageOrders: [
    { id: 'ORD-701', buyer: 'Carlos Silva', pseudonym: 'Bolhista#4F2A', quotas: 1, paid: 80.00, status: 'WAITING_SHIPMENT', isLate: false, address: 'Rua das Flores, 120 - São Paulo/SP' },
    { id: 'ORD-702', buyer: 'Mercadão Ltda', pseudonym: 'MercadaoPJ#10A', quotas: 10, paid: 800.00, status: 'WAITING_SHIPMENT', isLate: false, address: 'Av. Paulista, 1000 - Cj 42 - São Paulo/SP' },
    { id: 'ORD-703', buyer: 'Ana Pereira', pseudonym: 'Bolhista#77B0', quotas: 1, paid: 80.00, status: 'SHIPPED', trackingCode: 'QB124987654BR', eta: '04/12/2026', address: 'Rua Bela Cintra, 450 - SP' },
    { id: 'ORD-704', buyer: 'Marcos Souza', pseudonym: 'Bolhista#99CC', quotas: 1, paid: 80.00, status: 'DELIVERED', deliveryDate: '01/12/2026', address: 'Rua do Ouvidor, 12 - RJ' },
    { id: 'ORD-705', buyer: 'Luciana Ramos', pseudonym: 'Bolhista#5F3D', quotas: 1, paid: 80.00, status: 'CASE_OPEN', caseReason: 'Produto não recebido', address: 'Av. Ipiranga, 200 - SP' }
  ]
};

// Utilities & Calculations
function calculateCurrentPrice(bubble) {
  if (bubble.type === 'PURCHASE') {
    if (!bubble.bids || bubble.bids.length === 0) return bubble.targetPrice;
    const lowest = Math.min(...bubble.bids.map(b => b.price));
    return lowest;
  }
  // SALE
  let price = bubble.tiers[0].price;
  for (const tier of bubble.tiers) {
    if (bubble.currentQuotas >= tier.quotas) {
      price = tier.price;
    }
  }
  return price;
}

function getNextTierInfo(bubble) {
  if (bubble.type !== 'SALE') return null;
  for (const tier of bubble.tiers) {
    if (bubble.currentQuotas < tier.quotas) {
      return {
        remainingQuotas: tier.quotas - bubble.currentQuotas,
        targetPrice: tier.price
      };
    }
  }
  return null;
}

function formatBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Lifecycle Init
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  renderBubbleDetails();
  renderListView();
  setupEventListeners();
  updateHeaderUserInfo();
  centerCanvasOnBubble('B-001');
});

// Canvas Engine Implementation
let canvasEl, ctx;
let animationFrameId;

function initCanvas() {
  canvasEl = document.getElementById('bubble-canvas');
  if (!canvasEl) return;
  ctx = canvasEl.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Dragging / Pan
  canvasEl.addEventListener('mousedown', (e) => {
    State.viewport.isDragging = true;
    State.viewport.dragStartX = e.clientX - State.viewport.x;
    State.viewport.dragStartY = e.clientY - State.viewport.y;
    canvasEl.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!State.viewport.isDragging) return;
    State.viewport.x = e.clientX - State.viewport.dragStartX;
    State.viewport.y = e.clientY - State.viewport.dragStartY;
    drawCanvas();
    drawMinimap();
  });

  window.addEventListener('mouseup', () => {
    if (State.viewport.isDragging) {
      State.viewport.isDragging = false;
      canvasEl.style.cursor = 'grab';
    }
  });

  // Touch Support
  canvasEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      State.viewport.isDragging = true;
      State.viewport.dragStartX = e.touches[0].clientX - State.viewport.x;
      State.viewport.dragStartY = e.touches[0].clientY - State.viewport.y;
    }
  });

  canvasEl.addEventListener('touchmove', (e) => {
    if (!State.viewport.isDragging || e.touches.length !== 1) return;
    State.viewport.x = e.touches[0].clientX - State.viewport.dragStartX;
    State.viewport.y = e.touches[0].clientY - State.viewport.dragStartY;
    drawCanvas();
    drawMinimap();
  });

  canvasEl.addEventListener('touchend', () => {
    State.viewport.isDragging = false;
  });

  // Zoom with Wheel
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    applyZoom(zoomFactor, e.clientX, e.clientY);
  });

  // Click on Bubble Detection
  canvasEl.addEventListener('click', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert Screen to World Space
    const worldX = (clickX - State.viewport.x) / State.viewport.zoom;
    const worldY = (clickY - State.viewport.y) / State.viewport.zoom;

    // Find clicked bubble
    for (let i = State.bubbles.length - 1; i >= 0; i--) {
      const b = State.bubbles[i];
      const dist = Math.hypot(worldX - b.x, worldY - b.y);
      if (dist <= b.radius) {
        selectBubble(b.id);
        return;
      }
    }
  });

  // Animation Loop for Physics and Live Floating
  let tick = 0;
  function loop() {
    tick++;
    if (!State.reducedMotion && tick % 2 === 0) {
      // gentle floating physics
      State.bubbles.forEach((b, idx) => {
        b.floatOffset = Math.sin((tick * 0.03) + idx) * 3;
      });
    }
    drawCanvas();
    drawMinimap();
    animationFrameId = requestAnimationFrame(loop);
  }
  loop();
}

function resizeCanvas() {
  if (!canvasEl) return;
  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;
  drawCanvas();
  drawMinimap();
}

function applyZoom(factor, centerX = window.innerWidth / 2, centerY = window.innerHeight / 2) {
  const oldZoom = State.viewport.zoom;
  let newZoom = oldZoom * factor;
  newZoom = Math.max(State.viewport.minZoom, Math.min(State.viewport.maxZoom, newZoom));

  // Zoom relative to point
  State.viewport.x = centerX - (centerX - State.viewport.x) * (newZoom / oldZoom);
  State.viewport.y = centerY - (centerY - State.viewport.y) * (newZoom / oldZoom);
  State.viewport.zoom = newZoom;

  document.getElementById('zoom-level-text').textContent = `${Math.round(newZoom * 100)}%`;
  drawCanvas();
  drawMinimap();
}

function centerCanvasOnBubble(bubbleId) {
  const bubble = State.bubbles.find(b => b.id === bubbleId);
  if (!bubble) return;
  State.viewport.x = (window.innerWidth / 2) - (bubble.x * State.viewport.zoom);
  State.viewport.y = (window.innerHeight / 2) - (bubble.y * State.viewport.zoom);
  drawCanvas();
  drawMinimap();
}

// Draw Infinite Canvas & Bubbles
function drawCanvas() {
  if (!ctx || !canvasEl) return;
  const isDark = State.theme === 'dark';

  // 1. Clear & Background
  ctx.fillStyle = isDark ? '#0B0F19' : '#F8FAFC';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // 2. Draw Subtle Grid
  drawGrid(isDark);

  // 3. Transform World Coordinates
  ctx.save();
  ctx.translate(State.viewport.x, State.viewport.y);
  ctx.scale(State.viewport.zoom, State.viewport.zoom);

  // 4. Render Bubbles according to LOD
  State.bubbles.forEach(b => {
    // Filter matching
    if (!matchesFilter(b)) return;
    drawBubble(b, isDark);
  });

  ctx.restore();
}

function drawGrid(isDark) {
  const gridSize = 48 * State.viewport.zoom;
  const offsetX = State.viewport.x % gridSize;
  const offsetY = State.viewport.y % gridSize;

  ctx.beginPath();
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1;

  for (let x = offsetX; x < canvasEl.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasEl.height);
  }
  for (let y = offsetY; y < canvasEl.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvasEl.width, y);
  }
  ctx.stroke();
}

function matchesFilter(b) {
  if (State.searchQuery) {
    const q = State.searchQuery.toLowerCase();
    const match = b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
    if (!match) return false;
  }
  if (State.filterType === 'SALE' && b.type !== 'SALE') return false;
  if (State.filterType === 'PURCHASE' && b.type !== 'PURCHASE') return false;
  if (State.filterType === 'NEAR_FULL' && !b.isNearFull) return false;
  if (State.filterType === 'EXPIRING' && !b.isExpiring) return false;
  if (State.filterType === 'MINE' && !State.user.participatingBubbleIds.includes(b.id)) return false;
  return true;
}

function drawBubble(bubble, isDark) {
  const cy = bubble.y + (bubble.floatOffset || 0);
  const cx = bubble.x;
  const r = bubble.radius;
  const zoom = State.viewport.zoom;
  const isSelected = bubble.id === State.selectedBubbleId;

  ctx.save();

  // Selection Glow Halo
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fillStyle = bubble.type === 'SALE' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(16, 185, 129, 0.35)';
    ctx.fill();
  }

  // 1. Bubble Gradient Fill
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  if (bubble.isExpired) {
    grad.addColorStop(0, '#64748B');
    grad.addColorStop(1, '#475569');
  } else if (bubble.type === 'SALE') {
    grad.addColorStop(0, '#3B82F6');
    grad.addColorStop(1, '#8B5CF6');
  } else {
    grad.addColorStop(0, '#10B981');
    grad.addColorStop(1, '#06B6D4');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.globalAlpha = bubble.isExpired ? 0.65 : 0.95;
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // 2. Stroke / Border Flags
  ctx.lineWidth = 4;
  if (bubble.isNearFull) {
    ctx.strokeStyle = '#F59E0B'; // Âmbar warning
    ctx.setLineDash([]);
    ctx.stroke();
  } else if (bubble.type === 'PURCHASE') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.setLineDash([8, 6]); // Tracejado obrigatório da Spec
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();
  }

  // 3. Circular Progress Ring (Quota completion)
  const progressPercent = Math.min(1, bubble.currentQuotas / bubble.capacity);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * progressPercent);

  // Outer ring background
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Progress arc
  if (progressPercent > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, startAngle, endAngle);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Meta marker position on ring
  const metaPercent = bubble.meta / bubble.capacity;
  const metaAngle = startAngle + (Math.PI * 2 * metaPercent);
  const metaX = cx + (r + 4) * Math.cos(metaAngle);
  const metaY = cy + (r + 4) * Math.sin(metaAngle);

  ctx.beginPath();
  ctx.arc(metaX, metaY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#10B981';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Overlaid Flag Badges (Quase cheia / Expirando)
  if (bubble.isNearFull) {
    drawBadge(cx, cy - r + 10, 'QUASE CHEIA', '#F59E0B', '#FFFFFF');
  }
  if (bubble.isExpiring) {
    drawBadge(cx, cy + r - 10, `⏱ ${bubble.timeLeftFormatted}`, '#EF4444', '#FFFFFF');
  }

  // 5. LOD Content Rendering
  renderBubbleLODText(bubble, cx, cy, r, zoom);

  ctx.restore();
}

function drawBadge(x, y, text, bgColor, textColor) {
  ctx.save();
  ctx.font = '600 10px Inter, sans-serif';
  const width = ctx.measureText(text).width + 14;
  const height = 18;

  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 9);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function renderBubbleLODText(bubble, cx, cy, r, zoom) {
  const currentPrice = calculateCurrentPrice(bubble);

  // LOD Low (< 0.4x): Only Icon & Quotas count
  if (zoom < 0.45) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.type === 'SALE' ? '🏷' : '🛒', cx, cy - 10);
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(`${bubble.currentQuotas}/${bubble.capacity}`, cx, cy + 16);
    return;
  }

  // LOD Medium (0.45x - 0.95x): Type badge, Short Title, Price, Time
  if (zoom < 0.95) {
    // Type Tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bubble.type === 'SALE' ? '🏷 VENDA' : '🛒 COMPRA', cx, cy - 35);

    // Short Title (truncated)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 14px Inter, sans-serif';
    const shortTitle = bubble.title.length > 22 ? bubble.title.substring(0, 20) + '…' : bubble.title;
    ctx.fillText(shortTitle, cx, cy - 14);

    // Current Price
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(formatBRL(currentPrice), cx, cy + 12);

    // Quotas fraction
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`◔ ${bubble.currentQuotas}/${bubble.capacity} cotas`, cx, cy + 32);
    return;
  }

  // LOD High (> 0.95x): Full specs, next tier progress, author
  // Type Tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '800 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(bubble.type === 'SALE' ? '🏷 OFERTA DE VENDA' : '🛒 COMPRA COLETIVA', cx, cy - 52);

  // Title with wrapping
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 14px Inter, sans-serif';
  wrapText(ctx, bubble.title, cx, cy - 34, r * 1.5, 17, 2);

  // Current Price Label & Value
  ctx.font = '500 10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(bubble.type === 'SALE' ? 'SE FECHAR AGORA' : 'MELHOR LANCE ATUAL', cx, cy + 6);

  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(formatBRL(currentPrice), cx, cy + 27);

  // Next Tier or Quotas Status
  ctx.font = '600 12px "JetBrains Mono", monospace';
  if (bubble.type === 'SALE') {
    const nextTier = getNextTierInfo(bubble);
    if (nextTier) {
      ctx.fillStyle = '#FDE047'; // Soft yellow highlight
      ctx.fillText(`↓ Faltam ${nextTier.remainingQuotas} para ${formatBRL(nextTier.targetPrice)}`, cx, cy + 46);
    } else {
      ctx.fillStyle = '#86EFAC';
      ctx.fillText(`★ Degrau máximo atingido!`, cx, cy + 46);
    }
  } else {
    ctx.fillStyle = '#A7F3D0';
    ctx.fillText(`${bubble.bids ? bubble.bids.length : 0} lances recebidos`, cx, cy + 46);
  }

  // Quotas count & Time
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(`◔ ${bubble.currentQuotas} de ${bubble.capacity} (meta ${bubble.meta}) · ⏱ ${bubble.timeLeftFormatted}`, cx, cy + 64);
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = text.split(' ');
  let line = '';
  let linesCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
      linesCount++;
      if (linesCount >= maxLines - 1 && n < words.length - 1) {
        // truncate remaining
        let rem = words.slice(n).join(' ');
        while (context.measureText(rem + '…').width > maxWidth && rem.length > 0) {
          rem = rem.slice(0, -1);
        }
        context.fillText(rem + '…', x, y);
        return;
      }
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}

// Minimap Rendering
function drawMinimap() {
  const miniEl = document.getElementById('minimap-canvas');
  if (!miniEl) return;
  const mCtx = miniEl.getContext('2d');
  const w = miniEl.width;
  const h = miniEl.height;

  mCtx.clearRect(0, 0, w, h);
  mCtx.fillStyle = State.theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(241, 245, 249, 0.9)';
  mCtx.fillRect(0, 0, w, h);

  // World bounds estimate
  const worldMinX = -300;
  const worldMaxX = 1200;
  const worldMinY = -200;
  const worldMaxY = 900;
  const worldW = worldMaxX - worldMinX;
  const worldH = worldMaxY - worldMinY;

  // Draw bubble dots
  State.bubbles.forEach(b => {
    const mx = ((b.x - worldMinX) / worldW) * w;
    const my = ((b.y - worldMinY) / worldH) * h;
    mCtx.beginPath();
    mCtx.arc(mx, my, b.id === State.selectedBubbleId ? 4 : 2.5, 0, Math.PI * 2);
    mCtx.fillStyle = b.type === 'SALE' ? '#3B82F6' : '#10B981';
    mCtx.fill();
  });

  // Draw Current Viewport Box
  const screenLeftInWorld = (-State.viewport.x) / State.viewport.zoom;
  const screenTopInWorld = (-State.viewport.y) / State.viewport.zoom;
  const screenRightInWorld = (canvasEl.width - State.viewport.x) / State.viewport.zoom;
  const screenBottomInWorld = (canvasEl.height - State.viewport.y) / State.viewport.zoom;

  const vx = ((screenLeftInWorld - worldMinX) / worldW) * w;
  const vy = ((screenTopInWorld - worldMinY) / worldH) * h;
  const vw = ((screenRightInWorld - screenLeftInWorld) / worldW) * w;
  const vh = ((screenBottomInWorld - screenTopInWorld) / worldH) * h;

  mCtx.strokeStyle = '#38BDF8';
  mCtx.lineWidth = 1.5;
  mCtx.strokeRect(vx, vy, vw, vh);
}

// Select Bubble & Open Drawer
function selectBubble(id) {
  State.selectedBubbleId = id;
  State.isDrawerOpen = true;
  renderBubbleDetails();
  const drawer = document.getElementById('bubble-drawer');
  if (drawer) {
    drawer.classList.remove('translate-x-full', 'translate-y-full');
  }
  drawCanvas();
  drawMinimap();
}

function closeDrawer() {
  State.isDrawerOpen = false;
  const drawer = document.getElementById('bubble-drawer');
  if (drawer) {
    drawer.classList.add('translate-x-full');
  }
  drawCanvas();
}

// Render Bubble Details Screen (T03 / T03b)
function renderBubbleDetails() {
  const container = document.getElementById('drawer-content');
  if (!container) return;

  const bubble = State.bubbles.find(b => b.id === State.selectedBubbleId);
  if (!bubble) return;

  const currentPrice = calculateCurrentPrice(bubble);
  const nextTier = getNextTierInfo(bubble);
  const isParticipant = State.user.participatingBubbleIds.includes(bubble.id);

  let html = `
    <!-- Top Header -->
    <div class="p-6 border-b border-slate-700/60">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
          bubble.type === 'SALE' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }">
          ${bubble.type === 'SALE' ? '🏷 OFERTA DE VENDA' : '🛒 COMPRA COLETIVA'}
        </span>
        <button onclick="closeDrawer()" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition" aria-label="Fechar gaveta">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <h1 class="text-xl font-bold text-white mb-2 leading-snug">${bubble.title}</h1>
      
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span>por <strong class="text-slate-200">${bubble.creator.name}</strong></span>
        <span>•</span>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          ★ Score ${bubble.creator.score} (${bubble.creator.rating})
        </span>
      </div>
    </div>

    <!-- Scrollable Body -->
    <div class="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-230px)]">
      <!-- Image Gallery -->
      <div class="relative rounded-xl overflow-hidden bg-slate-800/80 border border-slate-700/50 aspect-video">
        <img src="${bubble.images[0]}" alt="${bubble.title}" class="w-full h-full object-cover">
        <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-slate-200">
          1 de ${bubble.images.length} fotos
        </div>
      </div>

      <!-- Price Focus Box -->
      <div class="p-5 rounded-xl bg-slate-800/60 border border-slate-700/80">
        <div class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
          ${bubble.type === 'SALE' ? 'Se fechar agora por cota' : 'Preço-Alvo Máximo por cota'}
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono-numbers text-white">${formatBRL(currentPrice)}</span>
          ${bubble.type === 'SALE' && bubble.tiers[0].price !== currentPrice ? `
            <span class="text-sm line-through text-slate-500 font-mono-numbers">${formatBRL(bubble.tiers[0].price)}</span>
          ` : ''}
        </div>

        ${bubble.type === 'SALE' && nextTier ? `
          <div class="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
            <span>Faltam <strong>${nextTier.remainingQuotas} cotas</strong> para o próximo degrau:</span>
            <span class="font-bold font-mono-numbers text-white">${formatBRL(nextTier.targetPrice)}</span>
          </div>
        ` : ''}
      </div>

      <!-- Quotas Progress Bar with Meta -->
      <div class="space-y-2">
        <div class="flex justify-between text-xs text-slate-300 font-medium">
          <span>Progresso de Cotas</span>
          <span class="font-mono-numbers"><strong>${bubble.currentQuotas}</strong> de ${bubble.capacity} cotas</span>
        </div>
        <div class="relative w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
          <div class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style="width: ${(bubble.currentQuotas / bubble.capacity) * 100}%"></div>
          <!-- Meta Marker -->
          <div class="absolute top-0 bottom-0 w-1 bg-emerald-400 shadow-sm z-10" style="left: ${(bubble.meta / bubble.capacity) * 100}%" title="Meta mínima de ${bubble.meta} cotas"></div>
        </div>
        <div class="flex justify-between items-center text-xs">
          <span class="text-emerald-400 font-medium flex items-center gap-1">
            ▲ Meta: ${bubble.meta} cotas (${bubble.currentQuotas >= bubble.meta ? 'Atingida ✓' : 'Pendente'})
          </span>
          <span class="text-slate-400 font-mono-numbers">⏱ Termina em ${bubble.timeLeftFormatted}</span>
        </div>
      </div>
  `;

  // Sale Price Tiers Ladder vs Purchase Bids Tab
  if (bubble.type === 'SALE') {
    html += `
      <!-- Price Ladder (Escada de Degraus) -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Escada de Degraus de Preço</h3>
        <div class="space-y-2">
          ${bubble.tiers.map((t, i) => {
            const isReached = bubble.currentQuotas >= t.quotas;
            const isCurrent = currentPrice === t.price;
            return `
              <div class="p-3 rounded-lg border flex items-center justify-between text-sm ${
                isCurrent 
                  ? 'bg-blue-600/20 border-blue-500/50 text-white font-semibold' 
                  : isReached 
                    ? 'bg-slate-800/40 border-slate-700/50 text-slate-300' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }">
                <div class="flex items-center gap-2">
                  <span class="${isReached ? 'text-emerald-400 font-bold' : 'text-slate-600'}">
                    ${isReached ? '✓' : '○'}
                  </span>
                  <span>A partir de <strong>${t.quotas} cotas</strong> ${t.quotas === bubble.meta ? '(Meta)' : ''}</span>
                </div>
                <div class="flex items-center gap-2 font-mono-numbers">
                  <span class="text-base font-bold">${formatBRL(t.price)}</span>
                  ${isCurrent ? '<span class="text-xs px-2 py-0.5 rounded bg-blue-500 text-white font-bold">Atual</span>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    // PURCHASE BIDS TAB (T03b)
    html += `
      <!-- Bids Received Tab -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Lances de Fornecedores (${bubble.bids.length})</h3>
          ${State.currentPersona === 'pj' ? `
            <button onclick="openModal('bid')" class="text-xs text-blue-400 hover:text-blue-300 font-semibold">+ Enviar Lance PJ</button>
          ` : ''}
        </div>
        <div class="space-y-2">
          ${bubble.bids.map(bid => `
            <div class="p-3.5 rounded-lg bg-slate-800/50 border border-slate-700/60 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200 text-sm">${bid.bidder}</span>
                <span class="font-mono-numbers text-emerald-400 font-bold text-base">${formatBRL(bid.price)}</span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>Prazo: ${bid.deliveryDays} dias</span>
                <span>Score: ★ ${bid.score}</span>
              </div>
              <p class="text-xs text-slate-400 italic">"${bid.terms}"</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Terms & Guarantees Disclosures
  html += `
      <!-- Policy Disclosure -->
      <div class="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-2.5 text-xs text-slate-300">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p><strong>Como funciona a reserva:</strong> Pré-autorizamos o valor inicial no cartão ou Pix reservado. Você só paga o preço final da bolha atingido na explosão (diferença liberada automaticamente).</p>
        </div>
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <p><strong>Prazo de envio:</strong> Em até ${bubble.shippingDays} dias úteis após a explosão da bolha.</p>
        </div>
      </div>

      <!-- Description -->
      <div class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Descrição do Produto</h3>
        <p class="text-sm text-slate-300 leading-relaxed">${bubble.description}</p>
      </div>
    </div>

    <!-- Fixed Action Footer -->
    <div class="p-6 border-t border-slate-700/60 bg-slate-900/90 backdrop-blur">
  `;

  if (bubble.isExpired) {
    html += `
      <div class="flex items-center justify-between">
        <div class="text-sm text-slate-300">
          Bolha encerrada a <strong class="text-white font-mono-numbers">${formatBRL(bubble.finalPrice)}</strong>
        </div>
        <button onclick="openModal('triage_seller')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-lg shadow-indigo-500/20 transition">
          Ver Triagem do Vendedor
        </button>
      </div>
    `;
  } else if (isParticipant) {
    html += `
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs text-slate-300">
          <span class="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Você está nesta bolha (1 cota)
          </span>
          <button onclick="openModal('triage_buyer')" class="text-blue-400 hover:underline">Ver status</button>
        </div>
        <div class="flex gap-3">
          <button onclick="openModal('exit')" class="w-full py-3 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-sm font-semibold transition">
            Sair da Bolha
          </button>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs text-slate-400">Reserva Inicial</div>
          <div class="text-lg font-bold font-mono-numbers text-white">${formatBRL(bubble.tiers ? bubble.tiers[0].price : bubble.targetPrice)}</div>
        </div>
        <button onclick="openModal('join')" class="flex-1 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-base shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2">
          <span>Entrar na Bolha</span>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// Render Alternative List View (T02)
function renderListView() {
  const container = document.getElementById('list-view-container');
  if (!container) return;

  const filtered = State.bubbles.filter(matchesFilter);

  let html = `
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold text-white">Todas as Bolhas Ativas</h2>
          <p class="text-sm text-slate-400">${filtered.length} ofertas e demandas no radar</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-xs text-slate-400">Ordenar por:</label>
          <select id="list-sort-select" onchange="sortListView(this.value)" class="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-blue-500">
            <option value="time">Termina antes (urgência)</option>
            <option value="price_asc">Menor Preço</option>
            <option value="progress">Mais perto da meta</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${filtered.map(b => {
          const currentPrice = calculateCurrentPrice(b);
          const nextTier = getNextTierInfo(b);
          return `
            <div onclick="selectBubble('${b.id}')" class="group cursor-pointer rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 hover:border-blue-500/50 p-5 transition-all shadow-lg flex flex-col justify-between">
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    b.type === 'SALE' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                  }">
                    ${b.type === 'SALE' ? '🏷 Venda' : '🛒 Compra'}
                  </span>
                  <span class="text-xs font-mono-numbers text-slate-400">⏱ ${b.timeLeftFormatted}</span>
                </div>

                <div class="h-36 rounded-xl overflow-hidden bg-slate-900 relative">
                  <img src="${b.images[0]}" alt="${b.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                  ${b.isNearFull ? `
                    <div class="absolute top-2 left-2 bg-amber-500 text-white font-bold text-xs px-2 py-0.5 rounded shadow">Quase cheia</div>
                  ` : ''}
                  ${b.isExpiring ? `
                    <div class="absolute top-2 right-2 bg-rose-600 text-white font-bold text-xs px-2 py-0.5 rounded shadow animate-pulse">Expirando</div>
                  ` : ''}
                </div>

                <div>
                  <h3 class="font-bold text-white text-base line-clamp-2">${b.title}</h3>
                  <p class="text-xs text-slate-400 mt-1">por ${b.creator.name}</p>
                </div>

                <div class="pt-2 border-t border-slate-700/40">
                  <div class="text-xs text-slate-400">${b.type === 'SALE' ? 'Preço atual por cota' : 'Preço-alvo'}</div>
                  <div class="text-2xl font-bold font-mono-numbers text-white">${formatBRL(currentPrice)}</div>
                  ${nextTier ? `<div class="text-xs text-yellow-400 mt-0.5">Faltam ${nextTier.remainingQuotas} para ${formatBRL(nextTier.targetPrice)}</div>` : ''}
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs">
                <span class="text-slate-300">◔ <strong>${b.currentQuotas}</strong>/${b.capacity} cotas</span>
                <span class="text-blue-400 font-semibold group-hover:translate-x-1 transition">Ver detalhes →</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  container.innerHTML = html;
}

function sortListView(criteria) {
  if (criteria === 'time') {
    State.bubbles.sort((a, b) => a.durationHoursLeft - b.durationHoursLeft);
  } else if (criteria === 'price_asc') {
    State.bubbles.sort((a, b) => calculateCurrentPrice(a) - calculateCurrentPrice(b));
  } else if (criteria === 'progress') {
    State.bubbles.sort((a, b) => (b.currentQuotas / b.capacity) - (a.currentQuotas / a.capacity));
  }
  renderListView();
}

// Modals Management
function openModal(modalType) {
  State.activeModal = modalType;
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  if (!overlay || !container) return;

  overlay.classList.remove('hidden');
  renderModalContent(modalType);
}

function closeModal() {
  State.activeModal = null;
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderModalContent(modalType) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const bubble = State.bubbles.find(b => b.id === State.selectedBubbleId);

  switch (modalType) {
    case 'join':
      renderJoinModal(container, bubble);
      break;
    case 'pix':
      renderPixModal(container, bubble);
      break;
    case 'exit':
      renderExitModal(container, bubble);
      break;
    case 'create_sale':
      renderCreateSaleModal(container);
      break;
    case 'create_purchase':
      renderCreatePurchaseModal(container);
      break;
    case 'triage_seller':
      renderTriageSellerModal(container, bubble);
      break;
    case 'triage_buyer':
      renderTriageBuyerModal(container, bubble);
      break;
    case 'score':
      renderScoreModal(container);
      break;
    default:
      container.innerHTML = `<div class="p-6 text-center">Modal não encontrado.</div>`;
  }
}

// T12 - Entrar na Bolha
function renderJoinModal(container, bubble) {
  const currentPrice = calculateCurrentPrice(bubble);
  const initialPrice = bubble.tiers ? bubble.tiers[0].price : bubble.targetPrice;

  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Entrar na Bolha</h2>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <p class="text-xs text-slate-400 mt-1">${bubble.title}</p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Summary Box -->
      <div class="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">Preço Atual por Cota:</span>
          <span class="font-bold text-white font-mono-numbers">${formatBRL(currentPrice)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">Valor Máximo Reservado:</span>
          <span class="font-bold text-white font-mono-numbers">${formatBRL(initialPrice)}</span>
        </div>
        <div class="text-xs text-blue-400 pt-2 border-t border-slate-700">
          💡 A cobrança real será apenas o valor final na explosão. A diferença de ${formatBRL(initialPrice - currentPrice)} é desbloqueada no seu cartão/saldo.
        </div>
      </div>

      <!-- Quota Quantity Selection -->
      <div>
        <label class="block text-xs font-semibold text-slate-300 uppercase mb-2">Quantidade de Cotas</label>
        ${State.currentPersona === 'pf' ? `
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-sm">
            <span>1 cota (fixo para Pessoa Física)</span>
            <span class="text-xs text-slate-400">Regra anti-cambismo da Spec</span>
          </div>
        ` : `
          <div class="flex items-center gap-4">
            <input type="number" id="quota-qty-input" value="5" min="1" max="25" class="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-center font-bold text-white font-mono-numbers">
            <span class="text-xs text-slate-400">Limite de até 25 cotas para sua empresa (50% do lote).</span>
          </div>
        `}
      </div>

      <!-- Payment Method -->
      <div>
        <label class="block text-xs font-semibold text-slate-300 uppercase mb-2">Forma de Pagamento</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-center gap-3 p-3.5 rounded-xl border border-blue-500/50 bg-blue-500/10 cursor-pointer">
            <input type="radio" name="pay_method" value="card" checked class="text-blue-500">
            <div>
              <div class="text-sm font-bold text-white">Cartão de Crédito</div>
              <div class="text-xs text-slate-400">Pré-autorização imediata</div>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800 cursor-pointer">
            <input type="radio" name="pay_method" value="pix" class="text-blue-500">
            <div>
              <div class="text-sm font-bold text-white">Pix com Reserva</div>
              <div class="text-xs text-slate-400">Reserva de 15 minutos</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Terms Checkbox -->
      <label class="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" id="terms-agree" checked class="mt-0.5 rounded text-blue-500">
        <span>Li e concordo com os termos da bolha, ciência de que o valor final pode ser menor e concordo com a pré-autorização de <strong class="text-white">${formatBRL(initialPrice)}</strong>.</span>
      </label>
    </div>

    <div class="p-6 border-t border-slate-700 bg-slate-900/50 flex gap-3">
      <button onclick="closeModal()" class="w-1/3 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-sm font-semibold text-slate-300">
        Cancelar
      </button>
      <button onclick="confirmJoinBubble('${bubble.id}')" class="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-sm shadow-lg shadow-blue-500/25">
        Confirmar e Reservar ${formatBRL(initialPrice)}
      </button>
    </div>
  `;
}

function confirmJoinBubble(bubbleId) {
  const method = document.querySelector('input[name="pay_method"]:checked').value;
  if (method === 'pix') {
    renderModalContent('pix');
    return;
  }

  // Credit Card Flow
  const bubble = State.bubbles.find(b => b.id === bubbleId);
  bubble.currentQuotas += 1;
  State.user.participatingBubbleIds.push(bubbleId);

  // Trigger Live Simulation feedback
  showToast('✓ Cota confirmada com sucesso! Pré-autorização registrada.');
  closeModal();
  renderBubbleDetails();
  drawCanvas();
}

// T12p - Pix QR Code
function renderPixModal(container, bubble) {
  const initialPrice = bubble.tiers ? bubble.tiers[0].price : bubble.targetPrice;

  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Pagamento Pix da Cota</h2>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <p class="text-xs text-slate-400 mt-1">Sua cota fica reservada por 15:00 minutos</p>
    </div>

    <div class="p-6 text-center space-y-5">
      <div class="inline-block p-4 bg-white rounded-2xl shadow-xl">
        <!-- Simulated QR Code SVG -->
        <svg class="w-48 h-48 mx-auto" viewBox="0 0 100 100" fill="black">
          <path d="M10 10h30v30h-30z M15 15h20v20h-20z M60 10h30v30h-30z M65 15h20v20h-20z M10 60h30v30h-30z M15 65h20v20h-20z M45 10h10v20h-10z M45 45h10v10h-10z M60 60h15v15h-15z M75 75h15v15h-15z M20 20h10v10h-10z M70 20h10v10h-10z M20 70h10v10h-10z"/>
        </svg>
      </div>

      <div>
        <div class="text-sm font-semibold text-slate-300">Valor a transferir</div>
        <div class="text-3xl font-extrabold text-white font-mono-numbers mt-1">${formatBRL(initialPrice)}</div>
      </div>

      <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono-numbers">
        ⏱ Tempo restante para pagar: <strong id="pix-timer">14:58</strong>
      </div>

      <button onclick="navigator.clipboard.writeText('00020126580014br.gov.bcb.pix0136bolha-venda-simulado-reserva-cota'); showToast('Código Pix copiado!');" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition">
        Copiar Código Pix Copia-e-Cola
      </button>
    </div>

    <div class="p-6 border-t border-slate-700 bg-slate-900/50">
      <button onclick="simulatePixPaymentSuccess('${bubble.id}')" class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-sm shadow-lg shadow-emerald-500/25">
        Simular Confirmação do Pix pelo Banco
      </button>
    </div>
  `;
}

function simulatePixPaymentSuccess(bubbleId) {
  const bubble = State.bubbles.find(b => b.id === bubbleId);
  bubble.currentQuotas += 1;
  State.user.participatingBubbleIds.push(bubbleId);
  showToast('✓ Pix confirmado! Cota garantida na bolha.');
  closeModal();
  renderBubbleDetails();
  drawCanvas();
}

// T12b - Sair da Bolha
function renderExitModal(container, bubble) {
  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <h2 class="text-xl font-bold text-white">Sair da Bolha?</h2>
    </div>
    <div class="p-6 space-y-4 text-sm text-slate-300">
      <p>Ao sair da bolha, a sua pré-autorização será liberada no cartão e o número total de participantes cairá em 1.</p>
      <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs">
        ⚠️ Atenção: Por segurança do grupo (ADR-0009), desistências são bloqueadas automaticamente nos últimos 60 minutos da bolha.
      </div>
    </div>
    <div class="p-6 border-t border-slate-700 flex gap-3">
      <button onclick="closeModal()" class="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-200 font-semibold text-sm">
        Continuar na Bolha
      </button>
      <button onclick="confirmExitBubble('${bubble.id}')" class="w-1/2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm">
        Sim, Quero Sair
      </button>
    </div>
  `;
}

function confirmExitBubble(bubbleId) {
  const bubble = State.bubbles.find(b => b.id === bubbleId);
  bubble.currentQuotas = Math.max(0, bubble.currentQuotas - 1);
  State.user.participatingBubbleIds = State.user.participatingBubbleIds.filter(id => id !== bubbleId);
  showToast('Você saiu da bolha. Pré-autorização liberada.');
  closeModal();
  renderBubbleDetails();
  drawCanvas();
}

// T10 - Criar Bolha de Venda (Wizard 4 Passos com Gráfico SVG Dinâmico)
let createSaleState = {
  step: 1,
  title: 'Smart Lâmpada Wi-Fi RGB 10W Bivolt',
  category: 'Casa Inteligente',
  description: 'Kit de lâmpadas inteligentes compatíveis com Alexa e Google Assistant com 16 milhões de cores.',
  capacity: 100,
  meta: 40,
  maxPjShare: 50,
  durationHours: 72,
  shippingDays: 7,
  tiers: [
    { quotas: 0, price: 69.90 },
    { quotas: 40, price: 54.90 },
    { quotas: 70, price: 44.90 },
    { quotas: 100, price: 39.90 }
  ]
};

function renderCreateSaleModal(container) {
  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Criar Bolha de Venda (Oferta em Lote)</h2>
          <p class="text-xs text-slate-400">Passo ${createSaleState.step} de 4 · Rascunho salvo às 14h03 ✓</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>

      <!-- Step Indicator -->
      <div class="flex items-center gap-2 mt-4">
        ${[1, 2, 3, 4].map(s => `
          <div class="flex-1 h-1.5 rounded-full ${s <= createSaleState.step ? 'bg-blue-500' : 'bg-slate-700'}"></div>
        `).join('')}
      </div>
    </div>

    <div class="p-6 max-h-[70vh] overflow-y-auto space-y-6">
      ${renderSaleStepContent()}
    </div>

    <div class="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-between">
      ${createSaleState.step > 1 ? `
        <button onclick="changeSaleStep(-1)" class="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold text-sm hover:bg-slate-800">
          ← Voltar
        </button>
      ` : `<div></div>`}
      
      ${createSaleState.step < 4 ? `
        <button onclick="changeSaleStep(1)" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20">
          Avançar →
        </button>
      ` : `
        <button onclick="publishNewSaleBubble()" class="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25">
          Publicar Bolha no Canvas 🚀
        </button>
      `}
    </div>
  `;
}

function renderSaleStepContent() {
  if (createSaleState.step === 1) {
    return `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Título da Oferta</label>
          <input type="text" value="${createSaleState.title}" oninput="createSaleState.title = this.value" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Categoria</label>
            <select class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm">
              <option>Casa Inteligente</option>
              <option>Eletrônicos</option>
              <option>Informática</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Prazo de Envio (dias)</label>
            <input type="number" value="${createSaleState.shippingDays}" oninput="createSaleState.shippingDays = Number(this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm font-mono-numbers">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição Detalhada</label>
          <textarea rows="4" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm">${createSaleState.description}</textarea>
        </div>
      </div>
    `;
  } else if (createSaleState.step === 2) {
    return `
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Capacidade (Total)</label>
            <input type="number" value="${createSaleState.capacity}" oninput="createSaleState.capacity = Number(this.value); renderModalContent('create_sale');" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono-numbers font-bold">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Meta Mínima</label>
            <input type="number" value="${createSaleState.meta}" oninput="createSaleState.meta = Number(this.value); renderModalContent('create_sale');" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono-numbers font-bold">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase mb-1">Teto PJ (%)</label>
            <input type="number" value="${createSaleState.maxPjShare}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono-numbers">
          </div>
        </div>
        <p class="text-xs text-slate-400">
          Se a bolha atingir a <strong>meta de ${createSaleState.meta} cotas</strong>, ela explode com sucesso na data final. Se não atingir, todos recebem devolução de 100%.
        </p>
      </div>
    `;
  } else if (createSaleState.step === 3) {
    return `
      <div class="space-y-6">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-bold text-slate-300 uppercase">Degraus de Preço (Curva Desconto)</h3>
            <button onclick="addSaleTier()" class="text-xs text-blue-400 hover:text-blue-300 font-bold">+ Adicionar Degrau</button>
          </div>
          
          <div class="space-y-2">
            ${createSaleState.tiers.map((t, idx) => `
              <div class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span class="text-xs text-slate-400 w-24">A partir de</span>
                <input type="number" value="${t.quotas}" ${idx === 0 ? 'disabled' : ''} onchange="updateTierQuota(${idx}, Number(this.value))" class="w-20 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-white text-sm font-mono-numbers">
                <span class="text-xs text-slate-400">cotas</span>
                <span class="text-xs text-slate-400 ml-auto">Preço: R$</span>
                <input type="number" step="0.10" value="${t.price}" onchange="updateTierPrice(${idx}, Number(this.value))" class="w-24 bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-white text-sm font-mono-numbers font-bold">
                ${idx > 1 ? `
                  <button onclick="removeSaleTier(${idx})" class="text-rose-400 hover:text-rose-300 p-1">🗑</button>
                ` : '<span class="w-6"></span>'}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Dynamic SVG Price Curve Graph -->
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div class="text-xs font-semibold text-slate-400 mb-2">Prévia da Curva de Degraus (Preço × Cotas)</div>
          ${renderSvgPriceTiersChart(createSaleState.tiers)}
        </div>
      </div>
    `;
  } else {
    // Step 4: Review
    return `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
          <h3 class="font-bold text-white text-base">${createSaleState.title}</h3>
          <div class="grid grid-cols-2 gap-3 text-xs text-slate-300">
            <div>Capacidade: <strong>${createSaleState.capacity} cotas</strong></div>
            <div>Meta Mínima: <strong>${createSaleState.meta} cotas</strong></div>
            <div>Preço Inicial: <strong>${formatBRL(createSaleState.tiers[0].price)}</strong></div>
            <div>Preço Alvo: <strong>${formatBRL(createSaleState.tiers[createSaleState.tiers.length - 1].price)}</strong></div>
            <div>Prazo de Envio: <strong>${createSaleState.shippingDays} dias</strong></div>
            <div>Taxa da Plataforma: <strong>6% (R$ 3,29 por cota)</strong></div>
          </div>
        </div>

        <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
          ⚖️ <strong>Oferta Vinculante:</strong> Após a publicação no canvas, as regras de preço, capacidade e prazo não podem ser alteradas.
        </div>
      </div>
    `;
  }
}

function renderSvgPriceTiersChart(tiers) {
  const w = 400;
  const h = 120;
  const maxPrice = Math.max(...tiers.map(t => t.price)) * 1.1;
  const minPrice = Math.min(...tiers.map(t => t.price)) * 0.9;
  const maxQuota = 100;

  let points = tiers.map(t => {
    const x = (t.quotas / maxQuota) * (w - 40) + 20;
    const y = h - 20 - ((t.price - minPrice) / (maxPrice - minPrice)) * (h - 40);
    return { x, y, price: t.price, quotas: t.quotas };
  });

  // Construct stepped line path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` H ${points[i].x} V ${points[i].y}`;
  }

  return `
    <svg viewBox="0 0 ${w} ${h}" class="w-full h-32">
      <!-- Grid lines -->
      <line x1="20" y1="20" x2="${w-20}" y2="20" stroke="#334155" stroke-dasharray="3,3" />
      <line x1="20" y1="${h-20}" x2="${w-20}" y2="${h-20}" stroke="#475569" />
      
      <!-- Stepped Curve -->
      <path d="${pathD}" fill="none" stroke="#3B82F6" stroke-width="3" />

      <!-- Data Dots -->
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#60A5FA" stroke="#1E293B" stroke-width="2" />
        <text x="${p.x}" y="${p.y - 8}" fill="#94A3B8" font-size="9" text-anchor="middle" font-family="JetBrains Mono">R$ ${p.price.toFixed(0)}</text>
      `).join('')}
    </svg>
  `;
}

function changeSaleStep(delta) {
  createSaleState.step += delta;
  renderModalContent('create_sale');
}

function updateTierQuota(idx, val) {
  createSaleState.tiers[idx].quotas = val;
  renderModalContent('create_sale');
}

function updateTierPrice(idx, val) {
  createSaleState.tiers[idx].price = val;
  renderModalContent('create_sale');
}

function addSaleTier() {
  if (createSaleState.tiers.length >= 10) return;
  const last = createSaleState.tiers[createSaleState.tiers.length - 1];
  createSaleState.tiers.push({
    quotas: last.quotas + 10,
    price: Math.max(1, last.price - 5)
  });
  renderModalContent('create_sale');
}

function removeSaleTier(idx) {
  createSaleState.tiers.splice(idx, 1);
  renderModalContent('create_sale');
}

function publishNewSaleBubble() {
  const newBubble = {
    id: `B-00${State.bubbles.length + 1}`,
    type: 'SALE',
    title: createSaleState.title,
    category: createSaleState.category,
    creator: { name: 'MinhaEmpresa#88FA', score: 750, rating: 'Bom' },
    images: ['https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&q=80'],
    description: createSaleState.description,
    capacity: createSaleState.capacity,
    meta: createSaleState.meta,
    currentQuotas: 1,
    reservedPixQuotas: 0,
    durationHoursLeft: 72,
    timeLeftFormatted: '3d 00h',
    isNearFull: false,
    isExpiring: false,
    shippingDays: createSaleState.shippingDays,
    maxPjShare: createSaleState.maxPjShare,
    tiers: createSaleState.tiers,
    x: 450,
    y: 100,
    radius: 105
  };

  State.bubbles.push(newBubble);
  closeModal();
  selectBubble(newBubble.id);
  centerCanvasOnBubble(newBubble.id);
  showToast('🎉 Nova bolha de venda publicada no Canvas com sucesso!');
}

// T17 - Triagem do Vendedor
function renderTriageSellerModal(container, bubble) {
  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Triagem de Entregas · ${bubble.title}</h2>
          <p class="text-xs text-slate-400">Fechou a R$ 80,00 · 72 compradores · Repasse previsto: <strong>R$ 5.414,40</strong></p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>

      <!-- Status Tabs -->
      <div class="flex items-center gap-2 mt-4 text-xs font-semibold overflow-x-auto">
        <button class="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Aguardando Envio (52)</button>
        <button class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">Atrasados (0)</button>
        <button class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">Enviados (14)</button>
        <button class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">Casos (1)</button>
      </div>
    </div>

    <div class="p-6 max-h-[60vh] overflow-y-auto space-y-3">
      ${State.triageOrders.map(ord => `
        <div class="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-white text-sm">${ord.buyer}</span>
              <span class="text-xs text-slate-400">(${ord.pseudonym})</span>
              <span class="px-2 py-0.5 rounded text-xs font-semibold ${
                ord.status === 'WAITING_SHIPMENT' ? 'bg-amber-500/20 text-amber-300' :
                ord.status === 'SHIPPED' ? 'bg-blue-500/20 text-blue-300' :
                ord.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-rose-500/20 text-rose-300'
              }">
                ${ord.status}
              </span>
            </div>
            <div class="text-xs text-slate-300 mt-1">
              ${ord.quotas} cota(s) · Total: <strong class="font-mono-numbers">${formatBRL(ord.paid)}</strong>
            </div>
            <div class="text-xs text-slate-400 mt-0.5">
              📍 ${ord.address}
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${ord.status === 'WAITING_SHIPMENT' ? `
              <button onclick="registerShipping('${ord.id}')" class="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition">
                Registrar Envio (Rastreio)
              </button>
            ` : `
              <span class="text-xs text-slate-400">Rastreio: ${ord.trackingCode || 'OK'}</span>
            `}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="p-6 border-t border-slate-700 bg-slate-900/50 flex justify-between">
      <button class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Exportar CSV</button>
      <button onclick="closeModal()" class="px-5 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold">Fechar</button>
    </div>
  `;
}

function registerShipping(orderId) {
  const code = prompt('Informe o código de rastreio Correios/Transportadora:', 'QB' + Math.floor(100000000 + Math.random() * 900000000) + 'BR');
  if (!code) return;
  const ord = State.triageOrders.find(o => o.id === orderId);
  if (ord) {
    ord.status = 'SHIPPED';
    ord.trackingCode = code;
    showToast(`Envio registrado para ${ord.buyer}! Comprador notificado.`);
    renderModalContent('triage_seller');
  }
}

// T18 - Triagem do Comprador
function renderTriageBuyerModal(container, bubble) {
  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Minha Cota na Bolha</h2>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <p class="text-xs text-slate-400 mt-1">${bubble.title}</p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Financial Breakdown Transparency -->
      <div class="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2 text-sm">
        <div class="flex justify-between text-slate-300">
          <span>Valor Inicial Pré-autorizado:</span>
          <span class="font-mono-numbers">R$ 100,00</span>
        </div>
        <div class="flex justify-between text-emerald-400 font-bold">
          <span>Preço Final Efetivo:</span>
          <span class="font-mono-numbers">R$ 80,00</span>
        </div>
        <div class="flex justify-between text-blue-400 text-xs pt-2 border-t border-slate-700">
          <span>Saldo Desbloqueado / Devolvido:</span>
          <span class="font-mono-numbers font-bold">R$ 20,00</span>
        </div>
      </div>

      <!-- Vertical Timeline -->
      <div class="space-y-4 text-xs">
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
          <div>
            <div class="font-bold text-white">Pagamento Confirmado</div>
            <div class="text-slate-400">26/11 às 14h20</div>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">🚚</div>
          <div>
            <div class="font-bold text-white">Item Enviado pelo Vendedor</div>
            <div class="text-slate-300">Rastreio: QB124987654BR · Previsão 04/12</div>
          </div>
        </div>
        <div class="flex items-start gap-3 opacity-60">
          <div class="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold">○</div>
          <div>
            <div class="font-bold text-white">Entrega e Confirmação</div>
            <div class="text-slate-400">Aguardando recebimento</div>
          </div>
        </div>
      </div>

      <!-- Buyer Protections -->
      <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-400 space-y-1">
        <p>🛡 <strong>Proteção Bolha Venda:</strong> Você tem 7 dias após o recebimento para solicitar arrependimento ou relatar contestação.</p>
      </div>
    </div>

    <div class="p-6 border-t border-slate-700 bg-slate-900/50 flex gap-3">
      <button onclick="showToast('Solicitação de contestação enviada para mediação.'); closeModal();" class="w-1/2 py-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold">
        Não recebi / Problema
      </button>
      <button onclick="showToast('Recebimento confirmado! Repasse liberado ao vendedor.'); closeModal();" class="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
        Confirmar Recebimento
      </button>
    </div>
  `;
}

// T20 - Score
function renderScoreModal(container) {
  container.innerHTML = `
    <div class="p-6 border-b border-slate-700">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Meu Score de Reputação</h2>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <p class="text-xs text-slate-400 mt-1">${State.user.pseudonym} · ${State.user.name}</p>
    </div>

    <div class="p-6 space-y-6">
      <div class="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700">
        <div class="text-5xl font-extrabold text-blue-400 font-mono-numbers">${State.user.score}</div>
        <div class="text-sm font-bold text-white mt-1">Nível: ${State.user.scoreRating}</div>
        <div class="text-xs text-slate-400 mt-2">Régua 0 a 1000 · Decaimento com meia-vida de 180 dias</div>
      </div>

      <div class="space-y-3">
        <h3 class="text-xs font-bold text-slate-400 uppercase">Histórico Recente de Eventos</h3>
        <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-white">Participação concluída sem atrito</div>
            <div class="text-slate-400">Bolha #B-006</div>
          </div>
          <span class="text-emerald-400 font-bold font-mono-numbers">+25 pts</span>
        </div>
        <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700 flex justify-between items-center text-xs">
          <div>
            <div class="font-bold text-white">Pontualidade no pagamento Pix</div>
            <div class="text-slate-400">Reserva confirmada em 3 min</div>
          </div>
          <span class="text-emerald-400 font-bold font-mono-numbers">+10 pts</span>
        </div>
      </div>
    </div>

    <div class="p-6 border-t border-slate-700">
      <button onclick="closeModal()" class="w-full py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold">Fechar</button>
    </div>
  `;
}

// User Persona Switcher & Header Info
function setPersona(persona) {
  State.currentPersona = persona;
  if (persona === 'pf') {
    State.user = {
      pseudonym: 'Bolhista#4F2A',
      name: 'Carlos Silva',
      score: 742,
      scoreRating: 'Bom',
      participatingBubbleIds: ['B-001']
    };
  } else if (persona === 'pj') {
    State.user = {
      pseudonym: 'TecnoLotes#9C1D',
      name: 'TecnoLotes Atacado Ltda',
      score: 810,
      scoreRating: 'Excelente',
      participatingBubbleIds: ['B-003']
    };
  } else {
    State.user = {
      pseudonym: 'JulianaRocha#E23A',
      name: 'Juliana Rocha (Organizadora)',
      score: 790,
      scoreRating: 'Excelente',
      participatingBubbleIds: ['B-003']
    };
  }

  updateHeaderUserInfo();
  renderBubbleDetails();
  showToast(`Persona alternada para: ${State.user.name}`);
}

function updateHeaderUserInfo() {
  const el = document.getElementById('user-profile-btn');
  if (el) {
    el.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white">
        ${State.user.name.charAt(0)}
      </div>
      <div class="text-left hidden sm:block">
        <div class="text-xs font-bold text-white leading-tight">${State.user.pseudonym}</div>
        <div class="text-[10px] text-slate-400">Score ${State.user.score}</div>
      </div>
    `;
  }
}

// Global Event Listeners & Controls
function setupEventListeners() {
  // Search Input
  const searchInput = document.getElementById('search-bubbles-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      State.searchQuery = e.target.value;
      drawCanvas();
      renderListView();
    });
  }

  // View Mode Switcher
  const canvasBtn = document.getElementById('view-canvas-btn');
  const listBtn = document.getElementById('view-list-btn');
  const canvasContainer = document.getElementById('canvas-container');
  const listContainer = document.getElementById('list-view-container');

  if (canvasBtn && listBtn) {
    canvasBtn.addEventListener('click', () => {
      State.viewMode = 'canvas';
      canvasBtn.classList.add('bg-blue-600', 'text-white');
      canvasBtn.classList.remove('text-slate-400');
      listBtn.classList.remove('bg-blue-600', 'text-white');
      listBtn.classList.add('text-slate-400');
      canvasContainer.classList.remove('hidden');
      listContainer.classList.add('hidden');
      drawCanvas();
    });

    listBtn.addEventListener('click', () => {
      State.viewMode = 'list';
      listBtn.classList.add('bg-blue-600', 'text-white');
      listBtn.classList.remove('text-slate-400');
      canvasBtn.classList.remove('bg-blue-600', 'text-white');
      canvasBtn.classList.add('text-slate-400');
      canvasContainer.classList.add('hidden');
      listContainer.classList.remove('hidden');
      renderListView();
    });
  }

  // Filter Buttons
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('bg-slate-700', 'text-white'));
      btn.classList.add('bg-slate-700', 'text-white');
      State.filterType = btn.dataset.filter;
      drawCanvas();
      renderListView();
    });
  });

  // Zoom Buttons
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => applyZoom(1.2));
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => applyZoom(0.8));
  document.getElementById('zoom-center-btn')?.addEventListener('click', () => centerCanvasOnBubble(State.selectedBubbleId));

  // Theme Toggle
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    State.theme = State.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('light-mode', State.theme === 'light');
    drawCanvas();
    drawMinimap();
  });

  // Motion Toggle (Accessibility)
  document.getElementById('motion-toggle-btn')?.addEventListener('click', () => {
    State.reducedMotion = !State.reducedMotion;
    showToast(State.reducedMotion ? 'Movimento reduzido ativado' : 'Animações fluidas ativadas');
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (State.activeModal) closeModal();
      else if (State.isDrawerOpen) closeDrawer();
    }
  });
}

// Live Testing Triggers (for Gate A Usability Sessions)
function triggerSimulateNewQuota() {
  const bubble = State.bubbles.find(b => b.id === State.selectedBubbleId);
  if (!bubble) return;
  bubble.currentQuotas = Math.min(bubble.capacity, bubble.currentQuotas + 1);
  showToast(`⚡ Nova cota entrou em ${bubble.title}! Agora: ${bubble.currentQuotas}/${bubble.capacity}`);
  renderBubbleDetails();
  drawCanvas();
}

function triggerSimulateExplosion() {
  const bubble = State.bubbles.find(b => b.id === State.selectedBubbleId);
  if (!bubble) return;
  bubble.isExpired = true;
  bubble.finalPrice = calculateCurrentPrice(bubble);
  showToast(`💥 A bolha explodiu! Fechou no valor final de ${formatBRL(bubble.finalPrice)}.`);
  renderBubbleDetails();
  drawCanvas();
}

function showToast(message) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}
