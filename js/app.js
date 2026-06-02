'use strict';

// ── DATA ────────────────────────────────────────────────────────────────────
const PAINTINGS = [
  {
    id: 1,
    title: 'Закат над морем',
    artist: 'Игорь Борщ',
    year: 2023,
    price: 45000,
    category: 'пейзаж',
    technique: 'Масло на холсте',
    size: '80 × 100 см',
    badge: 'new',
    description: 'Теплые оттенки заходящего солнца над спокойной морской гладью. Картина передаёт ощущение покоя и бесконечности.',
    gradient: 'linear-gradient(160deg, #FF6B35 0%, #F7931E 25%, #FFD700 45%, #FF4500 65%, #1A1A2E 100%)',
  },
  {
    id: 2,
    title: 'Зимний лес',
    artist: 'Мария Степаненко',
    year: 2022,
    price: 38000,
    category: 'пейзаж',
    technique: 'Масло на холсте',
    size: '60 × 80 см',
    badge: null,
    description: 'Безмолвие зимнего леса в серебристых и синих тонах. Каждая деталь передаёт морозную свежесть.',
    gradient: 'linear-gradient(180deg, #B8D4E8 0%, #7AA8C7 30%, #E8F4FF 55%, #C8DFF0 70%, #2C4A6E 100%)',
  },
  {
    id: 3,
    title: 'Городской пейзаж',
    artist: 'Алексей Громов',
    year: 2024,
    price: 62000,
    category: 'городской',
    technique: 'Акрил на холсте',
    size: '100 × 120 см',
    badge: 'new',
    description: 'Динамичный ночной город, отраженный в мокрых улицах. Смешение фиолетового и оранжевого создаёт неповторимую атмосферу.',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #8B5CF6 55%, #F97316 75%, #1a1a2e 100%)',
  },
  {
    id: 4,
    title: 'Абстракция №1',
    artist: 'Игорь Борщ',
    year: 2023,
    price: 29000,
    category: 'абстракция',
    technique: 'Акрил, микс-медиа',
    size: '70 × 70 см',
    badge: null,
    description: 'Энергичная абстрактная композиция. Смелые цветовые переходы и динамичные линии создают ощущение движения.',
    gradient: 'linear-gradient(45deg, #FF006E 0%, #8338EC 25%, #3A86FF 50%, #06D6A0 75%, #FFB703 100%)',
  },
  {
    id: 5,
    title: 'Полевые цветы',
    artist: 'Мария Степаненко',
    year: 2022,
    price: 24000,
    oldPrice: 32000,
    category: 'натюрморт',
    technique: 'Масло на холсте',
    size: '50 × 60 см',
    badge: 'sale',
    description: 'Нежный букет полевых цветов на светлом фоне. Картина несёт в себе летнюю лёгкость и радость.',
    gradient: 'linear-gradient(160deg, #98FB98 0%, #7FFF00 20%, #FFD700 45%, #FF69B4 65%, #9370DB 85%, #98FB98 100%)',
  },
  {
    id: 6,
    title: 'Портрет незнакомки',
    artist: 'Алексей Громов',
    year: 2021,
    price: 55000,
    category: 'портрет',
    technique: 'Масло на холсте',
    size: '60 × 80 см',
    badge: null,
    description: 'Загадочный портрет молодой женщины. Тёплые охристые тона и мягкая светотень придают работе классическую элегантность.',
    gradient: 'linear-gradient(160deg, #D4A96A 0%, #C08040 25%, #8B5E3C 50%, #5C3D20 75%, #2A1A0A 100%)',
  },
  {
    id: 7,
    title: 'Горный рассвет',
    artist: 'Мария Степаненко',
    year: 2024,
    price: 47000,
    category: 'пейзаж',
    technique: 'Акварель',
    size: '75 × 90 см',
    badge: 'new',
    description: 'Первые лучи солнца над горными вершинами. Акварельные переходы передают нежность раннего утра.',
    gradient: 'linear-gradient(160deg, #FF8C69 0%, #FFA07A 20%, #87CEEB 50%, #4A90D9 70%, #2C5F8A 90%, #1A3A5C 100%)',
  },
  {
    id: 8,
    title: 'Ночная тишина',
    artist: 'Игорь Борщ',
    year: 2023,
    price: 41000,
    category: 'городской',
    technique: 'Масло на холсте',
    size: '80 × 100 см',
    badge: null,
    description: 'Ночная улица после дождя. Отражения фонарей в лужах создают магическую атмосферу покоя.',
    gradient: 'linear-gradient(160deg, #0D0D1A 0%, #1A1A3E 30%, #2E4482 50%, #FFD700 55%, #1A1A3E 65%, #0D0D1A 100%)',
  },
  {
    id: 9,
    title: 'Весенний сад',
    artist: 'Мария Степаненко',
    year: 2022,
    price: 33000,
    category: 'пейзаж',
    technique: 'Масло на холсте',
    size: '70 × 80 см',
    badge: null,
    description: 'Цветущий вишнёвый сад в первые дни весны. Нежные розовые и белые оттенки передают пробуждение природы.',
    gradient: 'linear-gradient(160deg, #FFB7C5 0%, #FF91A4 20%, #FFC8A2 40%, #98FB98 65%, #90EE90 85%, #3CB371 100%)',
  },
  {
    id: 10,
    title: 'Осенний парк',
    artist: 'Алексей Громов',
    year: 2023,
    price: 36000,
    category: 'пейзаж',
    technique: 'Акрил на холсте',
    size: '90 × 110 см',
    badge: null,
    description: 'Золотая осень в городском парке. Медные и бронзовые оттенки создают атмосферу задумчивости.',
    gradient: 'linear-gradient(160deg, #D2691E 0%, #CD853F 20%, #DAA520 40%, #8B4513 60%, #2F1B0D 80%, #1A0F08 100%)',
  },
  {
    id: 11,
    title: 'Море утром',
    artist: 'Игорь Борщ',
    year: 2024,
    price: 52000,
    category: 'пейзаж',
    technique: 'Масло на холсте',
    size: '100 × 80 см',
    badge: 'new',
    description: 'Утреннее море в бирюзовых и лазурных тонах. Спокойствие и чистота раннего часа.',
    gradient: 'linear-gradient(160deg, #87CEEB 0%, #00CED1 25%, #20B2AA 45%, #008B8B 65%, #F5DEB3 85%, #DEB887 100%)',
  },
  {
    id: 12,
    title: 'Красный мак',
    artist: 'Мария Степаненко',
    year: 2021,
    price: 0,
    category: 'натюрморт',
    technique: 'Масло на холсте',
    size: '40 × 50 см',
    badge: 'sold',
    description: 'Одиночный красный мак на тёмном фоне. Минималистичная, но выразительная работа.',
    gradient: 'linear-gradient(160deg, #1A0A0A 0%, #2D0808 30%, #CC0000 55%, #FF2222 68%, #2D0808 80%, #1A0A0A 100%)',
  },
];

// ── CART ─────────────────────────────────────────────────────────────────────
const Cart = {
  items: [],

  load() {
    try { this.items = JSON.parse(localStorage.getItem('art_cart') || '[]'); } catch { this.items = []; }
  },

  save() { localStorage.setItem('art_cart', JSON.stringify(this.items)); },

  add(id) {
    if (this.items.includes(id)) return false;
    this.items.push(id);
    this.save();
    return true;
  },

  remove(id) {
    this.items = this.items.filter(i => i !== id);
    this.save();
  },

  has(id) { return this.items.includes(id); },

  count() { return this.items.length; },

  total() {
    return this.items.reduce((sum, id) => {
      const p = PAINTINGS.find(x => x.id === id);
      return sum + (p ? (p.price || 0) : 0);
    }, 0);
  },

  paintings() {
    return this.items.map(id => PAINTINGS.find(x => x.id === id)).filter(Boolean);
  },

  clear() { this.items = []; this.save(); }
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('ru-RU').format(n) + ' ₴'; }

function toast(msg, type = '') {
  const wrap = document.getElementById('toast-container');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ` ${type}` : '');
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3000);
}

function artDiv(gradient, extra = '') {
  return `<div class="card-art" style="background:${gradient}${extra}"></div>`;
}

// ── HEADER scroll effect ───────────────────────────────────────────────────
function initHeader() {
  const h = document.querySelector('.header');
  if (!h) return;
  const update = () => h.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', update, { passive: true });
  update();

  // burger menu
  const burger = h.querySelector('.burger');
  const nav = h.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('open');
      burger.classList.toggle('active');
    });
    document.addEventListener('click', e => {
      if (!h.contains(e.target)) { nav.classList.remove('open'); burger.classList.remove('active'); }
    });
  }

  // active nav link
  const page = window.location.pathname.split('/').pop() || 'index.html';
  h.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });

  updateCartBadge();
}

function updateCartBadge() {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = Cart.count();
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  });
}

// ── PAINTING CARD HTML ────────────────────────────────────────────────────
function renderCard(p) {
  const sold = p.badge === 'sold';
  const inCart = Cart.has(p.id);
  return `
  <div class="painting-card" data-id="${p.id}">
    <div class="card-image">
      ${artDiv(p.gradient, ';width:100%;height:100%')}
      ${p.badge ? `<span class="card-badge badge-${p.badge}">${p.badge === 'new' ? 'Новинка' : p.badge === 'sold' ? 'Продана' : 'Скидка'}</span>` : ''}
      ${!sold ? `
      <div class="card-overlay">
        <div class="overlay-actions">
          <button class="overlay-btn overlay-btn-view js-view" data-id="${p.id}">Подробнее</button>
          <button class="overlay-btn overlay-btn-buy js-buy" data-id="${p.id}">${inCart ? 'В корзине' : 'Купить'}</button>
        </div>
      </div>` : ''}
    </div>
    <div class="card-body">
      <p class="card-artist">${p.artist}</p>
      <h3 class="card-title">${p.title}</h3>
      <p class="card-meta">${p.technique} · ${p.size}</p>
      <div class="card-footer">
        <div>
          <span class="card-price">${sold ? 'Продана' : fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="card-price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
        ${!sold ? `<button class="add-to-cart-btn js-buy${inCart ? ' in-cart' : ''}" data-id="${p.id}">${inCart ? '✓ В корзине' : '+ В корзину'}</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(id) {
  const p = PAINTINGS.find(x => x.id === id);
  if (!p) return;
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const sold = p.badge === 'sold';
  const inCart = Cart.has(p.id);

  overlay.querySelector('.modal').innerHTML = `
    <button class="modal-close" id="modal-close-btn">✕</button>
    <div class="modal-image">${artDiv(p.gradient, ';width:100%;height:100%')}</div>
    <div class="modal-content">
      <p class="modal-artist">${p.artist}</p>
      <h2 class="modal-title">${p.title}</h2>
      <p class="modal-year">${p.year} год</p>
      <p class="modal-desc">${p.description}</p>
      <div class="modal-details">
        <div class="detail-item"><label>Техника</label><span>${p.technique}</span></div>
        <div class="detail-item"><label>Размер</label><span>${p.size}</span></div>
        <div class="detail-item"><label>Категория</label><span>${p.category.charAt(0).toUpperCase() + p.category.slice(1)}</span></div>
        <div class="detail-item"><label>Статус</label><span>${sold ? 'Продана' : 'В наличии'}</span></div>
      </div>
      ${!sold ? `<p class="modal-price">${fmt(p.price)}</p>
      <div class="modal-actions">
        <button class="btn btn-outline" id="modal-close-btn2">Закрыть</button>
        <button class="btn btn-primary js-buy${inCart ? ' in-cart' : ''}" data-id="${p.id}">${inCart ? '✓ В корзине' : '🛒 В корзину'}</button>
      </div>` : `<p class="modal-price text-accent">Продана</p><div class="modal-actions"><button class="btn btn-outline" id="modal-close-btn2">Закрыть</button></div>`}
    </div>`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  const btn2 = overlay.querySelector('#modal-close-btn2');
  if (btn2) btn2.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // buy button inside modal
  const buyBtn = overlay.querySelector('.js-buy');
  if (buyBtn) buyBtn.addEventListener('click', e => { handleBuy(id); closeModal(); });

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

// ── BUY HANDLER ───────────────────────────────────────────────────────────
function handleBuy(id) {
  const p = PAINTINGS.find(x => x.id === id);
  if (!p || p.badge === 'sold') return;
  if (Cart.has(id)) {
    window.location.href = 'cart.html';
    return;
  }
  Cart.add(id);
  updateCartBadge();
  toast(`«${p.title}» добавлена в корзину`, 'success');
  // refresh card states on current page
  document.querySelectorAll(`[data-id="${id}"] .js-buy`).forEach(btn => {
    btn.classList.add('in-cart');
    btn.textContent = '✓ В корзине';
  });
}

// ── DELEGATED CLICK ───────────────────────────────────────────────────────
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

// ── INDEX PAGE ────────────────────────────────────────────────────────────
function initIndex() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  const featured = PAINTINGS.filter(p => p.badge === 'new' || p.id <= 6).slice(0, 6);
  grid.innerHTML = featured.map(renderCard).join('');
  bindCardEvents(grid);
}

// ── GALLERY PAGE ──────────────────────────────────────────────────────────
function initGallery() {
  const grid = document.getElementById('paintings-grid');
  if (!grid) return;

  let activeCategory = 'все';
  let maxPrice = 100000;
  let sortBy = 'default';

  const categories = ['все', ...new Set(PAINTINGS.map(p => p.category))];
  const catContainer = document.getElementById('cat-filters');
  if (catContainer) {
    catContainer.innerHTML = categories.map(c =>
      `<label class="filter-option${c === 'все' ? ' active' : ''}">
        <input type="radio" name="cat" value="${c}">
        ${c.charAt(0).toUpperCase() + c.slice(1)}
      </label>`
    ).join('');
    catContainer.addEventListener('click', e => {
      const opt = e.target.closest('.filter-option');
      if (!opt) return;
      catContainer.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active'));
      opt.classList.add('active');
      activeCategory = opt.querySelector('input').value;
      render();
    });
  }

  const priceInput = document.getElementById('price-range');
  const priceVal = document.getElementById('price-val');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      maxPrice = +priceInput.value;
      if (priceVal) priceVal.textContent = fmt(maxPrice);
      render();
    });
  }

  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.addEventListener('change', () => { sortBy = sortSel.value; render(); });

  function render() {
    let list = PAINTINGS.filter(p => {
      if (activeCategory !== 'все' && p.category !== activeCategory) return false;
      if (p.price > maxPrice && p.badge !== 'sold') return false;
      return true;
    });
    if (sortBy === 'price-asc') list = list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') list = list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'new') list = list.sort((a, b) => b.year - a.year);

    const countEl = document.getElementById('gallery-count');
    if (countEl) countEl.textContent = `Найдено: ${list.length} работ`;

    grid.innerHTML = list.length
      ? list.map(renderCard).join('')
      : `<div class="empty-state"><h3>Ничего не найдено</h3><p>Попробуйте изменить параметры поиска</p></div>`;
  }

  render();
  bindCardEvents(grid);
}

// ── CART PAGE ─────────────────────────────────────────────────────────────
function initCart() {
  const cartItems = document.getElementById('cart-items');
  if (!cartItems) return;

  function renderCart() {
    const paintings = Cart.paintings();
    if (!paintings.length) {
      cartItems.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🖼️</div>
          <h2>Корзина пуста</h2>
          <p>Добавьте понравившиеся работы из галереи</p>
          <a href="gallery.html" class="btn btn-primary">Перейти в галерею</a>
        </div>`;
      updateSummary(0, 0);
      return;
    }

    cartItems.innerHTML = paintings.map(p => `
      <div class="cart-item" data-id="${p.id}">
        <div class="cart-item-img">${artDiv(p.gradient, ';width:100%;height:100%')}</div>
        <div class="cart-item-info">
          <p class="cart-item-artist">${p.artist}</p>
          <h3 class="cart-item-title">${p.title}</h3>
          <p class="cart-item-meta">${p.technique} · ${p.size}</p>
          <p class="cart-item-price">${fmt(p.price)}</p>
        </div>
        <button class="cart-item-remove js-remove" data-id="${p.id}" title="Удалить">✕</button>
      </div>
    `).join('');

    updateSummary(paintings.length, Cart.total());
  }

  function updateSummary(count, total) {
    const delivery = total > 0 ? 500 : 0;
    document.getElementById('summary-count').textContent = count + (count === 1 ? ' работа' : count < 5 ? ' работы' : ' работ');
    document.getElementById('summary-subtotal').textContent = fmt(total);
    document.getElementById('summary-delivery').textContent = delivery > 0 ? fmt(delivery) : 'Бесплатно';
    document.getElementById('summary-total').textContent = fmt(total + delivery);
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
    if (confirm('Очистить корзину?')) { Cart.clear(); updateCartBadge(); renderCart(); }
  });

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
    if (!Cart.count()) { toast('Корзина пуста', 'error'); return; }
    toast('Заказ оформлен! Мы свяжемся с вами в ближайшее время.', 'success');
    setTimeout(() => { Cart.clear(); updateCartBadge(); renderCart(); }, 1200);
  });

  renderCart();
}

// ── CONTACT FORM ─────────────────────────────────────────────────────────
function initContact() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    toast('Ваше сообщение отправлено! Спасибо за обращение.', 'success');
    form.reset();
  });
}

// ── BOOT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Cart.load();
  initHeader();
  initIndex();
  initGallery();
  initCart();
  initContact();

  // create modal container if absent
  if (!document.getElementById('modal-overlay')) {
    const el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modal-overlay';
    el.innerHTML = '<div class="modal"></div>';
    document.body.appendChild(el);
  }

  // toast container
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    tc.className = 'toast-container';
    document.body.appendChild(tc);
  }
});
