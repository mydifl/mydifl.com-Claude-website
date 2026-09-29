(function (window, document) {
  'use strict';

  var TAWK_SRC = 'https://embed.tawk.to/6a158407e37d1e1c33dfbc7e/1jpi0ng61';
  var WHATSAPP_URL = 'https://wa.me/919929515151';
  var Tawk_API = window.Tawk_API = window.Tawk_API || {};
  var widgetReady = false;
  var chatRequested = false;
  var loadFailed = false;
  var loadStarted = false;
  var launcher;

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
      '#difl-chat-launcher{position:fixed;left:18px;bottom:18px;z-index:451;width:64px;height:60px;border:0;border-radius:20px;background:linear-gradient(145deg,#0e7490,#155e75);color:#fff;box-shadow:0 10px 28px rgba(8,47,73,.28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font:700 10px/1.1 Inter,Arial,sans-serif;letter-spacing:.04em;transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease}',
      '#difl-chat-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(8,47,73,.35)}',
      '#difl-chat-launcher:focus-visible{outline:3px solid #f4c95d;outline-offset:3px}',
      '#difl-chat-launcher svg{width:25px;height:25px;display:block;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '#difl-chat-launcher .difl-close-icon{display:none}',
      '#difl-chat-launcher.is-open .difl-chat-icon{display:none}',
      '#difl-chat-launcher.is-open .difl-close-icon{display:block}',
      '#difl-chat-launcher.is-open{background:linear-gradient(145deg,#334155,#1e293b)}',
      '#difl-chat-launcher[hidden]{display:none!important}',
      '#difl-chat-launcher.is-loading{cursor:wait;opacity:.82}',
      '#difl-chat-launcher.is-loading svg{animation:difl-chat-pulse 1s ease-in-out infinite}',
      '@keyframes difl-chat-pulse{50%{transform:scale(.82);opacity:.55}}',
      '@media(max-width:640px){#difl-chat-launcher{left:14px;bottom:14px;width:54px;height:52px;border-radius:17px;font-size:9px}#difl-chat-launcher svg{width:22px;height:22px}}',
      '@media(prefers-reduced-motion:reduce){#difl-chat-launcher,#difl-chat-launcher svg{animation:none!important;transition:none!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function setLauncherState(label, loading) {
    if (!launcher) return;
    launcher.classList.toggle('is-loading', Boolean(loading));
    launcher.querySelector('span').textContent = label;
    launcher.setAttribute('aria-label', loading ? 'Opening DIFL live chat' : 'Open DIFL live chat');
  }

  function setLauncherOpen(open) {
    if (!launcher) return;
    launcher.classList.toggle('is-open', open);
    launcher.classList.remove('is-loading');
    launcher.querySelector('span').textContent = open ? 'CLOSE' : 'CHAT';
    launcher.setAttribute('aria-label', open ? 'Close DIFL live chat' : 'Open DIFL live chat');
    launcher.title = open ? 'Close DIFL live chat' : 'Chat with DIFL';
  }

  function closeChat() {
    document.body.classList.remove('difl-tawk-open');
    setLauncherOpen(false);
    if (loadFailed) setLauncherState('WhatsApp', false);
    if (widgetReady && typeof Tawk_API.hideWidget === 'function') Tawk_API.hideWidget();
  }

  function openChat() {
    if (!widgetReady) return;
    document.body.classList.add('difl-tawk-open');
    setLauncherOpen(true);
    if (typeof Tawk_API.showWidget === 'function') Tawk_API.showWidget();
    if (typeof Tawk_API.maximize === 'function') Tawk_API.maximize();
  }

  function handleLoadFailure() {
    loadFailed = true;
    chatRequested = false;
    setLauncherState('WhatsApp', false);
    launcher.title = 'Live chat is unavailable — open WhatsApp';
  }

  function loadTawk() {
    if (loadStarted) return;
    loadStarted = true;
    window.Tawk_LoadStart = new Date();

    var script = document.createElement('script');
    script.async = true;
    script.src = TAWK_SRC;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    script.onerror = handleLoadFailure;
    document.head.appendChild(script);

    window.setTimeout(function () {
      if (!widgetReady) handleLoadFailure();
    }, 12000);
  }

  function createLauncher() {
    launcher = document.createElement('button');
    launcher.id = 'difl-chat-launcher';
    launcher.type = 'button';
    launcher.title = 'Chat with DIFL';
    launcher.setAttribute('aria-label', 'Open DIFL live chat');
    launcher.innerHTML = '<svg class="difl-chat-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.4 9.4 0 0 1-4-.9L3 21l1.7-4.5A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg><svg class="difl-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>CHAT</span>';
    launcher.addEventListener('click', function () {
      if (launcher.classList.contains('is-open')) {
        if (typeof Tawk_API.minimize === 'function') Tawk_API.minimize();
        closeChat();
        return;
      }
      if (loadFailed) {
        window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
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
    widgetReady = true;
    loadFailed = false;

    // The service is deliberately hidden until a visitor uses DIFL's button.
    // This prevents saved sessions and attention-grabber campaigns from
    // opening or painting malformed frames over the website.
    if (chatRequested) openChat();
    else closeChat();
  };
  Tawk_API.onChatMaximized = function () {
    document.body.classList.add('difl-tawk-open');
    setLauncherOpen(true);
  };
  Tawk_API.onChatMinimized = closeChat;
  Tawk_API.onChatHidden = closeChat;

  function initialise() {
    addStyles();
    createLauncher();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})(window, document);
