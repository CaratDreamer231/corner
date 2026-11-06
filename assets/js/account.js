/* ============================================================
   CORNER — account page
   ============================================================ */
(function () {
  'use strict';

  function ready() {
    if (!window.Corner) return;
    var C = window.Corner;
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var auth = $('#accountAuth');
    var dashboard = $('#accountDashboard');
    var authTabs = $$('[data-account-tab]');

    function t(key, vars) { return C.t(key, vars); }
    function validEmail(value) {
      return value.indexOf('@') > 0 && value.indexOf('.') > value.indexOf('@') + 1;
    }
    function showPanel(mode) {
      $$('[data-account-panel]').forEach(function (panel) {
        var on = panel.getAttribute('data-account-panel') === mode;
        panel.classList.toggle('is-on', on);
        panel.hidden = !on;
      });
      authTabs.forEach(function (tab) {
        if (tab.classList.contains('is-active') || tab.parentElement && tab.parentElement.classList.contains('account-auth-tabs')) {
          tab.classList.toggle('is-active', tab.getAttribute('data-account-tab') === mode);
        }
      });
      var err = $('[data-account-error]');
      if (err) err.textContent = '';
    }

    function formatMember(iso) {
      if (!iso) return '';
      try {
        var d = new Date(iso);
        var date = new Intl.DateTimeFormat(C.lang === 'es' ? 'es-US' : 'en-US', { month: 'long', year: 'numeric' }).format(d);
        return t('account.member', { date: date });
      } catch (e) { return ''; }
    }

    function readOrders() {
      try {
        var list = JSON.parse(localStorage.getItem('corner_orders') || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    }

    function readSaved() {
      try {
        var list = JSON.parse(localStorage.getItem('corner_saved') || '[]');
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    }

    function renderOrders(user) {
      var target = $('[data-account-orders]');
      var count = $('[data-account-orders-count]');
      var savings = $('[data-account-savings]');
      var orders = readOrders();
      if (count) count.textContent = String(orders.length);
      if (savings) {
        var total = orders.reduce(function (sum, order) { return sum + (Number(order.savings) || 0); }, 0);
        savings.textContent = C.money(total);
      }
      if (!target) return;
      if (!orders.length) {
        target.innerHTML = `<div class="empty-panel"><p>${t('account.noorders')}</p><a class="btn btn-outline btn-sm" href="shop.html">${t('account.shop')}</a></div>`;
        return;
      }
      target.innerHTML = orders.map(function (order) {
        var date = '';
        try {
          date = new Intl.DateTimeFormat(C.lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(order.date));
        } catch (e) { date = ''; }
        return `<div class="account-order">
          <div><span class="mono">${date}</span><strong>${t('account.order', { id: order.id })}</strong></div>
          <span class="order-status">${t('account.status')}</span>
        </div>`;
      }).join('');
    }

    function renderSaved() {
      var target = $('[data-account-saved]');
      var count = $('[data-account-saved-count]');
      var saved = readSaved();
      if (count) count.textContent = String(saved.length);
      if (!target) return;
      if (!saved.length) {
        target.innerHTML = `<div class="empty-panel"><p>${t('account.nosaved')}</p><a class="btn btn-outline btn-sm" href="shop.html">${t('account.shop')}</a></div>`;
        return;
      }
      target.innerHTML = saved.map(function (id) {
        var p = C.getProduct(id);
        if (!p) return '';
        return `<a class="account-order" href="shop.html?product=${p.id}"><div><span class="mono">${p.brand}</span><strong>${C.productName(p)}</strong></div><span class="order-status">${C.money(p.price)}</span></a>`;
      }).join('');
    }

    function render() {
      var user = C.getUser();
      if (!user) {
        if (auth) auth.style.display = 'block';
        if (dashboard) dashboard.classList.remove('is-on');
        document.body.classList.add('account-signed-out');
        return;
      }
      document.body.classList.remove('account-signed-out');
      if (auth) auth.style.display = 'none';
      if (dashboard) dashboard.classList.add('is-on');
      var first = (user.name || '').split(' ')[0] || user.email.split('@')[0];
      var els = {
        '[data-account-first]': first,
        '[data-account-email]': user.email,
        '[data-account-initial]': (first.charAt(0) || 'c').toUpperCase(),
        '[data-account-greeting]': C.lang === 'es' ? 'Hola' : 'Hi',
        '[data-account-member]': formatMember(user.createdAt)
      };
      Object.keys(els).forEach(function (sel) {
        var el = $(sel);
        if (el) el.textContent = els[sel];
      });
      renderOrders(user);
      renderSaved();
    }

    authTabs.forEach(function (tab) {
      if (!tab.parentElement.classList.contains('account-auth-tabs')) return;
      tab.addEventListener('click', function () { showPanel(tab.getAttribute('data-account-tab')); });
    });
    $$('[data-account-tab="create"]').forEach(function (btn) {
      if (btn.parentElement && btn.parentElement.classList.contains('account-auth-alt')) {
        btn.addEventListener('click', function () { showPanel('create'); });
      }
    });

    var signin = $('#accountSigninForm');
    if (signin) {
      signin.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = signin.querySelector('[name="email"]').value.trim();
        var password = signin.querySelector('[name="password"]').value;
        var err = $('[data-account-panel="signin"] [data-account-error]');
        if (!validEmail(email)) { if (err) err.textContent = t('auth.error.email'); return; }
        if (password.length < 8) { if (err) err.textContent = t('auth.error.password'); return; }
        var existing = C.getUser();
        var name = existing && existing.email === email ? existing.name : email.split('@')[0].replace(/[._-]/g, ' ');
        C.setUser({ name: name, email: email, createdAt: existing && existing.email === email ? existing.createdAt : new Date().toISOString() });
        C.toast(t('auth.success.signin', { name: name }));
        render();
      });
    }

    var create = $('#accountCreateForm');
    if (create) {
      create.addEventListener('submit', function (e) {
        e.preventDefault();
        var first = create.querySelector('[name="first"]').value.trim();
        var last = create.querySelector('[name="last"]').value.trim();
        var email = create.querySelector('[name="email"]').value.trim();
        var password = create.querySelector('[name="password"]').value;
        var terms = create.querySelector('[name="terms"]').checked;
        var err = $('[data-account-panel="create"] [data-account-error]');
        if (!first) { if (err) err.textContent = t('auth.error.name'); return; }
        if (!validEmail(email)) { if (err) err.textContent = t('auth.error.email'); return; }
        if (password.length < 8) { if (err) err.textContent = t('auth.error.password'); return; }
        if (!terms) { if (err) err.textContent = t('auth.error.terms'); return; }
        C.setUser({ name: first + (last ? ' ' + last : ''), email: email, createdAt: new Date().toISOString() });
        C.toast(t('auth.success.create', { name: first }));
        render();
      });
    }

    $$('[data-account-signout]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        C.setUser(null);
        C.toast(t('auth.success.logout'));
        showPanel('signin');
        render();
      });
    });

    document.addEventListener('corner:lang', render);
    document.addEventListener('corner:auth', render);

    render();
    if (C.getUser()) showPanel('signin');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
