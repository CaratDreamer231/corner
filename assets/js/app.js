/* ============================================================
   CORNER — global app: i18n, cart, auth, search, product modal
   Plain JS. No build step.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var products = window.CORNER_PRODUCTS || [];
  var brands = window.CORNER_BRANDS || [];
  var i18n = window.CORNER_I18N || { en: {}, es: {} };
  var cfg = window.CORNER_STATE || { freeShippingAt: 49 };

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  var state = {
    lang: storageGet('corner_lang', 'en') === 'es' ? 'es' : 'en',
    cart: [],
    selectedProduct: null,
    modalQty: 1,
    searchQuery: ''
  };

  try {
    var savedCart = JSON.parse(storageGet('corner_cart', '[]'));
    if (Array.isArray(savedCart)) {
      state.cart = savedCart.filter(function (line) {
        return line && line.id && typeof line.qty === 'number' && line.qty > 0;
      });
    }
  } catch (e) { state.cart = []; }

  function money(value) {
    var locale = state.lang === 'es' ? 'es-US' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
    } catch (e) {
      return '$' + Number(value).toFixed(2);
    }
  }

  function t(key, vars) {
    var langPack = i18n[state.lang] || i18n.en || {};
    var value = langPack[key];
    if (typeof value === 'undefined') value = (i18n.en || {})[key];
    if (typeof value === 'undefined') value = key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        value = String(value).replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return value;
  }

  function productName(product) {
    if (!product) return '';
    return state.lang === 'es' && product.nameEs ? product.nameEs : product.name;
  }
  function productDesc(product) {
    if (!product) return '';
    return state.lang === 'es' && product.descEs ? product.descEs : product.desc;
  }
  function productSpecs(product) {
    if (!product) return [];
    return state.lang === 'es' && product.specsEs ? product.specsEs : product.specs;
  }
  function conditionLabel(product) {
    if (!product) return '';
    var key = 'product.condition.' + product.condition;
    var label = t(key);
    return label === key ? product.condition : label;
  }
  function getProduct(id) {
    return products.filter(function (p) { return p.id === id; })[0] || null;
  }
  function discount(product) {
    if (!product || !product.compare) return 0;
    return Math.max(1, Math.round((1 - product.price / product.compare) * 100));
  }

  function translatePage(root) {
    root = root || document;
    $$('[data-i18n]', root).forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = t(key);
      if (value !== key) el.textContent = value;
    });
    $$('[data-i18n-html]', root).forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var value = t(key);
      if (value !== key) el.innerHTML = value;
    });
    $$('[data-i18n-placeholder]', root).forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    $$('[data-i18n-aria-label]', root).forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    $$('[data-i18n-title]', root).forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    $$('.lang-switch button').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === state.lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.documentElement.lang = state.lang === 'es' ? 'es' : 'en';
    var pageTitle = document.body.getAttribute(state.lang === 'es' ? 'data-title-es' : 'data-title-en');
    if (pageTitle) document.title = pageTitle;
  }

  function setLang(lang) {
    state.lang = lang === 'es' ? 'es' : 'en';
    storageSet('corner_lang', state.lang);
    translatePage();
    renderHome();
    renderCartDrawer();
    if ($('#searchOverlay') && $('#searchOverlay').classList.contains('is-open')) renderSearchResults(state.searchQuery);
    document.dispatchEvent(new CustomEvent('corner:lang', { detail: { lang: state.lang } }));
    window.dispatchEvent(new CustomEvent('corner:lang', { detail: { lang: state.lang } }));
  }

  function toast(message) {
    var stack = $('#toastStack');
    if (!stack) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="dot"></span><span></span>';
    el.lastElementChild.textContent = message;
    stack.appendChild(el);
    window.setTimeout(function () {
      el.classList.add('is-out');
      window.setTimeout(function () { el.remove(); }, 380);
    }, 3200);
  }

  /* ---------------- overlays / body lock ---------------- */
  function anyOverlayOpen() {
    return $$('.cart-drawer.is-open, .search-overlay.is-open, .auth-modal.is-open, .product-modal.is-open, .mobile-nav.is-open, .drawer-backdrop.is-open, .modal-backdrop.is-open').length > 0;
  }
  function refreshBodyLock() {
    document.body.classList.toggle('no-scroll', anyOverlayOpen());
  }

  /* ---------------- cart ---------------- */
  function cartCount() {
    return state.cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }
  function cartLines() {
    return state.cart.map(function (line) {
      var p = getProduct(line.id);
      return p ? { product: p, qty: line.qty } : null;
    }).filter(Boolean);
  }
  function cartTotals() {
    var lines = cartLines();
    var subtotal = 0;
    var savings = 0;
    lines.forEach(function (line) {
      subtotal += line.product.price * line.qty;
      savings += Math.max(0, line.product.compare - line.product.price) * line.qty;
    });
    var shipping = subtotal >= cfg.freeShippingAt || subtotal === 0 ? 0 : 6.95;
    return {
      subtotal: subtotal,
      savings: savings,
      shipping: shipping,
      total: subtotal + shipping,
      count: lines.reduce(function (sum, line) { return sum + line.qty; }, 0)
    };
  }
  function saveCart() {
    storageSet('corner_cart', JSON.stringify(state.cart));
    updateCartBadge();
    renderCartDrawer();
    document.dispatchEvent(new CustomEvent('corner:cart', { detail: { cart: state.cart, totals: cartTotals() } }));
    window.dispatchEvent(new CustomEvent('corner:cart', { detail: { cart: state.cart, totals: cartTotals() } }));
  }
  function addToCart(id, qty, options) {
    options = options || {};
    var p = getProduct(id);
    if (!p) return;
    var line = state.cart.filter(function (item) { return item.id === id; })[0];
    if (line) line.qty += qty || 1;
    else state.cart.push({ id: id, qty: qty || 1 });
    saveCart();
    if (options.open !== false) openCart();
    toast(p.brand + ' · ' + productName(p) + ' — ' + t('common.added'));
  }
  function clearCart() {
    state.cart = [];
    saveCart();
  }
  function updateQty(id, qty) {
    var line = state.cart.filter(function (item) { return item.id === id; })[0];
    if (!line) return;
    if (qty <= 0) {
      state.cart = state.cart.filter(function (item) { return item.id !== id; });
    } else {
      line.qty = qty;
    }
    saveCart();
  }
  function updateCartBadge() {
    var count = cartCount();
    $$('.bag-count').forEach(function (el) {
      el.textContent = count > 99 ? '99+' : String(count);
      el.classList.toggle('is-on', count > 0);
    });
    $$('[data-bag-count-text]').forEach(function (el) {
      el.textContent = count ? t('cart.items', { n: count }) : '';
    });
  }
  function openCart() {
    renderCartDrawer();
    var drawer = $('#cartDrawer');
    var backdrop = $('#cartBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    refreshBodyLock();
    window.setTimeout(function () { var close = $('.cart-head button', drawer); if (close) close.focus(); }, 140);
  }
  function closeCart() {
    var drawer = $('#cartDrawer');
    var backdrop = $('#cartBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    refreshBodyLock();
  }
  function renderCartDrawer() {
    var body = $('#cartBody');
    var foot = $('#cartFoot');
    if (!body || !foot) return;
    var meta = $('[data-bag-count-text]');
    if (meta) {
      var c = cartCount();
      meta.textContent = c ? t('cart.items', { n: c }) : '';
    }
    var lines = cartLines();
    var totals = cartTotals();
    if (!lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
          </div>
          <h3>${t('cart.empty.title')}</h3>
          <p>${t('cart.empty.body')}</p>
          <a class="btn btn-ink" href="shop.html">${t('cart.empty.cta')}</a>
        </div>
      `;
      foot.innerHTML = '';
      return;
    }
    var remaining = Math.max(0, cfg.freeShippingAt - totals.subtotal);
    var pct = Math.min(100, (totals.subtotal / cfg.freeShippingAt) * 100);
    var shippingLine = remaining > 0
      ? t('cart.shipping.away', { amount: money(remaining) })
      : t('cart.shipping.free');
    body.innerHTML = `
      <div class="cart-shipping">
        <div class="cart-shipping-top"><span>${remaining > 0 ? t('cart.shipping.over') : t('cart.shipping.free')}</span><span>${remaining > 0 ? t('cart.shipping.away', { amount: money(remaining) }) : '✓'}</span></div>
        <div class="cart-shipping-bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="cart-items">
        ${lines.map(function (line) {
          var p = line.product;
          return `<div class="cart-item">
            <div class="cart-item-img"><img src="${p.image}" alt="${productName(p)}" loading="lazy"></div>
            <div class="cart-item-info">
              <span class="mono">${p.brand}</span>
              <h4>${productName(p)}</h4>
              <div class="cart-item-price">${money(p.price)} <s>${money(p.compare)}</s></div>
              <div class="qty">
                <button type="button" data-cart-minus="${p.id}" aria-label="-">−</button>
                <span>${line.qty}</span>
                <button type="button" data-cart-plus="${p.id}" aria-label="+">+</button>
              </div>
            </div>
            <button type="button" class="cart-item-remove" data-cart-remove="${p.id}">${t('cart.item.remove')}</button>
          </div>`;
        }).join('')}
      </div>
    `;
    foot.innerHTML = `
      <div class="cart-savings"><span>${t('cart.savings')}</span><span class="save">− ${money(totals.savings)}</span></div>
      <div class="cart-total"><span class="label">${t('cart.subtotal')}</span><span class="amount">${money(totals.subtotal)}</span></div>
      <a class="btn btn-ink btn-full" href="checkout.html">${t('cart.checkout')} <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <p class="cart-tax">${t('cart.tax')}</p>
    `;
  }

  /* ---------------- product cards ---------------- */
  function starSvg() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6Z"/></svg>';
  }
  function plusSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  }
  function renderProductCard(p, index) {
    var off = discount(p);
    var delay = index % 4;
    return `<article class="product-card reveal reveal-delay-${delay}">
      <div class="product-media ${p.tone}">
        <button class="product-hit" type="button" data-product-id="${p.id}" aria-label="${productName(p)}"></button>
        <div class="product-flags">
          <span class="chip">${conditionLabel(p)}</span>
          ${p.badge ? `<span class="chip chip-dark">${state.lang === 'es' && p.badgeEs ? p.badgeEs : p.badge}</span>` : ''}
        </div>
        <span class="product-media-num">${String(index + 1).padStart(2, '0')}</span>
        <img src="${p.image}" alt="${p.brand} ${productName(p)}" loading="lazy">
        <span class="product-save">${t('product.off', { n: off })}</span>
        <button class="quick-add" type="button" data-add-id="${p.id}" aria-label="${t('common.add')}">${plusSvg()}</button>
      </div>
      <div class="product-info">
        <div class="product-brand-row">
          <span class="product-brand"><img src="${p.logo}" alt="" loading="lazy">${p.brand}</span>
          <span class="product-rating">${starSvg()}${p.rating.toFixed(1)}</span>
        </div>
        <h3 class="product-name"><button class="product-name-btn" type="button" data-product-id="${p.id}">${productName(p)}</button></h3>
        <div class="product-price-row">
          <div class="product-price"><span class="now">${money(p.price)}</span><span class="was">${money(p.compare)}</span></div>
          <span class="product-condition">${t('product.save', { amount: money(Math.max(0, p.compare - p.price)) })}</span>
        </div>
        <div class="stock-line">
          <div class="stock-bar"><span style="width:${p.stockBar}%"></span></div>
          <span class="stock-label">${t('product.only', { n: p.stock })}</span>
        </div>
      </div>
    </article>`;
  }
  function renderHome() {
    var featured = $('[data-featured-grid]');
    if (featured) {
      var featuredProducts = products.filter(function (p) { return p.featured; }).slice(0, 4);
      featured.innerHTML = featuredProducts.map(renderProductCard).join('');
    }
    var under = $('[data-under50-grid]');
    if (under) {
      var underProducts = products.filter(function (p) { return !p.featured && p.price < 50; }).slice(0, 4);
      under.innerHTML = underProducts.map(function (p, i) { return renderProductCard(p, i); }).join('');
    }
    renderTicker();
    renderBrandRows();
    observeReveals();
  }
  function renderTicker() {
    var track = $('[data-ticker-track]');
    if (!track) return;
    var doubled = brands.concat(brands);
    track.innerHTML = doubled.map(function (b) {
      return `<span class="ticker-item"><img src="${b.logo}" alt="" loading="lazy">${b.name}<span style="opacity:.3;font-family:var(--mono);font-size:9px;margin-left:10px">●</span></span>`;
    }).join('');
  }
  function renderBrandRows() {
    var row1 = $('[data-brand-row-1]');
    var row2 = $('[data-brand-row-2]');
    if (row1) {
      var a = brands.slice(0, 8).concat(brands.slice(0, 8));
      row1.innerHTML = a.map(function (b) {
        return `<span class="brand-tile"><img src="${b.logo}" alt="" loading="lazy"><span>${b.name}</span></span>`;
      }).join('');
    }
    if (row2) {
      var b2 = brands.slice(8).concat(brands.slice(8));
      row2.innerHTML = b2.map(function (b) {
        return `<span class="brand-tile"><img src="${b.logo}" alt="" loading="lazy"><span>${b.name}</span></span>`;
      }).join('');
    }
  }

  /* ---------------- auth ---------------- */
  function getUser() {
    try { return JSON.parse(storageGet('corner_user', 'null')); } catch (e) { return null; }
  }
  function setUser(user) {
    if (user) storageSet('corner_user', JSON.stringify(user));
    else storageRemove('corner_user');
    document.dispatchEvent(new CustomEvent('corner:auth', { detail: { user: user } }));
    window.dispatchEvent(new CustomEvent('corner:auth', { detail: { user: user } }));
  }
  function openAuth(mode) {
    var modal = $('#authModal');
    var backdrop = $('#authBackdrop');
    if (!modal || !backdrop) return;
    switchAuth(mode || 'signin');
    modal.classList.add('is-open');
    backdrop.classList.add('is-open');
    refreshBodyLock();
    window.setTimeout(function () { var first = $('.auth-panel.is-on input', modal); if (first) first.focus(); }, 180);
  }
  function closeAuth() {
    var modal = $('#authModal');
    var backdrop = $('#authBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    refreshBodyLock();
  }
  function switchAuth(mode) {
    var modal = $('#authModal');
    if (!modal) return;
    $$('.auth-tab', modal).forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-auth-tab') === mode);
    });
    $$('.auth-panel', modal).forEach(function (panel) {
      var on = panel.getAttribute('data-auth-panel') === mode;
      panel.classList.toggle('is-on', on);
      panel.hidden = !on;
    });
    var err = $('[data-auth-error]', modal);
    if (err) err.textContent = '';
  }
  function validEmail(value) {
    return value.indexOf('@') > 0 && value.indexOf('.') > value.indexOf('@') + 1;
  }
  function bindAuth() {
    document.addEventListener('click', function (e) {
      var open = e.target.closest('[data-auth-open]');
      if (open) {
        e.preventDefault();
        if (getUser()) {
          window.location.href = 'account.html';
        } else {
          openAuth(open.getAttribute('data-auth-open') || 'signin');
        }
      }
      if (e.target.closest('[data-auth-close]')) closeAuth();
      var tab = e.target.closest('[data-auth-tab]');
      if (tab) switchAuth(tab.getAttribute('data-auth-tab'));
      if (e.target.closest('[data-forgot]')) {
        toast(state.lang === 'es' ? 'Enlace de demostración: revisa tu bandeja de entrada.' : 'Demo link sent — check your inbox.');
      }
    });
    var signinForm = $('#signinForm');
    if (signinForm) {
      signinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = signinForm.querySelector('[name="email"]').value.trim();
        var password = signinForm.querySelector('[name="password"]').value;
        var err = $('[data-auth-error]');
        if (!validEmail(email)) { err.textContent = t('auth.error.email'); return; }
        if (password.length < 8) { err.textContent = t('auth.error.password'); return; }
        var existing = getUser();
        var name = existing && existing.email === email ? existing.name : email.split('@')[0].replace(/[._-]/g, ' ');
        var user = { name: name, email: email, createdAt: existing && existing.email === email ? existing.createdAt : new Date().toISOString() };
        setUser(user);
        closeAuth();
        toast(t('auth.success.signin', { name: user.name }));
      });
    }
    var createForm = $('#createForm');
    if (createForm) {
      createForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var first = createForm.querySelector('[name="first"]').value.trim();
        var last = createForm.querySelector('[name="last"]').value.trim();
        var email = createForm.querySelector('[name="email"]').value.trim();
        var password = createForm.querySelector('[name="password"]').value;
        var terms = createForm.querySelector('[name="terms"]').checked;
        var err = $('[data-auth-error]');
        if (!first) { err.textContent = t('auth.error.name'); return; }
        if (!validEmail(email)) { err.textContent = t('auth.error.email'); return; }
        if (password.length < 8) { err.textContent = t('auth.error.password'); return; }
        if (!terms) { err.textContent = t('auth.error.terms'); return; }
        var user = { name: first + (last ? ' ' + last : ''), email: email, createdAt: new Date().toISOString() };
        setUser(user);
        closeAuth();
        toast(t('auth.success.create', { name: first }));
      });
    }
  }

  /* ---------------- product modal ---------------- */
  function openProduct(id) {
    var p = getProduct(id);
    if (!p) return;
    state.selectedProduct = p;
    state.modalQty = 1;
    renderProductModal();
    var modal = $('#productModal');
    var backdrop = $('#productBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.add('is-open');
    backdrop.classList.add('is-open');
    refreshBodyLock();
    window.setTimeout(function () { var close = $('.product-modal-close'); if (close) close.focus(); }, 120);
  }
  function closeProduct() {
    var modal = $('#productModal');
    var backdrop = $('#productBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    refreshBodyLock();
  }
  function renderProductModal() {
    var container = $('#productModal');
    if (!container) return;
    var p = state.selectedProduct;
    if (!p) { container.innerHTML = ''; return; }
    var images = p.gallery && p.gallery.length ? p.gallery : [p.image];
    var off = discount(p);
    container.innerHTML = `
      <div class="product-modal-card">
        <button class="product-modal-close" type="button" data-product-close aria-label="${t('common.close')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <div class="modal-gallery ${p.tone}">
          <span class="modal-stock-badge chip chip-dark">${conditionLabel(p)}</span>
          <div class="modal-gallery-main"><img id="modalMainImage" src="${images[0]}" alt="${p.brand} ${productName(p)}"></div>
          ${images.length > 1 ? `<div class="modal-gallery-thumbs">${images.map(function (src, i) {
            return `<button type="button" class="modal-thumb ${i === 0 ? 'is-active' : ''}" data-modal-thumb="${src}" aria-label="${i + 1}"><img src="${src}" alt=""></button>`;
          }).join('')}</div>` : ''}
          <span class="product-save">${t('product.off', { n: off })}</span>
        </div>
        <div class="modal-details">
          <div class="modal-brand"><img src="${p.logo}" alt="">${p.brand} <span style="opacity:.45">/ ${p.sku}</span></div>
          <h2>${productName(p)}</h2>
          <div class="modal-rating">${starSvg()} ${p.rating.toFixed(1)} <span style="opacity:.5">·</span> ${t('product.reviews', { n: p.reviews.toLocaleString(state.lang === 'es' ? 'es-US' : 'en-US') })}</div>
          <div class="modal-price"><span class="now">${money(p.price)}</span><span class="was">${money(p.compare)}</span><span class="off">${t('product.off', { n: off })}</span></div>
          <p class="modal-desc">${productDesc(p)}</p>
          <ul class="modal-specs">${productSpecs(p).map(function (spec) { return `<li>${spec}</li>`; }).join('')}</ul>
          <div class="modal-condition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.2v.1"/></svg>
            <p><strong>${t('product.modal.condition')} · ${conditionLabel(p)}</strong><br>${t('product.condition.' + p.condition + '.long')}</p>
          </div>
          <div class="modal-buy-row">
            <div class="modal-qty">
              <button type="button" data-modal-minus aria-label="-">−</button>
              <span id="modalQty">${state.modalQty}</span>
              <button type="button" data-modal-plus aria-label="+">+</button>
            </div>
            <button type="button" class="btn btn-ink" data-modal-add>${t('product.modal.buy', { price: money(p.price * state.modalQty) })}</button>
          </div>
          <div class="modal-perks">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h13v10H3zM16 10h3l2 3v4h-5z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>${t('product.shipping')}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>${t('product.returns')}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>${t('product.warranty')}</span>
          </div>
        </div>
      </div>
    `;
  }
  function setModalQty(qty) {
    state.modalQty = Math.max(1, Math.min(9, qty));
    var span = $('#modalQty');
    if (span) span.textContent = state.modalQty;
    var btn = $('[data-modal-add]');
    if (btn && state.selectedProduct) btn.textContent = t('product.modal.buy', { price: money(state.selectedProduct.price * state.modalQty) });
  }

  /* ---------------- search ---------------- */
  function openSearch() {
    var overlay = $('#searchOverlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    refreshBodyLock();
    window.setTimeout(function () {
      var input = $('#searchInput');
      renderSearchResults(input ? input.value : '');
      if (input) input.focus();
    }, 160);
  }
  function closeSearch() {
    var overlay = $('#searchOverlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    refreshBodyLock();
  }
  function renderSearchResults(q) {
    state.searchQuery = q || '';
    var results = $('#searchResults');
    if (!results) return;
    var query = (q || '').trim().toLowerCase();
    var filtered = products.filter(function (p) {
      if (!query) return true;
      if (query === 'under 50' || query === 'under $50') return p.price < 50;
      var haystack = [p.name, p.nameEs, p.brand, p.category, p.condition, p.badge, p.badgeEs, productDesc(p)].join(' ').toLowerCase();
      var tokens = query.split(' ').filter(Boolean);
      return tokens.every(function (token) { return haystack.indexOf(token) !== -1; });
    }).slice(0, 8);
    var head = $('#searchResultsHead');
    if (head) head.textContent = query ? t('search.results', { q: q }) : t('search.popular');
    var empty = $('#searchEmpty');
    if (empty) empty.classList.toggle('is-on', filtered.length === 0);
    results.innerHTML = filtered.map(function (p) {
      return `<button type="button" class="search-result" data-product-id="${p.id}">
        <span class="search-result-img"><img src="${p.image}" alt="" loading="lazy"></span>
        <span class="search-result-info"><span class="mono">${p.brand}</span><strong>${productName(p)}</strong><span>${money(p.price)}</span></span>
      </button>`;
    }).join('');
  }

  /* ---------------- mobile nav ---------------- */
  function openMenu() {
    var nav = $('#mobileNav');
    if (!nav) return;
    nav.classList.add('is-open');
    nav.setAttribute('aria-hidden', 'false');
    refreshBodyLock();
  }
  function closeMenu() {
    var nav = $('#mobileNav');
    if (!nav) return;
    nav.classList.remove('is-open');
    nav.setAttribute('aria-hidden', 'true');
    refreshBodyLock();
  }

  /* ---------------- reveal + scroll ---------------- */
  var revealObserver = null;
  function observeReveals() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal, .reveal-scale').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    $$('.reveal:not(.is-in), .reveal-scale:not(.is-in)').forEach(function (el) { revealObserver.observe(el); });
  }
  function initScroll() {
    var progress = $('#scrollProgress');
    var header = $('.site-header');
    var heroFrame = $('[data-hero-frame]');
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var scrollY = window.scrollY || window.pageYOffset;
        var docH = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) progress.style.width = (docH > 0 ? (scrollY / docH) * 100 : 0) + '%';
        if (header) header.classList.toggle('is-scrolled', scrollY > 10);
        if (heroFrame && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
          var shift = Math.min(scrollY, 700) * 0.035;
          heroFrame.style.transform = 'rotate(1.6deg) translateY(' + shift + 'px)';
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- shared markup injection ---------------- */
  function injectSharedMarkup() {
    var wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="scroll-progress" id="scrollProgress"></div>
      <div class="drawer-backdrop" id="cartBackdrop" data-cart-close></div>
      <aside class="cart-drawer" id="cartDrawer" aria-hidden="true" aria-label="${t('cart.title')}">
        <div class="cart-head">
          <div>
            <h2>${t('cart.title')}</h2>
            <span class="cart-head-meta" data-bag-count-text></span>
          </div>
          <button class="icon-btn" type="button" data-cart-close aria-label="${t('common.close')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        <div class="cart-body" id="cartBody"></div>
        <div class="cart-foot" id="cartFoot"></div>
      </aside>

      <div class="modal-backdrop" id="productBackdrop" data-product-close></div>
      <div class="product-modal" id="productModal" role="dialog" aria-modal="true" aria-label="${t('common.quickview')}"></div>

      <div class="modal-backdrop" id="authBackdrop" data-auth-close></div>
      <div class="auth-modal" id="authModal" role="dialog" aria-modal="true" aria-label="${t('auth.join')}">
        <div class="auth-card">
          <div class="auth-art">
            <a class="brand" href="index.html"><span class="brand-word">corner</span><span class="brand-dot"></span></a>
            <blockquote data-i18n-html="auth.quote">The best things in life are <em>slightly used and 61% off.</em></blockquote>
            <div class="auth-art-foot" data-i18n="auth.quote.meta">A very reasonable philosophy.</div>
          </div>
          <div class="auth-form-wrap">
            <button class="auth-close" type="button" data-auth-close aria-label="${t('common.close')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
            <div class="auth-tabs">
              <button type="button" class="auth-tab is-active" data-auth-tab="signin" data-i18n="auth.signin">Sign in</button>
              <button type="button" class="auth-tab" data-auth-tab="create" data-i18n="auth.create">Create account</button>
            </div>
            <div class="auth-panel is-on" data-auth-panel="signin">
              <h2 data-i18n="auth.signin.title">Welcome back.</h2>
              <p class="auth-sub" data-i18n="auth.signin.sub">Sign in to see your orders, saved finds, and early access.</p>
              <form class="auth-form" id="signinForm" novalidate>
                <div class="field"><label data-i18n="auth.email">Email address</label><input type="email" name="email" autocomplete="email" data-i18n-placeholder="auth.email" placeholder="Email address"></div>
                <div class="field"><label data-i18n="auth.password">Password</label><input type="password" name="password" autocomplete="current-password" minlength="8" data-i18n-placeholder="auth.password" placeholder="Password"></div>
                <p class="auth-form-error" data-auth-error style="color:var(--orange);font-size:10px;min-height:14px"></p>
                <button class="btn btn-ink btn-full" type="submit" data-i18n="auth.signin.cta">Sign in</button>
              </form>
              <div class="auth-foot"><button type="button" data-forgot data-i18n="auth.forgot">Forgot password?</button> · <span data-i18n="auth.noaccount">New here?</span> <button type="button" data-auth-tab="create" data-i18n="auth.create">Create account</button></div>
            </div>
            <div class="auth-panel" data-auth-panel="create" hidden>
              <h2 data-i18n="auth.create.title">Get in the back room.</h2>
              <p class="auth-sub" data-i18n="auth.create.sub">Members see drops first, get restock alerts, and keep their finds in one place.</p>
              <form class="auth-form" id="createForm" novalidate>
                <div class="field-row">
                  <div class="field"><label data-i18n="auth.first">First name</label><input type="text" name="first" autocomplete="given-name"></div>
                  <div class="field"><label data-i18n="auth.last">Last name</label><input type="text" name="last" autocomplete="family-name"></div>
                </div>
                <div class="field"><label data-i18n="auth.email">Email address</label><input type="email" name="email" autocomplete="email"></div>
                <div class="field"><label data-i18n="auth.password">Password</label><input type="password" name="password" autocomplete="new-password" minlength="8" data-i18n-placeholder="auth.password.hint" placeholder="8+ characters"></div>
                <label class="checkbox-line"><input type="checkbox" name="terms"> <span data-i18n="auth.terms">I agree to the Terms and Privacy Policy.</span></label>
                <label class="checkbox-line"><input type="checkbox" name="newsletter" checked> <span data-i18n="auth.newsletter">Send me first dibs on new drops.</span></label>
                <p class="auth-form-error" data-auth-error style="color:var(--orange);font-size:10px;min-height:14px"></p>
                <button class="btn btn-ink btn-full" type="submit" data-i18n="auth.create.cta">Create my account</button>
              </form>
            </div>
            <p class="auth-demo" data-i18n="auth.demo">Demo account only. Credentials are stored in this browser and never sent anywhere.</p>
          </div>
        </div>
      </div>

      <div class="search-overlay" id="searchOverlay" role="dialog" aria-modal="true" aria-label="${t('search.title')}">
        <div class="search-overlay-top">
          <a class="brand" href="index.html"><span class="brand-word">corner</span><span class="brand-dot"></span></a>
          <button class="icon-btn" type="button" data-search-close aria-label="${t('search.close')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        <form class="search-form" onsubmit="return false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
          <input id="searchInput" type="search" autocomplete="off" placeholder="${t('search.placeholder')}" data-i18n-placeholder="search.placeholder">
        </form>
        <div class="search-hints">
          <button class="search-hint" type="button" data-search-hint="ring" data-i18n="search.hint.ring">Ring doorbell</button>
          <button class="search-hint" type="button" data-search-hint="tapo" data-i18n="search.hint.tapo">Tapo camera</button>
          <button class="search-hint" type="button" data-search-hint="under 50" data-i18n="search.hint.under50">Under $50</button>
          <button class="search-hint" type="button" data-search-hint="reolink" data-i18n="search.hint.reolink">Reolink</button>
        </div>
        <div class="search-results">
          <div class="search-results-head"><span id="searchResultsHead">${t('search.all')}</span><span>${t('common.demo')}</span></div>
          <div class="search-results-grid" id="searchResults"></div>
          <div class="search-empty" id="searchEmpty" data-i18n="search.none">No matches in this drop. Try a brand or a category.</div>
        </div>
      </div>

      <div class="mobile-nav" id="mobileNav" aria-hidden="true">
        <div class="mobile-nav-top">
          <a class="brand" href="index.html"><span class="brand-word">corner</span><span class="brand-dot"></span></a>
          <button class="icon-btn" type="button" data-menu-close aria-label="${t('nav.close')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        <nav class="mobile-nav-links">
          <a href="index.html" data-i18n="nav.home">Home <span>01</span></a>
          <a href="shop.html" data-i18n="nav.shop">Shop <span>02</span></a>
          <a href="shop.html?category=doorbells" data-i18n="nav.doorbells">Doorbells <span>03</span></a>
          <a href="shop.html?category=cameras" data-i18n="nav.cameras">Cameras <span>04</span></a>
          <a href="index.html#brands" data-i18n="nav.brands">Brands <span>05</span></a>
          <a href="index.html#how" data-i18n="nav.how">How it works <span>06</span></a>
          <a href="account.html" data-i18n="nav.account">Account <span>07</span></a>
        </nav>
        <div class="mobile-nav-bottom">
          <span class="mono" data-i18n="announce.ship">Free shipping over $49</span>
          <div class="lang-switch"><button type="button" data-lang="en">EN</button><button type="button" data-lang="es">ES</button></div>
        </div>
      </div>

      <div class="toast-stack" id="toastStack" aria-live="polite"></div>
    `;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  }

  /* ---------------- global events ---------------- */
  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var langBtn = e.target.closest('[data-lang]');
      if (langBtn) { setLang(langBtn.getAttribute('data-lang')); return; }
      if (e.target.closest('[data-cart-open]')) { e.preventDefault(); openCart(); return; }
      if (e.target.closest('[data-cart-close]')) { closeCart(); return; }
      if (e.target.closest('[data-search-open]')) { e.preventDefault(); openSearch(); return; }
      if (e.target.closest('[data-search-close]')) { closeSearch(); return; }
      if (e.target.closest('[data-menu-open]')) { openMenu(); return; }
      if (e.target.closest('[data-menu-close]')) { closeMenu(); return; }
      if (e.target.closest('[data-product-close]')) { closeProduct(); return; }
      if (e.target.closest('[data-search-hint]')) {
        var hint = e.target.closest('[data-search-hint]').getAttribute('data-search-hint');
        var input = $('#searchInput');
        if (input) { input.value = hint; renderSearchResults(hint); input.focus(); }
        return;
      }
      var thumb = e.target.closest('[data-modal-thumb]');
      if (thumb) {
        var src = thumb.getAttribute('data-modal-thumb');
        var main = $('#modalMainImage');
        if (main) main.src = src;
        $$('.modal-thumb').forEach(function (el) { el.classList.toggle('is-active', el === thumb); });
        return;
      }
      if (e.target.closest('[data-modal-minus]')) { setModalQty(state.modalQty - 1); return; }
      if (e.target.closest('[data-modal-plus]')) { setModalQty(state.modalQty + 1); return; }
      if (e.target.closest('[data-modal-add]')) {
        if (state.selectedProduct) {
          addToCart(state.selectedProduct.id, state.modalQty, { open: false });
          closeProduct();
          openCart();
        }
        return;
      }
      var cartPlus = e.target.closest('[data-cart-plus]');
      if (cartPlus) {
        var idPlus = cartPlus.getAttribute('data-cart-plus');
        var linePlus = state.cart.filter(function (l) { return l.id === idPlus; })[0];
        if (linePlus) updateQty(idPlus, linePlus.qty + 1);
        return;
      }
      var cartMinus = e.target.closest('[data-cart-minus]');
      if (cartMinus) {
        var idMinus = cartMinus.getAttribute('data-cart-minus');
        var lineMinus = state.cart.filter(function (l) { return l.id === idMinus; })[0];
        if (lineMinus) updateQty(idMinus, lineMinus.qty - 1);
        return;
      }
      var cartRemove = e.target.closest('[data-cart-remove]');
      if (cartRemove) { updateQty(cartRemove.getAttribute('data-cart-remove'), 0); return; }
      var addBtn = e.target.closest('[data-add-id]');
      if (addBtn) {
        e.preventDefault();
        addToCart(addBtn.getAttribute('data-add-id'), 1);
        return;
      }
      var productTrigger = e.target.closest('[data-product-id]');
      if (productTrigger) {
        e.preventDefault();
        if ($('#searchOverlay') && $('#searchOverlay').classList.contains('is-open')) closeSearch();
        openProduct(productTrigger.getAttribute('data-product-id'));
        return;
      }
    });

    var searchInput = $('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () { renderSearchResults(searchInput.value); });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); renderSearchResults(searchInput.value); }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('#productModal') && $('#productModal').classList.contains('is-open')) { closeProduct(); return; }
      if ($('#authModal') && $('#authModal').classList.contains('is-open')) { closeAuth(); return; }
      if ($('#searchOverlay') && $('#searchOverlay').classList.contains('is-open')) { closeSearch(); return; }
      if ($('#cartDrawer') && $('#cartDrawer').classList.contains('is-open')) { closeCart(); return; }
      if ($('#mobileNav') && $('#mobileNav').classList.contains('is-open')) { closeMenu(); }
    });

    var newsletter = $('#newsletterForm');
    if (newsletter) {
      newsletter.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = newsletter.querySelector('input[type="email"]');
        var success = $('#newsletterSuccess');
        if (!email || !validEmail(email.value.trim())) {
          email.focus();
          return;
        }
        if (success) success.classList.add('is-on');
        newsletter.reset();
        toast(state.lang === 'es' ? 'Estás en la lista.' : 'You are on the list.');
      });
    }
  }

  function handleInitialQuery() {
    var params = new URLSearchParams(window.location.search);
    var pid = params.get('product');
    if (pid && getProduct(pid)) {
      window.setTimeout(function () { openProduct(pid); }, 420);
    }
  }

  function init() {
    injectSharedMarkup();
    translatePage();
    updateCartBadge();
    renderCartDrawer();
    renderHome();
    bindGlobal();
    bindAuth();
    initScroll();
    observeReveals();
    handleInitialQuery();
    document.documentElement.classList.add('corner-ready');
  }

  window.Corner = {
    t: t,
    money: money,
    get lang() { return state.lang; },
    setLang: setLang,
    products: products,
    brands: brands,
    getProduct: getProduct,
    productName: productName,
    productDesc: productDesc,
    productSpecs: productSpecs,
    conditionLabel: conditionLabel,
    discount: discount,
    renderProductCard: renderProductCard,
    addToCart: addToCart,
    clearCart: clearCart,
    getCart: function () { return state.cart.slice(); },
    cartTotals: cartTotals,
    openCart: openCart,
    closeCart: closeCart,
    openAuth: openAuth,
    openProduct: openProduct,
    getUser: getUser,
    setUser: setUser,
    toast: toast,
    observeReveals: observeReveals,
    translatePage: translatePage,
    refreshBodyLock: refreshBodyLock
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
