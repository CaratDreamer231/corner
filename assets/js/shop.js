/* ============================================================
   CORNER — shop filters
   ============================================================ */
(function () {
  'use strict';

  function ready() {
    if (!window.Corner) return;
    var C = window.Corner;
    var products = C.products;
    var state = {
      category: 'all',
      brand: '',
      condition: '',
      price: '',
      sort: 'featured'
    };

    var grid = document.getElementById('shopGrid');
    var empty = document.getElementById('shopEmpty');
    var count = document.querySelector('[data-shop-count]');
    var activeWrap = document.querySelector('[data-active-filters]');
    var brandWrap = document.getElementById('brandFilters');
    var filterPanel = document.getElementById('shopFilters');
    var filterCount = document.querySelector('[data-filter-count]');
    var sortSelect = document.getElementById('sortSelect');

    if (!grid) return;

    function t(key, vars) { return C.t(key, vars); }
    function money(n) { return C.money(n); }

    function uniqueBrands() {
      var seen = {};
      return products.map(function (p) { return p.brand; }).filter(function (brand) {
        if (seen[brand]) return false;
        seen[brand] = true;
        return true;
      });
    }

    function categoryLabel(value) {
      if (value === 'doorbells') return t('nav.doorbells');
      if (value === 'cameras') return t('nav.cameras');
      return t('shop.all');
    }
    function priceLabel(value) {
      if (value === '50') return t('shop.under50');
      if (value === '100') return t('shop.under100');
      if (value === '100plus') return t('shop.over100');
      return '';
    }
    function conditionLabel(value) {
      return t('product.condition.' + value);
    }

    function renderBrandFilters() {
      if (!brandWrap) return;
      brandWrap.innerHTML = uniqueBrands().map(function (brand) {
        var active = state.brand === brand ? ' is-active' : '';
        return `<button class="filter-option${active}" type="button" data-filter-brand="${brand}">${brand}</button>`;
      }).join('');
    }

    function matches(product) {
      if (state.category !== 'all' && product.category !== state.category) return false;
      if (state.brand && product.brand !== state.brand) return false;
      if (state.condition && product.condition !== state.condition) return false;
      if (state.price === '50' && product.price >= 50) return false;
      if (state.price === '100' && product.price >= 100) return false;
      if (state.price === '100plus' && product.price < 100) return false;
      return true;
    }

    function sortProducts(list) {
      var copy = list.slice();
      if (state.sort === 'low') return copy.sort(function (a, b) { return a.price - b.price; });
      if (state.sort === 'high') return copy.sort(function (a, b) { return b.price - a.price; });
      if (state.sort === 'discount') return copy.sort(function (a, b) { return C.discount(b) - C.discount(a); });
      if (state.sort === 'new') return copy.sort(function (a, b) { return Number(b.isNew) - Number(a.isNew); });
      return copy.sort(function (a, b) { return Number(b.featured) - Number(a.featured); });
    }

    function syncControls() {
      document.querySelectorAll('[data-filter-cat]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter-cat') === state.category);
      });
      document.querySelectorAll('[data-filter-price]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter-price') === state.price);
      });
      document.querySelectorAll('[data-filter-brand]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter-brand') === state.brand);
      });
      document.querySelectorAll('[data-filter-condition]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-filter-condition') === state.condition);
      });
      if (sortSelect) sortSelect.value = state.sort;
      var activeCount = 0;
      if (state.category !== 'all') activeCount++;
      if (state.brand) activeCount++;
      if (state.condition) activeCount++;
      if (state.price) activeCount++;
      if (filterCount) filterCount.textContent = activeCount ? String(activeCount) : '';
    }

    function renderActive() {
      if (!activeWrap) return;
      var tags = [];
      if (state.category !== 'all') tags.push({ type: 'category', value: state.category, label: categoryLabel(state.category) });
      if (state.brand) tags.push({ type: 'brand', value: state.brand, label: state.brand });
      if (state.condition) tags.push({ type: 'condition', value: state.condition, label: conditionLabel(state.condition) });
      if (state.price) tags.push({ type: 'price', value: state.price, label: priceLabel(state.price) });
      activeWrap.innerHTML = tags.map(function (tag) {
        return `<span class="filter-tag">${tag.label}<button type="button" data-clear-filter="${tag.type}" aria-label="${t('common.remove')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>`;
      }).join('');
    }

    function updateUrl() {
      var params = new URLSearchParams();
      if (state.category !== 'all') params.set('category', state.category);
      if (state.brand) params.set('brand', state.brand);
      if (state.condition) params.set('condition', state.condition);
      if (state.price) params.set('price', state.price);
      if (state.sort !== 'featured') params.set('sort', state.sort);
      var query = params.toString();
      try {
        history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
      } catch (e) {}
    }

    function render() {
      var filtered = sortProducts(products.filter(matches));
      grid.innerHTML = filtered.map(function (p, i) { return C.renderProductCard(p, i); }).join('');
      if (empty) empty.classList.toggle('is-on', filtered.length === 0);
      if (count) count.textContent = t('shop.showing', { shown: filtered.length, total: products.length });
      renderActive();
      syncControls();
      updateUrl();
      C.observeReveals();
    }

    function setCategory(value) {
      state.category = value || 'all';
      render();
    }
    function toggleBrand(value) {
      state.brand = state.brand === value ? '' : value;
      render();
    }
    function toggleCondition(value) {
      state.condition = state.condition === value ? '' : value;
      render();
    }
    function togglePrice(value) {
      state.price = state.price === value ? '' : value;
      render();
    }

    document.addEventListener('click', function (e) {
      var cat = e.target.closest('[data-filter-cat]');
      if (cat) { setCategory(cat.getAttribute('data-filter-cat')); return; }
      var brand = e.target.closest('[data-filter-brand]');
      if (brand) { toggleBrand(brand.getAttribute('data-filter-brand')); return; }
      var condition = e.target.closest('[data-filter-condition]');
      if (condition) { toggleCondition(condition.getAttribute('data-filter-condition')); return; }
      var price = e.target.closest('[data-filter-price]');
      if (price) { togglePrice(price.getAttribute('data-filter-price')); return; }
      var clear = e.target.closest('[data-clear-filter]');
      if (clear) {
        var type = clear.getAttribute('data-clear-filter');
        if (type === 'category') state.category = 'all';
        if (type === 'brand') state.brand = '';
        if (type === 'condition') state.condition = '';
        if (type === 'price') state.price = '';
        render();
        return;
      }
      if (e.target.closest('[data-filter-clear]')) {
        state.category = 'all';
        state.brand = '';
        state.condition = '';
        state.price = '';
        state.sort = 'featured';
        render();
        return;
      }
      if (e.target.closest('[data-filter-toggle]')) {
        if (filterPanel) filterPanel.classList.toggle('is-on');
        return;
      }
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sort = sortSelect.value;
        render();
      });
    }

    document.addEventListener('corner:lang', function () {
      renderBrandFilters();
      render();
    });

    var params = new URLSearchParams(window.location.search);
    if (params.get('category')) state.category = params.get('category');
    if (params.get('brand')) state.brand = params.get('brand');
    if (params.get('condition')) state.condition = params.get('condition');
    if (params.get('price')) state.price = params.get('price');
    if (params.get('sort')) state.sort = params.get('sort');

    renderBrandFilters();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
