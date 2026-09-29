/*
 * DIFL privacy-first Google measurement and consent controls.
 *
 * This file deliberately contains no form values, phone numbers, email
 * addresses or other user-provided data in analytics events. Google Ads
 * conversion labels are not configured here because no verified label has
 * been supplied. The GA4 `generate_lead` event can be imported into Google
 * Ads after it has been verified in the linked accounts.
 */
(function () {
  'use strict';

  if (window.__DIFL_CONSENT_V1__) return;
  window.__DIFL_CONSENT_V1__ = true;

  var STORAGE_KEY = 'difl_consent_v1';
  var CONSENT_VERSION = 1;
  var CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  var GA4_ID = 'G-WZ5KK1PD8R';
  var GOOGLE_ADS_ID = 'AW-1017549319';
  var MEASUREMENT_SEND_TO = GA4_ID;
  var landingUrl = safeUrl(window.location.href);
  var currentChoice = 'unset';
  var googleTagStarted = false;
  var lastPageKey = '';
  var pageViewTimer = 0;
  var previouslyFocused = null;
  var trackedForms = typeof WeakSet === 'function' ? new WeakSet() : null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  /* Consent defaults are queued before any Google tag is requested. */
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', true);

  ensureStylesheet();

  var storedChoice = readStoredChoice();
  if (storedChoice === 'accepted') {
    applyConsent('accepted', false);
    startGoogleTag();
  } else if (storedChoice === 'rejected') {
    applyConsent('rejected', false);
  }

  function safeUrl(value) {
    try {
      return new URL(value, window.location.origin);
    } catch (_error) {
      return null;
    }
  }

  function readStoredChoice() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return 'unset';
      var record = JSON.parse(raw);
      var isCurrent = record && record.version === CONSENT_VERSION;
      var updatedAt = Date.parse(record && record.updatedAt);
      var isFresh = Number.isFinite(updatedAt) && Date.now() - updatedAt < CONSENT_MAX_AGE_MS;
      var isValid = record.choice === 'accepted' || record.choice === 'rejected';
      if (isCurrent && isFresh && isValid) return record.choice;
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      /* Storage can be unavailable in private or hardened browser modes. */
    }
    return 'unset';
  }

  function storeChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        choice: choice,
        version: CONSENT_VERSION,
        updatedAt: new Date().toISOString()
      }));
    } catch (_error) {
      /* The consent command still applies for the current page session. */
    }
  }

  function consentUpdateFor(choice) {
    if (choice === 'accepted') {
      return {
        ad_storage: 'granted',
        analytics_storage: 'granted',
        ad_user_data: 'granted',
        /* This control permits measurement, not personalised advertising. */
        ad_personalization: 'denied'
      };
    }
    return {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    };
  }

  function applyConsent(choice, persist) {
    currentChoice = choice;
    window.gtag('consent', 'update', consentUpdateFor(choice));
    if (persist) storeChoice(choice);
    document.documentElement.setAttribute('data-difl-consent', choice);
    try {
      document.dispatchEvent(new CustomEvent('difl:consentchange', {
        detail: { choice: choice }
      }));
    } catch (_error) {
      /* CustomEvent support is not required for the consent itself. */
    }
  }

  function startGoogleTag() {
    if (googleTagStarted || currentChoice !== 'accepted') return;
    googleTagStarted = true;

    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, {
      send_page_view: false,
      allow_enhanced_conversions: false
    });
    window.gtag('config', GOOGLE_ADS_ID, {
      send_page_view: false,
      allow_enhanced_conversions: false
    });

    if (!document.getElementById('difl-google-tag-v1')) {
      var tag = document.createElement('script');
      tag.id = 'difl-google-tag-v1';
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
      tag.referrerPolicy = 'strict-origin-when-cross-origin';
      (document.head || document.documentElement).appendChild(tag);
    }
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-difl-consent-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/privacy-consent-v1.css';
    link.setAttribute('data-difl-consent-style', '1');
    (document.head || document.documentElement).appendChild(link);
  }

  function buildBanner() {
    var existing = document.getElementById('difl-consent-banner');
    if (existing) return existing;

    var banner = document.createElement('section');
    banner.id = 'difl-consent-banner';
    banner.className = 'difl-consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy choices');
    banner.setAttribute('aria-live', 'polite');
    banner.hidden = true;
    banner.innerHTML =
      '<div class="difl-consent__copy">' +
        '<strong class="difl-consent__title">Your privacy choices</strong>' +
        '<p>Essential storage keeps your choice. With permission, Google Analytics and Google Ads use limited measurement storage to help DIFL understand visits and campaign results. This choice does not enable personalised advertising.</p>' +
        '<a class="difl-consent__link" href="/privacy-policy/">Read the privacy policy</a>' +
      '</div>' +
      '<div class="difl-consent__actions">' +
        '<button class="difl-consent__button difl-consent__button--primary" type="button" data-difl-consent-accept>Accept measurement</button>' +
        '<button class="difl-consent__button difl-consent__button--secondary" type="button" data-difl-consent-reject>Reject non-essential</button>' +
      '</div>';

    banner.querySelector('[data-difl-consent-accept]').addEventListener('click', function () {
      applyConsent('accepted', true);
      startGoogleTag();
      hideBanner();
      schedulePageView(true);
    });
    banner.querySelector('[data-difl-consent-reject]').addEventListener('click', function () {
      applyConsent('rejected', true);
      hideBanner();
    });

    document.body.appendChild(banner);
    return banner;
  }

  function showBanner(focusFirstControl) {
    var banner = buildBanner();
    previouslyFocused = document.activeElement;
    banner.hidden = false;
    window.requestAnimationFrame(function () {
      banner.classList.add('difl-consent--visible');
      if (focusFirstControl) {
        var firstButton = banner.querySelector('button');
        if (firstButton) firstButton.focus();
      }
    });
  }

  function hideBanner() {
    var banner = document.getElementById('difl-consent-banner');
    if (!banner) return;
    banner.classList.remove('difl-consent--visible');
    window.setTimeout(function () {
      banner.hidden = true;
    }, 180);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus({ preventScroll: true });
    }
    previouslyFocused = null;
  }

  function allowedCampaignParameters() {
    return [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'dclid', 'gbraid', 'wbraid'
    ];
  }

  function measurementLocation() {
    var current = safeUrl(window.location.href);
    if (!current) return window.location.origin + window.location.pathname;

    var clean = new URL(current.origin + current.pathname);
    var allowed = ['page', 'p'].concat(allowedCampaignParameters());
    allowed.forEach(function (name) {
      var value = current.searchParams.get(name);
      if (!value && landingUrl && allowedCampaignParameters().indexOf(name) !== -1) {
        value = landingUrl.searchParams.get(name);
      }
      if (value) clean.searchParams.set(name, value.slice(0, 200));
    });
    return clean.href;
  }

  function pageKey() {
    var url = safeUrl(measurementLocation());
    return url ? url.pathname + url.search : window.location.pathname;
  }

  function sendCurrentPageView(force) {
    if (currentChoice !== 'accepted') return false;
    startGoogleTag();
    var key = pageKey();
    if (!force && key === lastPageKey) return false;
    lastPageKey = key;
    window.gtag('event', 'page_view', {
      send_to: MEASUREMENT_SEND_TO,
      page_title: String(document.title || 'DIFL').slice(0, 200),
      page_location: measurementLocation(),
      page_path: key
    });
    return true;
  }

  function schedulePageView(force) {
    window.clearTimeout(pageViewTimer);
    pageViewTimer = window.setTimeout(function () {
      sendCurrentPageView(Boolean(force));
    }, 80);
  }

  function cleanEventToken(value, fallback) {
    var token = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    return token || fallback;
  }

  function trackContact(channel) {
    if (currentChoice !== 'accepted') return false;
    var safeChannel = cleanEventToken(channel, 'other');
    if (['phone', 'whatsapp', 'chat'].indexOf(safeChannel) === -1) safeChannel = 'other';
    window.gtag('event', 'contact_click', {
      send_to: MEASUREMENT_SEND_TO,
      channel: safeChannel
    });
    return true;
  }

  function trackLead(method) {
    if (currentChoice !== 'accepted') return false;
    var safeMethod = cleanEventToken(method, 'web_form');
    if (['web_form', 'phone', 'whatsapp', 'chat'].indexOf(safeMethod) === -1) {
      safeMethod = 'web_form';
    }
    window.gtag('event', 'generate_lead', {
      send_to: MEASUREMENT_SEND_TO,
      method: safeMethod
    });
    return true;
  }

  function trackQuizComplete() {
    if (currentChoice !== 'accepted') return false;
    window.gtag('event', 'quiz_complete', {
      send_to: MEASUREMENT_SEND_TO,
      quiz_name: 'language_finder'
    });
    return true;
  }

  function formWasTracked(form) {
    if (!form) return false;
    if (trackedForms) {
      if (trackedForms.has(form)) return true;
      trackedForms.add(form);
      return false;
    }
    if (form.getAttribute('data-difl-lead-tracked') === '1') return true;
    form.setAttribute('data-difl-lead-tracked', '1');
    return false;
  }

  function formspreeSuccess(form) {
    var target = form && form.nodeType === 1 ? form : null;
    if (target && formWasTracked(target)) return false;
    return trackLead('web_form');
  }

  function scanForSuccessfulForms() {
    var forms = document.querySelectorAll('form[action*="formspree.io"], form[id^="difl-contact-form-"]');
    Array.prototype.forEach.call(forms, function (form) {
      if (String(form.getAttribute('data-fs-state') || '').toLowerCase() === 'success') {
        formspreeSuccess(form);
        return;
      }
      var container = form.closest('.contact-form') || form.parentElement;
      var success = container && container.querySelector('[data-fs-success]');
      if (!success) return;
      var style = window.getComputedStyle(success);
      if (!success.hidden && style.display !== 'none' && style.visibility !== 'hidden') {
        formspreeSuccess(form);
      }
    });
  }

  function installFormSuccessDetection() {
    scanForSuccessfulForms();
    if (typeof MutationObserver !== 'function') return;
    var observer = new MutationObserver(function () {
      scanForSuccessfulForms();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-fs-state', 'class', 'hidden', 'style']
    });
  }

  function installNavigationTracking() {
    if (window.__DIFL_HISTORY_TRACKING_V1__) return;
    window.__DIFL_HISTORY_TRACKING_V1__ = true;
    ['pushState', 'replaceState'].forEach(function (methodName) {
      var original = window.history[methodName];
      if (typeof original !== 'function') return;
      window.history[methodName] = function () {
        var result = original.apply(this, arguments);
        schedulePageView(false);
        return result;
      };
    });
    window.addEventListener('popstate', function () { schedulePageView(false); });
    window.addEventListener('pageshow', function () { schedulePageView(false); });
    document.addEventListener('difl:navigation', function () { schedulePageView(false); });
  }

  function installClickTracking() {
    document.addEventListener('click', function (event) {
      var openControl = event.target.closest && event.target.closest('[data-difl-consent-open]');
      if (openControl) {
        event.preventDefault();
        showBanner(true);
        return;
      }
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      var href = String(link.getAttribute('href') || '').trim().toLowerCase();
      if (href.indexOf('tel:') === 0) trackContact('phone');
      else if (
        href.indexOf('wa.me/') !== -1 ||
        href.indexOf('whatsapp.com/') !== -1 ||
        href.indexOf('whatsapp:') === 0
      ) trackContact('whatsapp');
    }, { passive: false });
  }

  window.DIFLConsent = Object.freeze({
    open: function () { showBanner(true); },
    accept: function () {
      applyConsent('accepted', true);
      startGoogleTag();
      hideBanner();
      schedulePageView(true);
    },
    reject: function () {
      applyConsent('rejected', true);
      hideBanner();
    },
    getStatus: function () { return currentChoice; }
  });

  window.DIFLAnalytics = Object.freeze({
    pageView: function () { return sendCurrentPageView(true); },
    formspreeSuccess: formspreeSuccess,
    trackLead: trackLead,
    trackContact: trackContact,
    quizComplete: trackQuizComplete
  });

  function onReady() {
    buildBanner();
    installNavigationTracking();
    installClickTracking();
    installFormSuccessDetection();
    document.addEventListener('difl:formspree-success', function (event) {
      formspreeSuccess(event.detail && event.detail.form);
    });
    document.addEventListener('difl:quiz-complete', trackQuizComplete);
    if (currentChoice === 'unset') showBanner(false);
    else if (currentChoice === 'accepted') schedulePageView(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
}());
