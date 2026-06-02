'use strict';

// ── PAINTINGS DATA ────────────────────────────────────────────────────────────
const PAINTINGS = [
  {
    id: 1, artist: 'Igor Borshch', year: 2023, price: 45000,
    category: 'landscape', technique: 'oil', size: '80 × 100 cm', badge: 'new',
    titles: { uk: 'Захід над морем', ru: 'Закат над морем', en: 'Sunset over the Sea', es: 'Puesta de Sol sobre el Mar' },
    descs: { uk: 'Теплі відтінки сонця, що сідає, над спокійною морською гладдю. Картина передає відчуття спокою та нескінченності.', ru: 'Тёплые оттенки заходящего солнца над спокойной морской гладью. Картина передаёт ощущение покоя и бесконечности.', en: 'Warm hues of the setting sun over a calm sea. The painting conveys a sense of peace and infinity.', es: 'Cálidos tonos del sol poniente sobre un mar sereno. La pintura transmite una sensación de paz e infinidad.' },
    gradient: 'linear-gradient(160deg,#FF6B35 0%,#F7931E 25%,#FFD700 45%,#FF4500 65%,#1A1A2E 100%)',
  },
  {
    id: 2, artist: 'Maria Stepanenko', year: 2022, price: 38000,
    category: 'landscape', technique: 'oil', size: '60 × 80 cm', badge: null,
    titles: { uk: 'Зимовий ліс', ru: 'Зимний лес', en: 'Winter Forest', es: 'Bosque de Invierno' },
    descs: { uk: 'Безмовність зимового лісу в срібних і синіх тонах. Кожна деталь передає морозну свіжість.', ru: 'Безмолвие зимнего леса в серебристых и синих тонах. Каждая деталь передаёт морозную свежесть.', en: 'The silence of a winter forest in silver and blue tones. Every detail conveys frosty freshness.', es: 'El silencio del bosque invernal en tonos plateados y azules. Cada detalle transmite la frescura helada.' },
    gradient: 'linear-gradient(180deg,#B8D4E8 0%,#7AA8C7 30%,#E8F4FF 55%,#C8DFF0 70%,#2C4A6E 100%)',
  },
  {
    id: 3, artist: 'Alexey Gromov', year: 2024, price: 62000,
    category: 'urban', technique: 'acrylic', size: '100 × 120 cm', badge: 'new',
    titles: { uk: 'Міський пейзаж', ru: 'Городской пейзаж', en: 'Urban Landscape', es: 'Paisaje Urbano' },
    descs: { uk: 'Динамічне нічне місто, відображене в мокрих вулицях. Суміш фіолетового та оранжевого створює неповторну атмосферу.', ru: 'Динамичный ночной город, отражённый в мокрых улицах. Смешение фиолетового и оранжевого создаёт неповторимую атмосферу.', en: 'A dynamic night city reflected in wet streets. The blend of purple and orange creates a unique atmosphere.', es: 'Una ciudad nocturna dinámica reflejada en calles mojadas. La mezcla de púrpura y naranja crea una atmósfera única.' },
    gradient: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 30%,#8B5CF6 55%,#F97316 75%,#1a1a2e 100%)',
  },
  {
    id: 4, artist: 'Igor Borshch', year: 2023, price: 29000,
    category: 'abstract', technique: 'mixed', size: '70 × 70 cm', badge: null,
    titles: { uk: 'Абстракція №1', ru: 'Абстракция №1', en: 'Abstraction #1', es: 'Abstracción №1' },
    descs: { uk: 'Енергійна абстрактна композиція. Сміливі кольорові переходи та динамічні лінії створюють відчуття руху.', ru: 'Энергичная абстрактная композиция. Смелые цветовые переходы и динамичные линии создают ощущение движения.', en: 'An energetic abstract composition. Bold color transitions and dynamic lines create a sense of movement.', es: 'Una composición abstracta enérgica. Las audaces transiciones de color y las líneas dinámicas crean una sensación de movimiento.' },
    gradient: 'linear-gradient(45deg,#FF006E 0%,#8338EC 25%,#3A86FF 50%,#06D6A0 75%,#FFB703 100%)',
  },
  {
    id: 5, artist: 'Maria Stepanenko', year: 2022, price: 24000, oldPrice: 32000,
    category: 'still_life', technique: 'oil', size: '50 × 60 cm', badge: 'sale',
    titles: { uk: 'Польові квіти', ru: 'Полевые цветы', en: 'Field Flowers', es: 'Flores del Campo' },
    descs: { uk: 'Ніжний букет польових квітів на світлому фоні. Картина несе в собі літню легкість та радість.', ru: 'Нежный букет полевых цветов на светлом фоне. Картина несёт в себе летнюю лёгкость и радость.', en: 'A delicate bouquet of wildflowers on a light background. The painting carries summer lightness and joy.', es: 'Un delicado ramo de flores silvestres sobre fondo claro. La pintura irradia ligereza y alegría estival.' },
    gradient: 'linear-gradient(160deg,#98FB98 0%,#7FFF00 20%,#FFD700 45%,#FF69B4 65%,#9370DB 85%,#98FB98 100%)',
  },
  {
    id: 6, artist: 'Alexey Gromov', year: 2021, price: 55000,
    category: 'portrait', technique: 'oil', size: '60 × 80 cm', badge: null,
    titles: { uk: 'Портрет незнайомки', ru: 'Портрет незнакомки', en: 'Portrait of a Stranger', es: 'Retrato de una Desconocida' },
    descs: { uk: 'Загадковий портрет молодої жінки. Теплі охристі тони та м\'яке світлотіні надають роботі класичну елегантність.', ru: 'Загадочный портрет молодой женщины. Тёплые охристые тона и мягкая светотень придают работе классическую элегантность.', en: 'A mysterious portrait of a young woman. Warm ochre tones and soft chiaroscuro give the work classical elegance.', es: 'Un misterioso retrato de una joven. Los cálidos tonos ocres y el suave claroscuro otorgan elegancia clásica a la obra.' },
    gradient: 'linear-gradient(160deg,#D4A96A 0%,#C08040 25%,#8B5E3C 50%,#5C3D20 75%,#2A1A0A 100%)',
  },
  {
    id: 7, artist: 'Maria Stepanenko', year: 2024, price: 47000,
    category: 'landscape', technique: 'watercolor', size: '75 × 90 cm', badge: 'new',
    titles: { uk: 'Гірський світанок', ru: 'Горный рассвет', en: 'Mountain Dawn', es: 'Amanecer en las Montañas' },
    descs: { uk: 'Перші промені сонця над гірськими вершинами. Акварельні переходи передають ніжність раннього ранку.', ru: 'Первые лучи солнца над горными вершинами. Акварельные переходы передают нежность раннего утра.', en: 'First rays of sun over mountain peaks. Watercolor transitions convey the tenderness of early morning.', es: 'Los primeros rayos de sol sobre las cimas de las montañas. Las transiciones acuarela transmiten la ternura del amanecer.' },
    gradient: 'linear-gradient(160deg,#FF8C69 0%,#FFA07A 20%,#87CEEB 50%,#4A90D9 70%,#2C5F8A 90%,#1A3A5C 100%)',
  },
  {
    id: 8, artist: 'Igor Borshch', year: 2023, price: 41000,
    category: 'urban', technique: 'oil', size: '80 × 100 cm', badge: null,
    titles: { uk: 'Нічна тиша', ru: 'Ночная тишина', en: 'Night Silence', es: 'Silencio Nocturno' },
    descs: { uk: 'Нічна вулиця після дощу. Відображення ліхтарів у калюжах створює магічну атмосферу спокою.', ru: 'Ночная улица после дождя. Отражения фонарей в лужах создают магическую атмосферу покоя.', en: 'A night street after rain. Reflections of streetlamps in puddles create a magical atmosphere of peace.', es: 'Una calle nocturna tras la lluvia. Los reflejos de las farolas en los charcos crean una mágica atmósfera de paz.' },
    gradient: 'linear-gradient(160deg,#0D0D1A 0%,#1A1A3E 30%,#2E4482 50%,#FFD700 55%,#1A1A3E 65%,#0D0D1A 100%)',
  },
  {
    id: 9, artist: 'Maria Stepanenko', year: 2022, price: 33000,
    category: 'landscape', technique: 'oil', size: '70 × 80 cm', badge: null,
    titles: { uk: 'Весняний сад', ru: 'Весенний сад', en: 'Spring Garden', es: 'Jardín de Primavera' },
    descs: { uk: 'Квітуючий вишневий сад у перші дні весни. Ніжні рожеві та білі відтінки передають пробудження природи.', ru: 'Цветущий вишнёвый сад в первые дни весны. Нежные розовые и белые оттенки передают пробуждение природы.', en: 'A blooming cherry orchard in the first days of spring. Delicate pink and white tones convey nature\'s awakening.', es: 'Un floreciente huerto de cerezos en los primeros días de primavera. Los delicados tonos rosas y blancos transmiten el despertar de la naturaleza.' },
    gradient: 'linear-gradient(160deg,#FFB7C5 0%,#FF91A4 20%,#FFC8A2 40%,#98FB98 65%,#90EE90 85%,#3CB371 100%)',
  },
  {
    id: 10, artist: 'Alexey Gromov', year: 2023, price: 36000,
    category: 'landscape', technique: 'acrylic', size: '90 × 110 cm', badge: null,
    titles: { uk: 'Осінній парк', ru: 'Осенний парк', en: 'Autumn Park', es: 'Parque de Otoño' },
    descs: { uk: 'Золота осінь у міському парку. Мідні та бронзові відтінки створюють атмосферу задумливості.', ru: 'Золотая осень в городском парку. Медные и бронзовые оттенки создают атмосферу задумчивости.', en: 'Golden autumn in a city park. Copper and bronze tones create an atmosphere of thoughtfulness.', es: 'Otoño dorado en un parque urbano. Los tonos cobrizos y bronce crean una atmósfera de contemplación.' },
    gradient: 'linear-gradient(160deg,#D2691E 0%,#CD853F 20%,#DAA520 40%,#8B4513 60%,#2F1B0D 80%,#1A0F08 100%)',
  },
  {
    id: 11, artist: 'Igor Borshch', year: 2024, price: 52000,
    category: 'landscape', technique: 'oil', size: '100 × 80 cm', badge: 'new',
    titles: { uk: 'Море вранці', ru: 'Море утром', en: 'Morning Sea', es: 'Mar por la Mañana' },
    descs: { uk: 'Ранкове море у бірюзових та лазурних тонах. Спокій та чистота ранньої години.', ru: 'Утреннее море в бирюзовых и лазурных тонах. Спокойствие и чистота раннего часа.', en: 'The morning sea in turquoise and azure tones. The calm and clarity of the early hour.', es: 'El mar matutino en tonos turquesa y azul. La calma y la claridad de la hora temprana.' },
    gradient: 'linear-gradient(160deg,#87CEEB 0%,#00CED1 25%,#20B2AA 45%,#008B8B 65%,#F5DEB3 85%,#DEB887 100%)',
  },
  {
    id: 12, artist: 'Maria Stepanenko', year: 2021, price: 0,
    category: 'still_life', technique: 'oil', size: '40 × 50 cm', badge: 'sold',
    titles: { uk: 'Червоний мак', ru: 'Красный мак', en: 'Red Poppy', es: 'Amapola Roja' },
    descs: { uk: 'Одинокий червоний мак на темному фоні. Мінімалістична, але виразна робота.', ru: 'Одиночный красный мак на тёмном фоне. Минималистичная, но выразительная работа.', en: 'A solitary red poppy on a dark background. Minimalist yet expressive work.', es: 'Una solitaria amapola roja sobre fondo oscuro. Obra minimalista pero expresiva.' },
    gradient: 'linear-gradient(160deg,#1A0A0A 0%,#2D0808 30%,#CC0000 55%,#FF2222 68%,#2D0808 80%,#1A0A0A 100%)',
  },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────
function pt(p, field) { return (p[field + 's'] || {})[currentLang] || (p[field + 's'] || {})[Object.keys(p[field + 's'] || {})[0]] || ''; }
function ptitle(p) { return pt(p, 'title'); }
function pdesc(p) { return pt(p, 'desc'); }
function ptech(p) { return t('tech', p.technique) || p.technique; }
function pcat(p) { return t('cat', p.category) || p.category; }
function fmt(n) { return new Intl.NumberFormat('uk-UA').format(n) + ' ₴'; }

function artEl(p, extraStyle) {
  if (p.image) return `<img src="${p.image}" class="card-art" style="object-fit:cover;width:100%;height:100%${extraStyle ? ';' + extraStyle : ''}">`;
  return `<div class="card-art" style="background:${p.gradient};width:100%;height:100%${extraStyle ? ';' + extraStyle : ''}"></div>`;
}

// ── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  let wrap = document.getElementById('toast-container');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast-container'; wrap.className = 'toast-container'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── CART ─────────────────────────────────────────────────────────────────────
const Cart = {
  items: [],
  load() { try { this.items = JSON.parse(localStorage.getItem('art_cart') || '[]'); } catch { this.items = []; } },
  save() { localStorage.setItem('art_cart', JSON.stringify(this.items)); },
  add(id) { if (this.items.includes(id)) return false; this.items.push(id); this.save(); return true; },
  remove(id) { this.items = this.items.filter(i => i !== id); this.save(); },
  has(id) { return this.items.includes(id); },
  count() { return this.items.length; },
  total() { return this.items.reduce((s, id) => { const p = PAINTINGS.find(x => x.id === id); return s + (p ? p.price || 0 : 0); }, 0); },
  paintings() { return this.items.map(id => PAINTINGS.find(x => x.id === id)).filter(Boolean); },
  clear() { this.items = []; this.save(); },
};

function updateCartBadge() {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = Cart.count();
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  });
}

// ── HEADER ───────────────────────────────────────────────────────────────────
function initHeader() {
  const h = document.querySelector('.header');
  if (!h) return;
  const upd = () => h.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', upd, { passive: true });
  upd();

  const burger = h.querySelector('.burger');
  const nav = h.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', () => { nav.classList.toggle('open'); burger.classList.toggle('active'); });
    document.addEventListener('click', e => { if (!h.contains(e.target)) { nav.classList.remove('open'); burger.classList.remove('active'); } });
  }

  const page = window.location.pathname.split('/').pop() || 'index.html';
  h.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });

  updateCartBadge();
}

// ── CARD RENDERER ─────────────────────────────────────────────────────────────
function renderCard(p) {
  const sold = p.badge === 'sold';
  const inCart = Cart.has(p.id);
  const badgeLabel = p.badge ? t('badge', p.badge) : '';
  return `
  <div class="painting-card" data-id="${p.id}">
    <div class="card-image">
      ${artEl(p)}
      ${p.badge ? `<span class="card-badge badge-${p.badge}">${badgeLabel}</span>` : ''}
      ${!sold ? `<div class="card-overlay"><div class="overlay-actions">
        <button class="overlay-btn overlay-btn-view js-view" data-id="${p.id}">${t('card','details')}</button>
        <button class="overlay-btn overlay-btn-buy js-buy" data-id="${p.id}">${inCart ? t('card','in_cart') : t('card','buy')}</button>
      </div></div>` : ''}
    </div>
    <div class="card-body">
      <p class="card-artist">${p.artist}</p>
      <h3 class="card-title">${ptitle(p)}</h3>
      <p class="card-meta">${ptech(p)} · ${p.size}</p>
      <div class="card-footer">
        <div>
          <span class="card-price">${sold ? t('card','sold') : fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="card-price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
        ${!sold ? `<button class="add-to-cart-btn js-buy${inCart ? ' in-cart' : ''}" data-id="${p.id}">${inCart ? t('card','in_cart') : t('card','add')}</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ── MODAL ────────────────────────────────────────────────────────────────────
function openModal(id) {
  const p = PAINTINGS.find(x => x.id === id);
  if (!p) return;
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.id = 'modal-overlay'; overlay.innerHTML = '<div class="modal"></div>'; document.body.appendChild(overlay); }

  const sold = p.badge === 'sold';
  const inCart = Cart.has(p.id);
  overlay.querySelector('.modal').innerHTML = `
    <button class="modal-close" id="modal-close-btn">✕</button>
    <div class="modal-image">${artEl(p, 'width:100%;height:100%')}</div>
    <div class="modal-content">
      <p class="modal-artist">${p.artist}</p>
      <h2 class="modal-title">${ptitle(p)}</h2>
      <p class="modal-year">${p.year}</p>
      <p class="modal-desc">${pdesc(p)}</p>
      <div class="modal-details">
        <div class="detail-item"><label>${t('modal','technique')}</label><span>${ptech(p)}</span></div>
        <div class="detail-item"><label>${t('modal','size')}</label><span>${p.size}</span></div>
        <div class="detail-item"><label>${t('modal','category')}</label><span>${pcat(p)}</span></div>
        <div class="detail-item"><label>${t('modal','status')}</label><span>${sold ? t('modal','sold') : t('modal','available')}</span></div>
      </div>
      ${!sold ? `<p class="modal-price">${fmt(p.price)}</p>
      <div class="modal-actions">
        <button class="btn btn-outline" id="modal-close-btn2">${t('modal','close')}</button>
        <button class="btn btn-primary js-buy${inCart ? ' in-cart' : ''}" data-id="${p.id}">${inCart ? t('modal','in_cart') : t('modal','add')}</button>
      </div>` : `<p class="modal-price text-accent">${t('modal','sold')}</p><div class="modal-actions"><button class="btn btn-outline" id="modal-close-btn2">${t('modal','close')}</button></div>`}
    </div>`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  const btn2 = overlay.querySelector('#modal-close-btn2');
  if (btn2) btn2.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  const buyBtn = overlay.querySelector('.js-buy');
  if (buyBtn) buyBtn.addEventListener('click', () => { handleBuy(id); closeModal(); });
  document.addEventListener('keydown', onEsc);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onEsc);
}
function onEsc(e) { if (e.key === 'Escape') closeModal(); }

// ── BUY HANDLER ──────────────────────────────────────────────────────────────
function handleBuy(id) {
  const p = PAINTINGS.find(x => x.id === id);
  if (!p || p.badge === 'sold') return;
  if (Cart.has(id)) { window.location.href = 'cart.html'; return; }
  Cart.add(id);
  updateCartBadge();
  toast(`«${ptitle(p)}» ${t('toast_added', '') || 'added'}`, 'success');
  document.querySelectorAll(`[data-id="${id}"] .js-buy, .js-buy[data-id="${id}"]`).forEach(btn => {
    btn.classList.add('in-cart');
    btn.textContent = t('card', 'in_cart');
  });
}

function bindCardEvents(root) {
  root.addEventListener('click', e => {
    const buyBtn = e.target.closest('.js-buy');
    const viewBtn = e.target.closest('.js-view');
    const card = e.target.closest('.painting-card');
    if (buyBtn) { e.stopPropagation(); handleBuy(+buyBtn.dataset.id); return; }
    if (viewBtn) { e.stopPropagation(); openModal(+viewBtn.dataset.id); return; }
    if (card && !e.target.closest('button')) openModal(+card.dataset.id);
  });
}

// ── INDEX PAGE ───────────────────────────────────────────────────────────────
function initIndex() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  const featured = PAINTINGS.filter(p => p.badge === 'new' || p.id <= 6).slice(0, 6);
  grid.innerHTML = featured.map(renderCard).join('');
  bindCardEvents(grid);
}

// ── GALLERY PAGE ─────────────────────────────────────────────────────────────
let galleryState = { category: 'all', maxPrice: 100000, sort: 'default' };

function initGallery() {
  const grid = document.getElementById('paintings-grid');
  if (!grid) return;

  const catContainer = document.getElementById('cat-filters');
  const priceInput = document.getElementById('price-range');
  const priceVal = document.getElementById('price-val');
  const sortSel = document.getElementById('sort-select');

  function buildFilters() {
    if (!catContainer) return;
    const cats = ['all', ...new Set(PAINTINGS.map(p => p.category))];
    catContainer.innerHTML = cats.map(c =>
      `<label class="filter-option${c === galleryState.category ? ' active' : ''}">
        <input type="radio" name="cat" value="${c}">
        ${(t('cat', c) || c).charAt(0).toUpperCase() + (t('cat', c) || c).slice(1)}
      </label>`
    ).join('');
    catContainer.addEventListener('click', e => {
      const opt = e.target.closest('.filter-option');
      if (!opt) return;
      catContainer.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active'));
      opt.classList.add('active');
      galleryState.category = opt.querySelector('input').value;
      renderGallery();
    });
  }

  if (priceInput) {
    priceInput.addEventListener('input', () => {
      galleryState.maxPrice = +priceInput.value;
      if (priceVal) priceVal.textContent = fmt(galleryState.maxPrice);
      renderGallery();
    });
  }
  if (sortSel) sortSel.addEventListener('change', () => { galleryState.sort = sortSel.value; renderGallery(); });

  function renderGallery() {
    buildFilters();
    let list = PAINTINGS.filter(p => {
      if (galleryState.category !== 'all' && p.category !== galleryState.category) return false;
      if (p.price > galleryState.maxPrice && p.badge !== 'sold') return false;
      return true;
    });
    if (galleryState.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (galleryState.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (galleryState.sort === 'new') list = [...list].sort((a, b) => b.year - a.year);

    const countEl = document.getElementById('gallery-count');
    if (countEl) countEl.textContent = `${t('gallery','found')}: ${list.length} ${t('gallery','works')}`;
    grid.innerHTML = list.length
      ? list.map(renderCard).join('')
      : `<div class="empty-state"><h3>${t('gallery','empty_t')}</h3><p>${t('gallery','empty_d')}</p></div>`;
  }

  renderGallery();
  bindCardEvents(grid);

  // expose for language change re-render
  window._renderGallery = renderGallery;
}

// ── CART PAGE ────────────────────────────────────────────────────────────────
function initCart() {
  const cartItems = document.getElementById('cart-items');
  if (!cartItems) return;

  function wordsCount(n) {
    if (n === 1) return t('cart', 'w1');
    if (n > 1 && n < 5) return t('cart', 'w2');
    return t('cart', 'w5');
  }

  function renderCart() {
    const paintings = Cart.paintings();
    if (!paintings.length) {
      cartItems.innerHTML = `<div class="cart-empty">
        <div class="cart-empty-icon">🖼️</div>
        <h2>${t('cart','empty_t')}</h2>
        <p>${t('cart','empty_d')}</p>
        <a href="gallery.html" class="btn btn-primary">${t('cart','btn_gallery')}</a>
      </div>`;
      updateSummary(0, 0);
      return;
    }
    cartItems.innerHTML = paintings.map(p => `
      <div class="cart-item" data-id="${p.id}">
        <div class="cart-item-img">${artEl(p)}</div>
        <div class="cart-item-info">
          <p class="cart-item-artist">${p.artist}</p>
          <h3 class="cart-item-title">${ptitle(p)}</h3>
          <p class="cart-item-meta">${ptech(p)} · ${p.size}</p>
          <p class="cart-item-price">${fmt(p.price)}</p>
        </div>
        <button class="cart-item-remove js-remove" data-id="${p.id}" title="✕">✕</button>
      </div>`).join('');
    updateSummary(paintings.length, Cart.total());
  }

  function updateSummary(count, total) {
    const delivery = total > 0 ? 500 : 0;
    const countEl = document.getElementById('summary-count');
    if (countEl) countEl.textContent = count + ' ' + wordsCount(count);
    const subEl = document.getElementById('summary-subtotal');
    if (subEl) subEl.textContent = fmt(total);
    const delEl = document.getElementById('summary-delivery');
    if (delEl) delEl.textContent = delivery > 0 ? fmt(delivery) : t('cart', 'free');
    const totEl = document.getElementById('summary-total');
    if (totEl) totEl.textContent = fmt(total + delivery);
  }

  cartItems.addEventListener('click', e => {
    const btn = e.target.closest('.js-remove');
    if (!btn) return;
    Cart.remove(+btn.dataset.id);
    updateCartBadge();
    renderCart();
  });

  const clearBtn = document.getElementById('cart-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (confirm(t('cart','confirm'))) { Cart.clear(); updateCartBadge(); renderCart(); }
  });

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
    if (!Cart.count()) { toast(t('cart','toast_empty'), 'error'); return; }
    toast(t('cart','toast_ordered'), 'success');
    setTimeout(() => { Cart.clear(); updateCartBadge(); renderCart(); }, 1200);
  });

  renderCart();
  window._renderCart = renderCart;
}

// ── CONTACT FORM ─────────────────────────────────────────────────────────────
function initContact() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    toast(t('contact','toast_sent'), 'success');
    form.reset();
  });
}

// ── renderDynamic — called on language change ────────────────────────────────
function renderDynamic() {
  // index featured grid
  const fg = document.getElementById('featured-grid');
  if (fg) { const featured = PAINTINGS.filter(p => p.badge === 'new' || p.id <= 6).slice(0, 6); fg.innerHTML = featured.map(renderCard).join(''); }
  // gallery
  if (window._renderGallery) window._renderGallery();
  // cart
  if (window._renderCart) window._renderCart();
  // update cart badge text
  const cartBtn = document.querySelector('.cart-btn');
  if (cartBtn) {
    const count = cartBtn.querySelector('.cart-count');
    cartBtn.innerHTML = '';
    cartBtn.innerHTML = `🛒 <span data-i18n="cart_btn"></span> ` + (count ? count.outerHTML : '<span class="cart-count">0</span>');
    applyTranslations();
  }
  updateCartBadge();
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Cart.load();

  // ensure modal + toast containers
  if (!document.getElementById('modal-overlay')) {
    const el = document.createElement('div');
    el.className = 'modal-overlay'; el.id = 'modal-overlay';
    el.innerHTML = '<div class="modal"></div>';
    document.body.appendChild(el);
  }

  initHeader();
  initLangSwitcher(); // from i18n.js — also calls applyTranslations()
  initIndex();
  initGallery();
  initCart();
  initContact();
});
