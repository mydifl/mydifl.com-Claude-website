(function (window, document) {
  'use strict';

  var TAWK_SRC = 'https://embed.tawk.to/6a158407e37d1e1c33dfbc7e/1jpi0ng61';
  var Tawk_API = window.Tawk_API = window.Tawk_API || {};
  var widgetReady = false;
  var chatRequested = false;
  var loadFailed = false;
  var loadStarted = false;
  var loadTimer;
  var launcher;
  var layoutObserver;
  var layoutFrame;

  // Keep the opened conversation below DIFL's navigation and WhatsApp button.
  Tawk_API.customStyle = { zIndex: '450 !important' };

  function addStyles() {
    var style = document.createElement('style');
    style.id = 'difl-chat-styles';
    style.textContent = [
      // Tawk's own launcher, attention grabber and message preview are the
      // frames that have intermittently appeared as large, unstyled content.
      // DIFL uses one stable local launcher instead.
      '#min-widget,#message-preview,#chat-bubble{display:none!important}',
      '#difl-chat-launcher{position:fixed;left:18px;bottom:18px;z-index:451;width:64px;height:60px;border:0;border-radius:20px;background:linear-gradient(145deg,#704127,#432319);color:#fff8ec;box-shadow:0 10px 28px rgba(53,27,16,.34);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font:700 10px/1.1 Inter,Arial,sans-serif;letter-spacing:.04em;transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease;isolation:isolate}',
      '#difl-chat-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(53,27,16,.42)}',
      '#difl-chat-launcher:focus-visible{outline:3px solid #f0cf79;outline-offset:3px}',
      '#difl-chat-launcher svg{width:25px;height:25px;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '#difl-chat-launcher .difl-close-icon{display:none}',
      '#difl-chat-launcher.is-open .difl-chat-icon{display:none}',
      '#difl-chat-launcher.is-open .difl-close-icon{display:block}',
      '#difl-chat-launcher.is-open{background:linear-gradient(145deg,#5e3a29,#2d1911)}',
      '#difl-chat-launcher[hidden]{display:none!important}',
      '#difl-chat-launcher.is-loading{cursor:wait;opacity:.82}',
      '#difl-chat-launcher.is-loading svg{animation:difl-chat-pulse 1s ease-in-out infinite}',
      // Keep a clear, independent close button above Tawk's cross-origin
      // panel. It remains available even when Tawk omits its own header.
      'body.difl-tawk-open #difl-chat-launcher{opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important;left:var(--difl-chat-close-left,270px)!important;top:var(--difl-chat-close-top,94px)!important;right:auto!important;bottom:auto!important;width:44px!important;height:44px!important;border:1px solid rgba(240,207,121,.72)!important;border-radius:999px!important;background:linear-gradient(145deg,#68402b,#2f1912)!important;color:#fff8ec!important;box-shadow:0 9px 24px rgba(19,8,4,.42)!important;z-index:452!important;gap:0!important}',
      'body.difl-tawk-open #difl-chat-launcher span{display:none!important}',
      'body.difl-tawk-open #difl-chat-launcher .difl-close-icon{display:block!important;width:22px!important;height:22px!important}',
      'body.difl-tawk-open #difl-chat-launcher:hover{background:linear-gradient(145deg,#7e5137,#3a2016)!important;transform:scale(1.04)!important}',
      '@keyframes difl-chat-pulse{50%{transform:scale(.82);opacity:.55}}',
      '@media(max-width:640px){#difl-chat-launcher{left:14px;bottom:14px;width:54px;height:52px;border-radius:17px;font-size:9px}#difl-chat-launcher svg{width:22px;height:22px}body.difl-tawk-open .wa-float{opacity:0!important;visibility:hidden!important;pointer-events:none!important}}',
      '@media(prefers-reduced-motion:reduce){#difl-chat-launcher,#difl-chat-launcher svg{animation:none!important;transition:none!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function setLauncherState(label, loading) {
    if (!launcher) return;
    launcher.classList.toggle('is-loading', Boolean(loading));
    launcher.querySelector('span').textContent = label;
    launcher.setAttribute('aria-busy', loading ? 'true' : 'false');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', loading ? 'Opening DIFL live chat; press again to cancel' : 'Open DIFL live chat');
  }

  function setLauncherOpen(open) {
    if (!launcher) return;
    launcher.classList.toggle('is-open', open);
    launcher.classList.remove('is-loading');
    launcher.querySelector('span').textContent = open ? 'CLOSE' : 'CHAT';
    launcher.setAttribute('aria-busy', 'false');
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    launcher.setAttribute('aria-label', open ? 'Close DIFL live chat' : 'Open DIFL live chat');
    launcher.title = open ? 'Close DIFL live chat' : 'Chat with DIFL';
  }

  function forceFrameStyle(frame, declarations) {
    if (!frame) return;
    Object.keys(declarations).forEach(function (property) {
      var value = declarations[property];
      if (frame.style.getPropertyValue(property) !== value || frame.style.getPropertyPriority(property) !== 'important') {
        frame.style.setProperty(property, value, 'important');
      }
    });
  }

  function positionTawkFrames() {
    layoutFrame = null;
    if (!document.body.classList.contains('difl-tawk-open')) return;

    var compact = window.innerWidth <= 640;
    var gutter = compact ? 12 : 18;
    var width = compact
      ? Math.min(300, Math.max(240, window.innerWidth - (gutter * 2)))
      : Math.min(310, Math.max(260, window.innerWidth - (gutter * 2)));
    var panelBottom = compact ? 66 : 72;
    var topGuard = compact ? 24 : 76;
    var heightLimit = compact ? 430 : 440;
    var height = Math.min(heightLimit, Math.max(240, window.innerHeight - panelBottom - topGuard));
    var panelTop = Math.max(10, window.innerHeight - panelBottom - height);
    var panel = document.querySelector('#max-widget iframe');
    var branding = document.querySelector('#branding-widget iframe');

    var outsideCloseLeft = gutter + width + 8;
    var insideCloseLeft = gutter + width - 52;
    var closeLeft = outsideCloseLeft + 44 <= window.innerWidth - 8 ? outsideCloseLeft : insideCloseLeft;
    launcher.style.setProperty('--difl-chat-close-left', Math.max(gutter + 8, closeLeft) + 'px');
    launcher.style.setProperty('--difl-chat-close-top', (panelTop + 8) + 'px');

    forceFrameStyle(panel, {
      left: gutter + 'px',
      right: 'auto',
      top: 'auto',
      bottom: panelBottom + 'px',
      width: width + 'px',
      'min-width': width + 'px',
      'max-width': width + 'px',
      height: height + 'px',
      'min-height': height + 'px',
      'max-height': height + 'px',
      'z-index': '450'
    });

    forceFrameStyle(branding, {
      left: gutter + 'px',
      right: 'auto',
      top: 'auto',
      bottom: compact ? '12px' : '16px',
      width: width + 'px',
      'min-width': width + 'px',
      'max-width': width + 'px',
      'z-index': '449'
    });
  }

  function scheduleTawkLayout() {
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(positionTawkFrames);
  }

  function watchTawkLayout() {
    if (layoutObserver) return;
    layoutObserver = new MutationObserver(function (mutations) {
      if (!document.body.classList.contains('difl-tawk-open')) return;
      for (var index = 0; index < mutations.length; index += 1) {
        var target = mutations[index].target;
        if (mutations[index].type === 'childList' || (target.closest && target.closest('#max-widget,#branding-widget'))) {
          scheduleTawkLayout();
          break;
        }
      }
    });
    layoutObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
    window.addEventListener('resize', scheduleTawkLayout, { passive: true });
  }

  function syncClosedState() {
    document.body.classList.remove('difl-tawk-open');
    setLauncherOpen(false);
    if (loadFailed) setLauncherState('RETRY', false);
  }

  function requestClose() {
    chatRequested = false;
    syncClosedState();
    if (widgetReady && typeof Tawk_API.minimize === 'function') Tawk_API.minimize();
    if (widgetReady && typeof Tawk_API.hideWidget === 'function') Tawk_API.hideWidget();
    window.setTimeout(function () {
      if (launcher) launcher.focus({ preventScroll: true });
    }, 0);
  }

  function openChat() {
    if (!widgetReady || !chatRequested) return;
    document.body.classList.add('difl-tawk-open');
    setLauncherOpen(true);
    if (typeof Tawk_API.showWidget === 'function') Tawk_API.showWidget();
    if (typeof Tawk_API.maximize === 'function') Tawk_API.maximize();
    scheduleTawkLayout();
  }

  function handleLoadFailure(script) {
    loadFailed = true;
    loadStarted = false;
    chatRequested = false;
    window.clearTimeout(loadTimer);
    if (script && script.parentNode) script.parentNode.removeChild(script);
    setLauncherState('RETRY', false);
    launcher.title = 'Live chat could not load — click to retry';
  }

  function loadTawk() {
    if (loadStarted) return;
    loadStarted = true;
    loadFailed = false;
    window.Tawk_LoadStart = new Date();

    var previous = document.getElementById('difl-tawk-embed');
    if (previous && previous.parentNode) previous.parentNode.removeChild(previous);

    var script = document.createElement('script');
    script.id = 'difl-tawk-embed';
    script.async = true;
    script.src = TAWK_SRC;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    script.onerror = function () { handleLoadFailure(script); };
    document.head.appendChild(script);

    // A slow load must never redirect or leave an uncancellable overlay.
    loadTimer = window.setTimeout(function () {
      if (!widgetReady) handleLoadFailure(script);
    }, 30000);
  }

  function createLauncher() {
    launcher = document.createElement('button');
    launcher.id = 'difl-chat-launcher';
    launcher.type = 'button';
    launcher.title = 'Chat with DIFL';
    launcher.setAttribute('aria-label', 'Open DIFL live chat');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-busy', 'false');
    launcher.innerHTML = '<svg class="difl-chat-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.4 9.4 0 0 1-4-.9L3 21l1.7-4.5A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg><svg class="difl-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>CHAT</span>';
    launcher.addEventListener('click', function () {
      if (launcher.classList.contains('is-open')) {
        requestClose();
        return;
      }
      if (launcher.classList.contains('is-loading')) {
        chatRequested = false;
        setLauncherState('CHAT', false);
        launcher.title = 'Chat with DIFL';
        return;
      }

      chatRequested = true;
      setLauncherState('OPENING', true);
      if (widgetReady) openChat();
      else loadTawk();
    });
    document.body.appendChild(launcher);
  }

  Tawk_API.onLoad = function () {
    window.clearTimeout(loadTimer);
    widgetReady = true;
    loadFailed = false;
    if (chatRequested) openChat();
    else {
      syncClosedState();
      if (typeof Tawk_API.hideWidget === 'function') Tawk_API.hideWidget();
    }
  };
  Tawk_API.onChatMaximized = function () {
    if (!chatRequested) return;
    document.body.classList.add('difl-tawk-open');
    setLauncherOpen(true);
    scheduleTawkLayout();
  };
  Tawk_API.onChatMinimized = syncClosedState;
  Tawk_API.onChatHidden = syncClosedState;

  function initialise() {
    addStyles();
    createLauncher();
    watchTawkLayout();
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('difl-tawk-open')) requestClose();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})(window, document);
