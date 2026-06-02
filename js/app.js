'use strict';

// ── PAINTINGS DATA ────────────────────────────────────────────────────────────
const PAINTINGS = [
  {
    id: 1, artist: 'Igor Borshch', year: 2024, price: 300,
    category: 'portrait', technique: 'oil', size: '30 × 40 cm', badge: null,
    image: 'images/painting1.jpg',
    titles: { uk: 'Чорне мереживо', ru: 'Чёрное кружево', en: 'Black Lace', es: 'Encaje Negro' },
    descs: {
      uk: 'Витончена монохромна робота. Жіноче тіло передано з неймовірною точністю — кожен штрих підкреслює вишуканість форми на тлі об\'ємних квіткових деталей.',
      ru: 'Изысканная монохромная работа. Женское тело передано с невероятной точностью — каждый мазок подчёркивает изящество формы на фоне объёмных цветочных деталей.',
      en: 'An exquisite monochrome work. The female figure is rendered with incredible precision — every brushstroke emphasizes the elegance of form against sculptural floral details.',
      es: 'Una exquisita obra monocromática. La figura femenina se representa con una precisión increíble: cada pincelada enfatiza la elegancia de la forma sobre detalles florales escultóricos.',
    },
    gradient: 'linear-gradient(160deg,#F0F0F0 0%,#C8C8C8 25%,#888 50%,#333 75%,#111 100%)',
  },
  {
    id: 2, artist: 'Igor Borshch', year: 2024, price: 100,
    category: 'portrait', technique: 'oil', size: '40 × 30 cm', badge: null,
    image: 'images/painting2.jpg',
    titles: { uk: 'Вогонь і тінь', ru: 'Огонь и тень', en: 'Fire and Shadow', es: 'Fuego y Sombra' },
    descs: {
      uk: 'Експресивна фігуративна робота у теплій охристо-коричневій гамі. Енергійні мазки створюють відчуття руху та внутрішньої сили.',
      ru: 'Экспрессивная фигуративная работа в тёплой охристо-коричневой гамме. Энергичные мазки создают ощущение движения и внутренней силы.',
      en: 'An expressive figurative work in warm ochre and brown tones. Energetic brushstrokes create a sense of movement and inner power.',
      es: 'Una expresiva obra figurativa en tonos cálidos ocres y marrones. Las enérgicas pinceladas crean una sensación de movimiento y fuerza interior.',
    },
    gradient: 'linear-gradient(160deg,#8B3A0A 0%,#C05A20 25%,#D4820A 50%,#2A2A35 75%,#111 100%)',
  },
  {
    id: 3, artist: 'Igor Borshch', year: 2024, price: 100,
    category: 'portrait', technique: 'oil', size: '35 × 25 cm', badge: null,
    image: 'images/painting3.jpg',
    titles: { uk: 'На підборах', ru: 'На каблуках', en: 'On Heels', es: 'Sobre Tacones' },
    descs: {
      uk: 'Динамічна монохромна композиція. Жіноча фігура у вільному падінні — відчуття невагомості та виклику передано через широкі, сміливі мазки.',
      ru: 'Динамичная монохромная композиция. Женская фигура в свободном падении — ощущение невесомости и вызова передано через широкие, смелые мазки.',
      en: 'A dynamic monochrome composition. The female figure in free fall — a sense of weightlessness and defiance conveyed through bold, sweeping brushstrokes.',
      es: 'Una composición monocromática dinámica. La figura femenina en caída libre: la sensación de ingravidez y desafío se transmite con pinceladas amplias y atrevidas.',
    },
    gradient: 'linear-gradient(160deg,#D8D8D8 0%,#A0A0A0 30%,#555 60%,#1A1A1A 85%,#0A0A0A 100%)',
  },
  {
    id: 4, artist: 'Igor Borshch', year: 2024, price: 150,
    category: 'portrait', technique: 'oil', size: '70 × 50 cm', badge: 'new',
    image: 'images/painting4.jpg',
    titles: { uk: 'Дика свобода', ru: 'Дикая свобода', en: 'Wild Freedom', es: 'Libertad Salvaje' },
    descs: {
      uk: 'Повнофігурний портрет жінки у шкіряному вбранні. Руки, підняті вгору, поза і впевненість — символ свободи та сили духу.',
      ru: 'Полнофигурный портрет женщины в кожаном наряде. Поднятые руки, поза и уверенность — символ свободы и силы духа.',
      en: 'A full-figure portrait of a woman in leather attire. Arms raised, posture and confidence — a symbol of freedom and strength of spirit.',
      es: 'Un retrato de figura completa de una mujer con atuendo de cuero. Brazos levantados, postura y confianza: un símbolo de libertad y fortaleza espiritual.',
    },
    gradient: 'linear-gradient(160deg,#E8DDD0 0%,#C4B5A0 25%,#8B7355 50%,#5C4A35 75%,#2A1F15 100%)',
  },
  {
    id: 5, artist: 'Igor Borshch', year: 2024, price: 200,
    category: 'portrait', technique: 'oil', size: '70 × 50 cm', badge: null,
    image: 'images/painting5.jpg',
    titles: { uk: 'Момент спокою', ru: 'Миг покоя', en: 'Moment of Peace', es: 'Momento de Paz' },
    descs: {
      uk: 'Жінка біля води у чорному купальнику. Темний фон підкреслює теплоту шкіри та бірюзовий відблиск ванни — момент розслаблення і самоти.',
      ru: 'Женщина у воды в чёрном купальнике. Тёмный фон подчёркивает теплоту кожи и бирюзовый отблеск ванны — момент расслабления и уединения.',
      en: 'A woman by the water in a black swimsuit. The dark background highlights the warmth of the skin and the turquoise glow of the bath — a moment of relaxation and solitude.',
      es: 'Una mujer junto al agua con bañador negro. El fondo oscuro realza la calidez de la piel y el brillo turquesa del baño: un momento de relajación y soledad.',
    },
    gradient: 'linear-gradient(160deg,#0A1520 0%,#1A2535 30%,#C07840 55%,#5FB8B0 80%,#0A1520 100%)',
  },
];

// ── HELPERS ─────────────────────────────────────────────────────────────────
function pt(p, field) { return (p[field + 's'] || {})[currentLang] || (p[field + 's'] || {})[Object.keys(p[field + 's'] || {})[0]] || ''; }
function ptitle(p) { return pt(p, 'title'); }
function pdesc(p) { return pt(p, 'desc'); }
function ptech(p) { return t('tech', p.technique) || p.technique; }
function pcat(p) { return t('cat', p.category) || p.category; }
function fmt(n) { return new Intl.NumberFormat('de-DE').format(n) + ' €'; }

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
let galleryState = { category: 'all', maxPrice: 500, sort: 'default' };

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
    const delivery = total > 0 ? 10 : 0;
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
