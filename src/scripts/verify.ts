const form = document.querySelector<HTMLFormElement>('#verify-form');
const input = document.querySelector<HTMLInputElement>('#verification-code');
const button = document.querySelector<HTMLButtonElement>('#verify-button');
const message = document.querySelector<HTMLElement>('#verify-message');
const result = document.querySelector<HTMLElement>('#result');

if (!form || !input || !button || !message || !result) {
  throw new Error('The certificate verification form could not be initialised.');
}

const setText = (id: string, text?: string) => {
  const target = document.querySelector<HTMLElement>(`#${id}`);
  if (target) target.textContent = text || '—';
};

const run = async () => {
  const token = input.value.trim().toLowerCase();
  result.classList.add('hidden');
  message.className = 'notice';
  message.textContent = 'Checking the secure DIFL registry…';
  button.disabled = true;

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Verification is temporarily unavailable.');
    if (!data.found) {
      message.className = 'notice error';
      message.textContent = 'No certificate matches this verification code. Check the complete link or contact DIFL directly.';
      return;
    }

    message.className = 'notice hidden';
    const item = data.certificate;
    const active = item.status === 'valid';
    setText('result-number', item.certificate_number);
    setText('result-name', item.student_name_masked);
    setText('result-course', item.course_name);
    setText('result-language', [item.language, item.level].filter(Boolean).join(' · '));
    setText('result-date', new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(`${item.issue_date}T00:00:00`)));
    setText('result-status', item.status[0].toUpperCase() + item.status.slice(1));
    setText('result-label', active ? 'Authentic DIFL record' : 'Record found — certificate is not valid');
    setText('result-mark', active ? '✓' : '!');
    result.classList.toggle('invalid', !active);
    result.classList.remove('hidden');
  } catch (error) {
    message.className = 'notice error';
    message.textContent = error instanceof Error ? error.message : 'Verification is temporarily unavailable.';
  } finally {
    button.disabled = false;
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void run();
});

const initial = new URLSearchParams(location.search).get('code');
if (initial) {
  input.value = initial;
  void run();
}
