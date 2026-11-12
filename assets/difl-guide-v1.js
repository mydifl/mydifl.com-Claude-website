(function () {
  'use strict';
  if (window.__diflGuideLoaded) return;
  window.__diflGuideLoaded = true;

  var history = [];
  var open = false;
  var root;
  var launcher;
  var panel;
  var list;
  var form;
  var input;
  var live;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character];
    });
  }

  function addStyles() {
    var style = document.createElement('style');
    style.id = 'difl-guide-styles';
    style.textContent = '#difl-guide{position:fixed;right:18px;bottom:18px;z-index:460;font-family:Inter,Arial,sans-serif;color:#2f1a12}#difl-guide-launcher{width:64px;height:60px;border:0;border-radius:20px;background:linear-gradient(145deg,#704127,#432319);color:#fff8ec;box-shadow:0 10px 28px rgba(53,27,16,.34);font:700 10px/1.1 Inter,Arial,sans-serif;letter-spacing:.05em;cursor:pointer;float:right}#difl-guide-launcher:hover{transform:translateY(-2px)}#difl-guide-launcher:focus-visible,#difl-guide-close:focus-visible,#difl-guide-form input:focus-visible,#difl-guide-form button:focus-visible{outline:3px solid #e2bd65;outline-offset:3px}#difl-guide-panel{display:none;clear:both;width:min(372px,calc(100vw - 28px));height:min(570px,calc(100vh - 108px));margin-bottom:12px;border:1px solid rgba(112,65,39,.28);border-radius:22px;background:#fffaf2;box-shadow:0 24px 64px rgba(53,27,16,.26);overflow:hidden;grid-template-rows:auto 1fr auto}#difl-guide.is-open #difl-guide-panel{display:grid}#difl-guide-head{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 14px;background:linear-gradient(135deg,#4b281b,#704127);color:#fff8ec}#difl-guide-head strong{display:block;font-size:16px}#difl-guide-head small{display:block;margin-top:3px;color:#f4dfaf;font-size:11px}#difl-guide-close{border:1px solid rgba(255,248,236,.45);width:32px;height:32px;border-radius:50%;background:transparent;color:#fff8ec;font-size:21px;line-height:1;cursor:pointer}#difl-guide-messages{overflow-y:auto;padding:15px;background:linear-gradient(180deg,#fffaf2,#f8eee0)}.difl-guide-message{max-width:88%;margin:0 0 11px;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap}.difl-guide-bot{background:#fff;color:#3a241a;border:1px solid rgba(112,65,39,.12);border-bottom-left-radius:4px}.difl-guide-user{margin-left:auto;background:#704127;color:#fff8ec;border-bottom-right-radius:4px}.difl-guide-actions{display:flex;gap:8px;flex-wrap:wrap;margin:1px 0 12px}.difl-guide-actions a{padding:8px 10px;border:1px solid #c69545;border-radius:999px;color:#5f351f;background:#fff8ec;text-decoration:none;font-size:12px;font-weight:700}.difl-guide-help{padding:10px 14px 0;color:#725d51;font-size:11px;line-height:1.35}#difl-guide-form{display:flex;gap:8px;padding:12px 14px 14px;background:#fff;border-top:1px solid rgba(112,65,39,.12)}#difl-guide-form input{min-width:0;flex:1;border:1px solid #b98c52;border-radius:11px;padding:11px;color:#2f1a12;font:14px Inter,Arial,sans-serif}#difl-guide-form button{border:0;border-radius:11px;padding:0 14px;background:#704127;color:#fff8ec;font-weight:800;cursor:pointer}#difl-guide-form button:disabled{opacity:.6;cursor:wait}@media(max-width:640px){#difl-guide{right:14px;bottom:14px}#difl-guide-launcher{width:58px;height:54px;border-radius:18px}#difl-guide-panel{height:min(540px,calc(100vh - 88px));margin-bottom:10px}}@media(prefers-reduced-motion:reduce){#difl-guide-launcher{transition:none!important}}';
    document.head.appendChild(style);
  }

  function appendMessage(kind, text) {
    var node = document.createElement('div');
    node.className = 'difl-guide-message difl-guide-' + kind;
    node.innerHTML = escapeHtml(text);
    list.appendChild(node);
    list.scrollTop = list.scrollHeight;
    return node;
  }

  function addActions() {
    var actions = document.createElement('div');
    actions.className = 'difl-guide-actions';
    actions.innerHTML = '<a href="tel:+919314502814">Call DIFL</a><a href="https://wa.me/919929515151?text=Hello%20DIFL%2C%20I%20would%20like%20course%20guidance." target="_blank" rel="noopener">WhatsApp</a><a href="/contact/">Send enquiry</a>';
    list.appendChild(actions);
  }

  function setOpen(next) {
    open = next;
    root.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    launcher.textContent = open ? 'CLOSE' : 'ASK DIFL';
    if (open) window.setTimeout(function () { input.focus({ preventScroll: true }); }, 0);
  }

  function announce(text) { live.textContent = text; }

  async function sendMessage(event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    history = history.slice(-8);
    var button = form.querySelector('button');
    button.disabled = true;
    button.textContent = '…';
    announce('DIFL Guide is responding.');
    try {
      var response = await fetch('/api/assistant/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: history })
      });
      var data = await response.json();
      var answer = data.message || data.error || 'Please call +91 93145 02814 for immediate guidance.';
      appendMessage('bot', answer);
      if (data.message) history.push({ role: 'assistant', content: answer });
      if (/call|whatsapp|counsellor|counselor|enquiry|admission|batch|fee/i.test(answer)) addActions();
      announce(answer);
    } catch (error) {
      var fallback = 'I could not connect just now. Please call +91 93145 02814 or send an enquiry.';
      appendMessage('bot', fallback);
      addActions();
      announce(fallback);
    } finally {
      button.disabled = false;
      button.textContent = 'Send';
    }
  }

  function init() {
    addStyles();
    root = document.createElement('section');
    root.id = 'difl-guide';
    root.setAttribute('aria-label', 'DIFL admissions assistant');
    root.innerHTML = '<div id="difl-guide-panel" role="dialog" aria-modal="false" aria-label="DIFL Guide"><div id="difl-guide-head"><div><strong>DIFL Guide</strong><small>Course guidance · Jaipur & online</small></div><button id="difl-guide-close" type="button" aria-label="Close DIFL Guide">×</button></div><div id="difl-guide-messages"></div><div><div class="difl-guide-help">For course guidance only. Please do not share payment, identity or passport details here.</div><form id="difl-guide-form"><input maxlength="600" autocomplete="off" aria-label="Ask DIFL Guide" placeholder="Ask about a language course…"><button type="submit">Send</button></form></div></div><button id="difl-guide-launcher" type="button" aria-expanded="false" aria-controls="difl-guide-panel" aria-label="Ask DIFL Guide">ASK DIFL</button><div id="difl-guide-live" class="sr-only" aria-live="polite"></div>';
    document.body.appendChild(root);
    launcher = root.querySelector('#difl-guide-launcher');
    panel = root.querySelector('#difl-guide-panel');
    list = root.querySelector('#difl-guide-messages');
    form = root.querySelector('#difl-guide-form');
    input = form.querySelector('input');
    live = root.querySelector('#difl-guide-live');
    appendMessage('bot', 'Hello! I’m DIFL Guide. Which language would you like to learn, and do you prefer Jaipur classroom, online or hybrid learning?');
    addActions();
    launcher.addEventListener('click', function () { setOpen(!open); });
    root.querySelector('#difl-guide-close').addEventListener('click', function () { setOpen(false); launcher.focus({ preventScroll: true }); });
    form.addEventListener('submit', sendMessage);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
