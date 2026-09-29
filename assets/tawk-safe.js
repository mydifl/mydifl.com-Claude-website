(function (window, document) {
  'use strict';

  var Tawk_API = window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  var chatOpen = false;
  var widgetReady = false;

  // tawk.to currently documents zIndex as the only supported customStyle
  // option. Keep the chat below DIFL's navigation and WhatsApp controls.
  Tawk_API.customStyle = { zIndex: '450 !important' };

  function setImportant(frame, property, value) {
    if (frame.style.getPropertyValue(property) !== value || frame.style.getPropertyPriority(property) !== 'important') {
      frame.style.setProperty(property, value, 'important');
    }
  }

  function normaliseWidgetFrames() {
    document.querySelectorAll('iframe[title="Chat widget"]').forEach(function (frame) {
      var rect = frame.getBoundingClientRect();
      var width = rect.width || parseFloat(frame.style.getPropertyValue('width')) || 0;
      var height = rect.height || parseFloat(frame.style.getPropertyValue('height')) || 0;
      var isLauncher = width > 0 && width <= 90 && height > 0 && height <= 80;
      var isBrokenAttentionGrabber = width >= 100 && width <= 240 && height >= 70 && height <= 180;
      var isChatPanel = width >= 300 && width <= 420;
      var isOversizedTeaser = isChatPanel && height > 0 && height < 400;

      // Never restore a large panel from an earlier browsing session. The
      // visitor must deliberately click the compact launcher on this page.
      if (isChatPanel && !widgetReady) {
        setImportant(frame, 'display', 'none');
        frame.setAttribute('aria-hidden', 'true');
        return;
      }

      if (isChatPanel && chatOpen) {
        setImportant(frame, 'display', 'block');
        frame.removeAttribute('aria-hidden');
        setImportant(frame, 'z-index', '450');
        return;
      }

      // The normal launcher is about 64x60 and the opened chat is 360x545.
      // Recent attention/teaser variants render as a 124x95 grey X and a
      // transparent 350px-wide click-blocking panel. Hide those frames only.
      if (isBrokenAttentionGrabber || isOversizedTeaser) {
        setImportant(frame, 'display', 'none');
        frame.setAttribute('aria-hidden', 'true');
        return;
      }

      // Keep the compact launcher separate from the right-side WhatsApp button.
      if (isLauncher) {
        setImportant(frame, 'left', '18px');
        setImportant(frame, 'right', 'auto');
        setImportant(frame, 'bottom', '18px');
      }

      setImportant(frame, 'z-index', '450');
    });
  }

  Tawk_API.onLoad = function () {
    Tawk_API.showWidget();
    Tawk_API.minimize();
    normaliseWidgetFrames();
    window.setTimeout(function () {
      chatOpen = false;
      Tawk_API.minimize();
      widgetReady = true;
      normaliseWidgetFrames();
    }, 800);
  };
  Tawk_API.onChatMaximized = function () {
    if (!widgetReady) {
      chatOpen = false;
      Tawk_API.minimize();
      normaliseWidgetFrames();
      return;
    }
    chatOpen = true;
    normaliseWidgetFrames();
  };
  Tawk_API.onChatMinimized = function () {
    chatOpen = false;
    normaliseWidgetFrames();
  };
  Tawk_API.onChatHidden = function () {
    chatOpen = false;
    normaliseWidgetFrames();
  };

  new MutationObserver(normaliseWidgetFrames).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'title']
  });

  var script = document.createElement('script');
  var firstScript = document.getElementsByTagName('script')[0];
  script.async = true;
  script.src = 'https://embed.tawk.to/6a158407e37d1e1c33dfbc7e/1jpi0ng61';
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '*');
  firstScript.parentNode.insertBefore(script, firstScript);
})(window, document);
