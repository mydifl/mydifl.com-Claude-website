import type { User } from '@supabase/supabase-js';
import { configured, supabase } from '../lib/supabase-browser';
import { normalizeCertificateNumber, randomVerificationToken, safeFileName, sha256 } from '../lib/security';

type StaffProfile = { user_id: string; email: string; display_name: string; role: 'owner' | 'admin' | 'staff' | 'viewer'; active: boolean };
type Certificate = {
  id: string; certificate_number: string; student_name: string; mobile: string | null; email: string | null;
  contact_address: string | null; course_name: string; language: string; level: string | null; issue_date: string;
  status: 'valid' | 'revoked' | 'replaced'; status_note: string | null; file_path: string | null; file_name: string | null;
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, visible = true) => $(id).classList.toggle('hidden', !visible);
const setNotice = (id: string, message = '', type: 'error' | 'success' | 'info' = 'info') => {
  const node = $(id);
  node.textContent = message;
  node.className = message ? `notice ${type === 'info' ? '' : type}` : 'notice hidden';
};
const value = (id: string) => ($<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id).value || '').trim();

let currentUser: User | null = null;
let currentProfile: StaffProfile | null = null;
let certificates: Certificate[] = [];
let mfaFactorId = '';
let enrollingFactorId = '';
let passwordSetupPending = new URLSearchParams(location.search).get('invited') === '1' || ['invite', 'recovery'].includes(new URLSearchParams(location.hash.slice(1)).get('type') || '');

function setOnly(panel: 'configuration' | 'login-panel' | 'password-panel' | 'mfa-panel' | 'unauthorised' | 'dashboard') {
  ['configuration', 'login-panel', 'password-panel', 'mfa-panel', 'unauthorised', 'dashboard'].forEach((id) => show(id, id === panel));
  show('sign-out', panel === 'password-panel' || panel === 'mfa-panel' || panel === 'unauthorised' || panel === 'dashboard');
}

async function routeSession() {
  if (!configured || !supabase) return setOnly('configuration');
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  if (!user) return setOnly('login-panel');
  if (passwordSetupPending) return setOnly('password-panel');

  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) return failMfa(factors.error.message);
  const verified = factors.data.totp.find((factor) => factor.status === 'verified');
  if (!verified) return beginMfaEnrollment();

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) return failMfa(aal.error.message);
  if (aal.data.currentLevel !== 'aal2') {
    mfaFactorId = verified.id;
    $('mfa-title').textContent = 'Enter your authenticator code';
    $('mfa-copy').textContent = 'Open your authenticator app and enter the current six-digit code.';
    show('mfa-qr-wrap', false);
    return setOnly('mfa-panel');
  }
  await loadProfile();
}

async function beginMfaEnrollment() {
  if (!supabase) return;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'DIFL Staff Portal' });
  if (error) return failMfa(error.message);
  enrollingFactorId = data.id;
  mfaFactorId = data.id;
  $('mfa-title').textContent = 'Protect your account';
  $('mfa-copy').textContent = 'Scan this one-time QR code in Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.';
  $<HTMLImageElement>('mfa-qr').src = data.totp.qr_code;
  show('mfa-qr-wrap');
  setOnly('mfa-panel');
}

function failMfa(message: string) {
  setOnly('mfa-panel');
  setNotice('mfa-message', message, 'error');
}

async function loadProfile() {
  if (!supabase || !currentUser) return;
  const { data, error } = await supabase.from('staff_profiles').select('user_id,email,display_name,role,active').eq('user_id', currentUser.id).maybeSingle();
  if (error || !data?.active) return setOnly('unauthorised');
  currentProfile = data as StaffProfile;
  $('staff-name').textContent = currentProfile.display_name;
  $('staff-role').textContent = `${currentProfile.role[0].toUpperCase()}${currentProfile.role.slice(1)} · ${currentProfile.email}`;
  show('staff-section', currentProfile.role === 'owner' || currentProfile.role === 'admin');
  $<HTMLButtonElement>('new-certificate').disabled = currentProfile.role === 'viewer';
  setOnly('dashboard');
  await Promise.all([loadCertificates(), supabase.from('staff_profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', currentUser.id)]);
}

async function loadCertificates() {
  if (!supabase) return;
  const { data, error } = await supabase.from('certificates')
    .select('id,certificate_number,student_name,mobile,email,contact_address,course_name,language,level,issue_date,status,status_note,file_path,file_name')
    .order('issue_date', { ascending: false }).limit(1000);
  if (error) return setNotice('dashboard-message', error.message, 'error');
  certificates = (data || []) as Certificate[];
  renderCertificates();
}

function renderCertificates() {
  const term = value('search').toLowerCase();
  const status = value('status-filter');
  const rows = certificates.filter((item) => (!status || item.status === status) &&
    (!term || [item.certificate_number, item.student_name, item.course_name, item.language, item.level || ''].some((field) => field.toLowerCase().includes(term))));
  const body = $('certificate-rows');
  body.replaceChildren();
  for (const item of rows) {
    const tr = document.createElement('tr');
    tr.append(cell(item.certificate_number, item.language));
    tr.append(cell(item.student_name, [item.mobile, item.email].filter(Boolean).join(' · ')));
    tr.append(cell(item.course_name, item.level || ''));
    tr.append(cell(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${item.issue_date}T00:00:00`))));
    const statusCell = document.createElement('td');
    const badge = document.createElement('span'); badge.className = `status ${item.status}`; badge.textContent = item.status; statusCell.append(badge); tr.append(statusCell);
    const actions = document.createElement('td'); actions.className = 'row-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Open'; edit.addEventListener('click', () => openCertificate(item)); actions.append(edit);
    if (item.file_path) { const file = document.createElement('button'); file.type = 'button'; file.textContent = 'Scan'; file.addEventListener('click', () => openPrivateFile(item.file_path!)); actions.append(file); }
    tr.append(actions); body.append(tr);
  }
  show('empty-state', rows.length === 0);
  $('stat-total').textContent = String(certificates.length);
  $('stat-valid').textContent = String(certificates.filter((item) => item.status === 'valid').length);
  $('stat-inactive').textContent = String(certificates.filter((item) => item.status !== 'valid').length);
}

function cell(primary: string, secondary = '') {
  const td = document.createElement('td'); const strong = document.createElement('strong'); strong.textContent = primary; td.append(strong);
  if (secondary) { const small = document.createElement('small'); small.textContent = secondary; td.append(small); }
  return td;
}

function openCertificate(item?: Certificate) {
  $<HTMLFormElement>('certificate-form').reset();
  setNotice('form-message'); show('verification-link-wrap', false);
  $('dialog-title').textContent = item ? 'Certificate details' : 'Add certificate';
  const values: Record<string, string> = item ? {
    'certificate-id': item.id, 'certificate-number': item.certificate_number, 'student-name': item.student_name,
    'mobile': item.mobile || '', 'student-email': item.email || '', 'contact-address': item.contact_address || '',
    'course-name': item.course_name, language: item.language, level: item.level || '', 'issue-date': item.issue_date,
    'certificate-status': item.status, 'status-note': item.status_note || '',
  } : { 'certificate-id': '', 'certificate-status': 'valid' };
  for (const [id, inputValue] of Object.entries(values)) $<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id).value = inputValue;
  const readOnly = currentProfile?.role === 'viewer';
  $<HTMLButtonElement>('save-certificate').classList.toggle('hidden', readOnly);
  show('regenerate-link', Boolean(item) && !readOnly);
  $<HTMLDialogElement>('certificate-dialog').showModal();
}

async function regenerateLink() {
  if (!supabase || !currentUser || currentProfile?.role === 'viewer') return;
  const id = value('certificate-id'); if (!id) return;
  if (!confirm('Replace the existing verification link? The old link will stop working immediately.')) return;
  const token = randomVerificationToken();
  const { error } = await supabase.from('certificates').update({ verification_token_hash: await sha256(token), updated_by: currentUser.id }).eq('id', id);
  if (error) return setNotice('form-message', error.message, 'error');
  $<HTMLInputElement>('verification-link').value = `${location.origin}/verify/?code=${encodeURIComponent(token)}`;
  show('verification-link-wrap'); setNotice('form-message', 'The old link is disabled. Copy and securely store the new link now.', 'success');
}

async function openPrivateFile(path: string) {
  if (!supabase) return;
  const { data, error } = await supabase.storage.from('certificate-files').createSignedUrl(path, 60);
  if (error) return setNotice('dashboard-message', error.message, 'error');
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

async function uploadFile(recordId: string, oldPath: string | null) {
  if (!supabase) return { path: oldPath, hash: null as string | null };
  const file = $<HTMLInputElement>('certificate-file').files?.[0];
  if (!file) return { path: oldPath, hash: null as string | null };
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Use a PDF, JPG, or PNG file no larger than 10 MB.');
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const validMagic = (file.type === 'application/pdf' && String.fromCharCode(...header.slice(0, 5)) === '%PDF-') ||
    (file.type === 'image/png' && header.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') ||
    (file.type === 'image/jpeg' && header[0] === 255 && header[1] === 216 && header[2] === 255);
  if (!validMagic) throw new Error('The selected file contents do not match its stated type.');
  const path = `${recordId}/${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from('certificate-files').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { path, hash };
}

async function saveCertificate(event: SubmitEvent) {
  event.preventDefault();
  if (!supabase || !currentUser || currentProfile?.role === 'viewer') return;
  const save = $<HTMLButtonElement>('save-certificate'); save.disabled = true;
  setNotice('form-message', 'Saving securely…');
  try {
    const recordId = value('certificate-id') || crypto.randomUUID();
    const existing = certificates.find((item) => item.id === recordId);
    const upload = await uploadFile(recordId, existing?.file_path || null);
    const payload: Record<string, unknown> = {
      id: recordId, certificate_number: normalizeCertificateNumber(value('certificate-number')), student_name: value('student-name'),
      mobile: value('mobile') || null, email: value('student-email').toLowerCase() || null, contact_address: value('contact-address') || null,
      course_name: value('course-name'), language: value('language'), level: value('level') || null, issue_date: value('issue-date'),
      status: value('certificate-status'), status_note: value('status-note') || null, file_path: upload.path,
      file_name: $<HTMLInputElement>('certificate-file').files?.[0]?.name || existing?.file_name || null, updated_by: currentUser.id,
    };
    if (upload.hash) payload.file_sha256 = upload.hash;
    let token = '';
    if (!existing) {
      token = randomVerificationToken();
      payload.verification_token_hash = await sha256(token);
      payload.created_by = currentUser.id;
    }
    const query = existing ? supabase.from('certificates').update(payload).eq('id', recordId) : supabase.from('certificates').insert(payload);
    const { error } = await query;
    if (error) throw error;
    if (token) {
      $<HTMLInputElement>('verification-link').value = `${location.origin}/verify/?code=${encodeURIComponent(token)}`;
      show('verification-link-wrap');
      setNotice('form-message', 'Certificate saved. Copy its verification link before closing.', 'success');
    } else {
      setNotice('form-message', 'Certificate updated.', 'success');
    }
    await loadCertificates();
  } catch (error) {
    setNotice('form-message', error instanceof Error ? error.message : 'The certificate could not be saved.', 'error');
  } finally { save.disabled = false; }
}

async function inviteStaff(event: SubmitEvent) {
  event.preventDefault();
  if (!supabase) return;
  setNotice('dashboard-message', 'Sending invitation…');
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch('/api/admin/invite', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ name: value('invite-name'), email: value('invite-email'), role: value('invite-role') }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return setNotice('dashboard-message', result.error || 'Invitation failed.', 'error');
  $<HTMLFormElement>('invite-form').reset(); setNotice('dashboard-message', 'Staff invitation sent. They must enable an authenticator app at first sign-in.', 'success');
}

function downloadTemplate() {
  const csv = 'certificate_number,student_name,mobile,email,contact_address,course_name,language,level,issue_date,status\nDIFL-2026-001,Example Student,+91XXXXXXXXXX,student@example.com,Jaipur,French Language,French,A1,2026-08-12,valid\n';
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'difl-certificate-import-template.csv'; link.click(); URL.revokeObjectURL(link.href);
}

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); if (row.some((part) => part.trim())) rows.push(row); row = []; field = '';
    } else field += char;
  }
  row.push(field); if (row.some((part) => part.trim())) rows.push(row);
  return rows;
}

async function importCsv(file: File) {
  if (!supabase || !currentUser || currentProfile?.role === 'viewer') return;
  if (file.size > 5 * 1024 * 1024) return setNotice('dashboard-message', 'CSV files must be no larger than 5 MB.', 'error');
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return setNotice('dashboard-message', 'The CSV contains no certificate records.', 'error');
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const required = ['certificate_number', 'student_name', 'course_name', 'language', 'issue_date'];
  if (required.some((header) => !headers.includes(header))) return setNotice('dashboard-message', `CSV must include: ${required.join(', ')}.`, 'error');
  const index = (name: string) => headers.indexOf(name);
  const links: string[][] = [['certificate_number', 'verification_link']];
  const records: Record<string, unknown>[] = [];
  try {
    for (const raw of rows.slice(1)) {
      const token = randomVerificationToken(); const certificateNumber = normalizeCertificateNumber(raw[index('certificate_number')] || '');
      if (!certificateNumber || !raw[index('student_name')]?.trim() || !raw[index('course_name')]?.trim() || !raw[index('language')]?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(raw[index('issue_date')]?.trim() || '')) throw new Error(`Invalid required data for certificate ${certificateNumber || '(blank)'}.`);
      records.push({
        certificate_number: certificateNumber, verification_token_hash: await sha256(token), student_name: raw[index('student_name')].trim(),
        mobile: raw[index('mobile')]?.trim() || null, email: raw[index('email')]?.trim().toLowerCase() || null,
        contact_address: raw[index('contact_address')]?.trim() || null, course_name: raw[index('course_name')].trim(), language: raw[index('language')].trim(),
        level: raw[index('level')]?.trim() || null, issue_date: raw[index('issue_date')].trim(), status: ['valid','revoked','replaced'].includes(raw[index('status')]?.trim()) ? raw[index('status')].trim() : 'valid',
        source: 'csv_import', created_by: currentUser.id, updated_by: currentUser.id,
      });
      links.push([certificateNumber, `${location.origin}/verify/?code=${token}`]);
    }
    setNotice('dashboard-message', `Importing ${records.length} records…`);
    for (let offset = 0; offset < records.length; offset += 100) {
      const { error } = await supabase.from('certificates').insert(records.slice(offset, offset + 100)); if (error) throw error;
    }
    const escaped = links.map((parts) => parts.map((part) => `"${part.replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([escaped], { type: 'text/csv' })); link.download = `difl-verification-links-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
    setNotice('dashboard-message', `${records.length} certificates imported. The verification-link file has been downloaded; store it securely.`, 'success'); await loadCertificates();
  } catch (error) { setNotice('dashboard-message', error instanceof Error ? error.message : 'Import failed.', 'error'); }
}

$<HTMLFormElement>('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!supabase) return;
  setNotice('login-message', 'Checking your account…');
  const { error } = await supabase.auth.signInWithPassword({ email: value('login-email').toLowerCase(), password: value('login-password') });
  if (error) return setNotice('login-message', 'Sign-in failed. Check your details and try again.', 'error');
  setNotice('login-message'); await routeSession();
});

$<HTMLFormElement>('mfa-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!supabase || !mfaFactorId) return;
  setNotice('mfa-message', 'Verifying…');
  const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
  if (challenge.error) return failMfa(challenge.error.message);
  const verified = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code: value('mfa-code') });
  if (verified.error) return failMfa('That code was not accepted. Wait for a new code and try again.');
  enrollingFactorId = ''; setNotice('mfa-message'); await routeSession();
});

$<HTMLFormElement>('password-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!supabase) return;
  const password = value('new-password');
  if (password !== value('confirm-password')) return setNotice('password-message', 'The passwords do not match.', 'error');
  if (password.length < 14) return setNotice('password-message', 'Use at least 14 characters.', 'error');
  setNotice('password-message', 'Securing your account…');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return setNotice('password-message', error.message, 'error');
  passwordSetupPending = false;
  history.replaceState({}, '', '/admin/'); setNotice('password-message'); await routeSession();
});

$('sign-out').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); location.assign('/admin/'); });
$('new-certificate').addEventListener('click', () => openCertificate());
$('close-dialog').addEventListener('click', () => $<HTMLDialogElement>('certificate-dialog').close());
$('cancel-dialog').addEventListener('click', () => $<HTMLDialogElement>('certificate-dialog').close());
$<HTMLFormElement>('certificate-form').addEventListener('submit', saveCertificate);
$('search').addEventListener('input', renderCertificates);
$('status-filter').addEventListener('change', renderCertificates);
$('copy-link').addEventListener('click', async () => { await navigator.clipboard.writeText(value('verification-link')); $('copy-link').textContent = 'Copied'; });
$('regenerate-link').addEventListener('click', regenerateLink);
$('download-template').addEventListener('click', downloadTemplate);
$('import-csv').addEventListener('click', () => $<HTMLInputElement>('csv-file').click());
$<HTMLInputElement>('csv-file').addEventListener('change', async (event) => { const file = (event.currentTarget as HTMLInputElement).files?.[0]; if (file) await importCsv(file); (event.currentTarget as HTMLInputElement).value = ''; });
$<HTMLFormElement>('invite-form').addEventListener('submit', inviteStaff);

window.addEventListener('beforeunload', () => { if (enrollingFactorId && supabase) void supabase.auth.mfa.unenroll({ factorId: enrollingFactorId }); });
supabase?.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    passwordSetupPending = true;
    setOnly('password-panel');
  }
});
void routeSession();
