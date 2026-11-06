/* ============================================================
   CORNER — demo checkout
   ============================================================ */
(function () {
  'use strict';

  function ready() {
    if (!window.Corner) return;
    var C = window.Corner;
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var state = {
      step: 1,
      shipping: 'standard',
      payment: 'card',
      promo: false,
      promoAmount: 0,
      order: null
    };
    var address = {};
    var lastTotals = null;

    var mainView = $('#checkoutMainView');
    var layout = $('#checkoutLayout');
    var empty = $('#checkoutEmpty');
    var success = $('#successView');
    var processing = $('#processingOverlay');

    function t(key, vars) { return C.t(key, vars); }
    function money(n) { return C.money(n); }
    function lines() {
      return C.getCart().map(function (line) {
        var product = C.getProduct(line.id);
        return product ? { product: product, qty: line.qty } : null;
      }).filter(Boolean);
    }

    if (!lines().length) {
      if (empty) empty.classList.add('is-on');
      if (layout) layout.style.display = 'none';
      var stepsEl = $('.checkout-steps');
      if (stepsEl) stepsEl.style.display = 'none';
      return;
    }

    var states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

    function populateStates() {
      var select = $('#stateSelect');
      if (!select) return;
      var current = select.value;
      select.innerHTML = '<option value="">' + t('checkout.state') + '</option>' + states.map(function (code) {
        return '<option value="' + code + '">' + t('state.' + code.toLowerCase()) + '</option>';
      }).join('');
      if (current) select.value = current;
    }

    function validEmail(value) {
      return value.indexOf('@') > 0 && value.indexOf('.') > value.indexOf('@') + 1;
    }

    function shippingCost() {
      var subtotal = lines().reduce(function (sum, line) { return sum + line.product.price * line.qty; }, 0);
      if (state.shipping === 'express') return 12;
      if (state.shipping === 'overnight') return 24;
      return subtotal >= 49 ? 0 : 6.95;
    }
    function shippingLabel() {
      if (state.shipping === 'express') return t('checkout.delivery.express');
      if (state.shipping === 'overnight') return t('checkout.delivery.overnight');
      return t('checkout.delivery.standard');
    }
    function shippingTime() {
      if (state.shipping === 'express') return t('checkout.delivery.express.time');
      if (state.shipping === 'overnight') return t('checkout.delivery.overnight.time');
      return t('checkout.delivery.standard.time');
    }
    function paymentLabel() {
      var map = {
        card: 'checkout.card', applepay: 'checkout.applepay', paypal: 'checkout.paypal', shop: 'checkout.shop',
        klarna: 'checkout.klarna', afterpay: 'checkout.afterpay', affirm: 'checkout.affirm',
        applegift: 'checkout.applegift', cornergift: 'checkout.cornergift', bank: 'checkout.bank'
      };
      return t(map[state.payment] || 'checkout.card');
    }

    function totals() {
      var subtotal = 0;
      var savings = 0;
      lines().forEach(function (line) {
        subtotal += line.product.price * line.qty;
        savings += Math.max(0, line.product.compare - line.product.price) * line.qty;
      });
      var promo = state.promo ? subtotal * 0.1 : 0;
      var shipping = shippingCost();
      var tax = (subtotal - promo) * 0.0825;
      return {
        subtotal: subtotal,
        savings: savings,
        promo: promo,
        shipping: shipping,
        tax: tax,
        total: subtotal - promo + shipping + tax
      };
    }

    function renderSummary() {
      var itemsWrap = $('#summaryItems');
      var count = $('[data-summary-count]');
      var list = lines();
      if (itemsWrap) {
        itemsWrap.innerHTML = list.map(function (line) {
          var p = line.product;
          return `<div class="summary-item">
            <div class="summary-item-img"><img src="${p.image}" alt="${C.productName(p)}"><span class="qty-badge">${line.qty}</span></div>
            <div class="summary-item-info"><span class="mono">${p.brand}</span><strong>${C.productName(p)}</strong><span class="summary-price">${money(p.price)}</span></div>
            <span class="summary-item-total">${money(p.price * line.qty)}</span>
          </div>`;
        }).join('');
      }
      var data = totals();
      lastTotals = data;
      if (count) count.textContent = t('checkout.summary.items', { n: list.reduce(function (sum, line) { return sum + line.qty; }, 0) });
      var set = function (sel, value) { var el = $(sel); if (el) el.textContent = value; };
      set('#summarySubtotal', money(data.subtotal));
      set('#summaryShipping', data.shipping === 0 ? t('checkout.delivery.free') : money(data.shipping));
      set('#summaryTax', money(data.tax));
      set('#summaryTotal', money(data.total));
      set('#summarySavings', money(data.savings));
      var shippingEl = $('#summaryShipping');
      if (shippingEl) shippingEl.classList.toggle('free', data.shipping === 0);
      var place = $('#placeOrder');
      if (place) {
        var label = place.querySelector('[data-i18n="checkout.place"]');
        if (label) label.textContent = t('checkout.place') + ' · ' + money(data.total);
      }
      var std = $('#standardPrice');
      if (std) {
        std.textContent = data.subtotal >= 49 ? t('checkout.delivery.free') : money(6.95);
        std.classList.toggle('free', data.subtotal >= 49);
      }
    }

    function refreshBnplCopy() {
      var providers = { klarna: 'Klarna', afterpay: 'Afterpay', affirm: 'Affirm' };
      Object.keys(providers).forEach(function (key) {
        var panel = $('[data-pay-panel="' + key + '"] .giftcard-copy');
        if (panel) panel.textContent = t('checkout.payment.demo.bnpl', { provider: providers[key] });
      });
    }

    function setStep(step) {
      state.step = step;
      $$('.checkout-panel').forEach(function (panel) {
        var n = Number(panel.getAttribute('data-step'));
        panel.classList.toggle('is-open', n === step);
        panel.classList.toggle('is-done', n < step);
      });
      $$('[data-step-indicator]').forEach(function (indicator) {
        var n = Number(indicator.getAttribute('data-step-indicator'));
        indicator.classList.toggle('is-active', n === step);
        indicator.classList.toggle('is-done', n < step);
      });
      renderMiniSummaries();
      var panel = $('.checkout-panel[data-step="' + step + '"]');
      if (panel) {
        var top = panel.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    }

    function renderMiniSummaries() {
      var a = $('[data-summary-mini="1"]');
      if (a) a.innerHTML = '<strong>' + (address.first || '') + ' ' + (address.last || '') + '</strong> · ' + (address.address || '') + ', ' + (address.city || '') + ', ' + (address.state || '') + ' ' + (address.zip || '') + '<br>' + (address.email || '');
      var b = $('[data-summary-mini="2"]');
      if (b) b.innerHTML = '<strong>' + shippingLabel() + '</strong> · ' + shippingTime() + ' · ' + (shippingCost() === 0 ? t('checkout.delivery.free') : money(shippingCost()));
      var c = $('[data-summary-mini="3"]');
      if (c) c.innerHTML = '<strong>' + paymentLabel() + '</strong>';
    }

    function clearErrors(form) {
      if (!form) return;
      $$('.field', form).forEach(function (field) { field.classList.remove('is-error'); });
    }
    function markError(input) {
      if (!input) return;
      var field = input.closest('.field');
      if (field) field.classList.add('is-error');
    }
    function validateContact() {
      var form = $('#contactForm');
      if (!form) return false;
      clearErrors(form);
      var required = ['checkoutEmail','checkoutFirst','checkoutLast','checkoutAddress','checkoutCity','stateSelect','checkoutZip'];
      var ok = true;
      required.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el || !el.value.trim()) { markError(el); ok = false; }
      });
      var email = document.getElementById('checkoutEmail');
      if (email && !validEmail(email.value.trim())) { markError(email); ok = false; }
      var zip = document.getElementById('checkoutZip');
      if (zip && zip.value.trim().length < 5) { markError(zip); ok = false; }
      if (!ok) {
        C.toast(t('checkout.error.required'));
        var firstError = $('.field.is-error input, .field.is-error select');
        if (firstError) firstError.focus();
        return false;
      }
      address = {
        email: document.getElementById('checkoutEmail').value.trim(),
        phone: document.getElementById('checkoutPhone').value.trim(),
        first: document.getElementById('checkoutFirst').value.trim(),
        last: document.getElementById('checkoutLast').value.trim(),
        address: document.getElementById('checkoutAddress').value.trim(),
        address2: document.getElementById('checkoutAddress2').value.trim(),
        city: document.getElementById('checkoutCity').value.trim(),
        state: document.getElementById('stateSelect').value,
        zip: document.getElementById('checkoutZip').value.trim()
      };
      try { localStorage.setItem('corner_address', JSON.stringify(address)); } catch (e) {}
      return true;
    }

    /* prefill */
    populateStates();
    var savedAddress = null;
    try { savedAddress = JSON.parse(localStorage.getItem('corner_address') || 'null'); } catch (e) {}
    var user = C.getUser();
    if (user) {
      var parts = (user.name || '').split(' ');
      $('#checkoutEmail').value = user.email || '';
      $('#checkoutFirst').value = parts[0] || '';
      $('#checkoutLast').value = parts.slice(1).join(' ') || '';
    }
    if (savedAddress) {
      Object.keys(savedAddress).forEach(function (key) {
        var map = { email: 'checkoutEmail', phone: 'checkoutPhone', first: 'checkoutFirst', last: 'checkoutLast', address: 'checkoutAddress', address2: 'checkoutAddress2', city: 'checkoutCity', state: 'stateSelect', zip: 'checkoutZip' };
        var el = document.getElementById(map[key]);
        if (el && savedAddress[key]) el.value = savedAddress[key];
      });
      address = savedAddress;
    }

    $('#contactForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateContact()) return;
      setStep(2);
    });
    $$('[data-next-step="1"]').forEach(function (btn) { btn.addEventListener('click', function (e) { e.preventDefault(); if (validateContact()) setStep(2); }); });
    $$('[data-next-step="2"]').forEach(function (btn) { btn.addEventListener('click', function () { setStep(3); }); });
    $$('[data-back-step]').forEach(function (btn) {
      btn.addEventListener('click', function () { setStep(Number(btn.getAttribute('data-back-step')) - 1); });
    });
    $$('[data-edit-step]').forEach(function (btn) {
      btn.addEventListener('click', function () { setStep(Number(btn.getAttribute('data-edit-step'))); });
    });

    $$('[data-shipping-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        state.shipping = option.getAttribute('data-shipping-option');
        $$('[data-shipping-option]').forEach(function (el) { el.classList.toggle('is-selected', el === option); });
        renderSummary();
        renderMiniSummaries();
      });
    });

    function selectPayment(method) {
      state.payment = method;
      $$('[data-pay-method]').forEach(function (el) {
        el.classList.toggle('is-selected', el.getAttribute('data-pay-method') === method);
        var input = el.querySelector('input');
        if (input) input.checked = el.getAttribute('data-pay-method') === method;
      });
      $$('[data-pay-panel]').forEach(function (panel) {
        panel.classList.toggle('is-on', panel.getAttribute('data-pay-panel') === method);
      });
      renderMiniSummaries();
    }

    document.addEventListener('click', function (e) {
      var pay = e.target.closest('[data-pay-method]');
      if (pay) selectPayment(pay.getAttribute('data-pay-method'));
      var express = e.target.closest('[data-express]');
      if (express) {
        var method = express.getAttribute('data-express');
        selectPayment(method);
        C.toast(t('checkout.demo'));
      }
    });

    /* input formatting */
    var cardNumber = $('#cardNumber');
    if (cardNumber) {
      cardNumber.addEventListener('input', function () {
        var digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
        cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
      });
    }
    var cardExp = $('#cardExp');
    if (cardExp) {
      cardExp.addEventListener('input', function () {
        var digits = cardExp.value.replace(/\D/g, '').slice(0, 4);
        cardExp.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
      });
    }
    var cvc = $('#cardCvc');
    if (cvc) cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });

    var promoForm = $('#promoForm');
    if (promoForm) {
      promoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('#promoInput');
        var msg = $('#promoMessage');
        if (!input || !input.value.trim()) { input.focus(); return; }
        state.promo = true;
        if (msg) { msg.style.display = 'block'; msg.textContent = t('checkout.promo.success'); }
        renderSummary();
      });
    }

    function validatePayment() {
      $$('.pay-form .field').forEach(function (field) { field.classList.remove('is-error'); });
      if (state.payment === 'card') {
        var digits = ($('#cardNumber').value || '').replace(/\D/g, '');
        if (digits.length < 15) { markError($('#cardNumber')); C.toast(t('checkout.error.card')); return false; }
        var exp = ($('#cardExp').value || '').split('/');
        if (exp.length !== 2 || Number(exp[0]) < 1 || Number(exp[0]) > 12) { markError($('#cardExp')); C.toast(t('checkout.error.exp')); return false; }
        var now = new Date();
        var expYear = 2000 + Number(exp[1]);
        if (expYear < now.getFullYear() || (expYear === now.getFullYear() && Number(exp[0]) < now.getMonth() + 1)) { markError($('#cardExp')); C.toast(t('checkout.error.exp')); return false; }
        var cv = ($('#cardCvc').value || '').replace(/\D/g, '');
        if (cv.length < 3) { markError($('#cardCvc')); C.toast(t('checkout.error.cvc')); return false; }
      }
      if (state.payment === 'applegift' && !($('#appleGiftCode').value || '').trim()) { markError($('#appleGiftCode')); C.toast(t('checkout.error.gift')); return false; }
      if (state.payment === 'cornergift' && !($('#cornerGiftCode').value || '').trim()) { markError($('#cornerGiftCode')); C.toast(t('checkout.error.gift')); return false; }
      if (state.payment === 'bank') {
        if (($('#bankRouting').value || '').replace(/\D/g, '').length < 9) { markError($('#bankRouting')); C.toast(t('checkout.error.bank')); return false; }
        if (($('#bankAccount').value || '').replace(/\D/g, '').length < 4) { markError($('#bankAccount')); C.toast(t('checkout.error.bank')); return false; }
      }
      return true;
    }

    function formatDate(days) {
      var date = new Date();
      date.setDate(date.getDate() + days);
      try {
        return new Intl.DateTimeFormat(C.lang === 'es' ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
      } catch (e) {
        return date.toDateString();
      }
    }

    function showSuccess() {
      var list = lines();
      var data = totals();
      state.order = {
        id: 'CRN-' + String(Math.floor(100000 + Math.random() * 900000)),
        email: address.email || (($('#checkoutEmail') || {}).value || ''),
        payment: paymentLabel(),
        items: list,
        totals: data,
        shipping: state.shipping
      };
      var email = state.order.email;
      var body = $('.success-top p');
      if (body) body.textContent = t('checkout.success.body', { email: email });
      $('#successOrder').textContent = state.order.id;
      $('#successEstimate').textContent = formatDate(state.shipping === 'overnight' ? 1 : state.shipping === 'express' ? 2 : 5);
      $('#successPayment').textContent = state.order.payment;
      $('#successItems').innerHTML = list.map(function (line) {
        return `<div class="success-item"><img src="${line.product.image}" alt=""><strong>${C.productName(line.product)} × ${line.qty}</strong><span>${money(line.product.price * line.qty)}</span></div>`;
      }).join('');
      try {
        var storageKey = 'corner_orders';
        var existing = [];
        try { existing = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (err) {}
        existing.unshift({
          id: state.order.id,
          date: new Date().toISOString(),
          total: data.total,
          savings: data.savings,
          email: email,
          items: list.map(function (line) { return { name: C.productName(line.product), qty: line.qty, price: line.product.price }; })
        });
        localStorage.setItem(storageKey, JSON.stringify(existing.slice(0, 10)));
      } catch (err) {}
      C.clearCart();
      if (mainView) mainView.style.display = 'none';
      if (success) success.classList.add('is-on');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      C.toast(t('checkout.success.note'));
    }

    var place = $('#placeOrder');
    if (place) {
      place.addEventListener('click', function () {
        if (!validateContact()) { setStep(1); return; }
        if (!validatePayment()) return;
        if (processing) processing.classList.add('is-on');
        window.setTimeout(function () {
          if (processing) processing.classList.remove('is-on');
          showSuccess();
        }, 1700);
      });
    }

    document.addEventListener('corner:lang', function () {
      populateStates();
      refreshBnplCopy();
      renderSummary();
      renderMiniSummaries();
      if (state.order) {
        var body = $('.success-top p');
        if (body) body.textContent = t('checkout.success.body', { email: state.order.email });
        $('#successEstimate').textContent = formatDate(state.shipping === 'overnight' ? 1 : state.shipping === 'express' ? 2 : 5);
        $('#successPayment').textContent = paymentLabel();
        var label = place && place.querySelector('[data-i18n="checkout.place"]');
        if (label) label.textContent = t('checkout.place');
      }
    });

    renderSummary();
    renderMiniSummaries();
    refreshBnplCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
