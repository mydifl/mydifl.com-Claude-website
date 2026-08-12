import type { User } from '@supabase/supabase-js';
import { configured, supabase } from '../lib/supabase-browser';
import { normalizeCertificateNumber, randomVerificationToken, safeFileName, sha256 } from '../lib/security';

type StaffProfile = { user_id: string; email: string; display_name: string; role: 'owner' | 'admin' | 'staff' | 'viewer'; active: boolean };
type CertificateAttachment = { id: string; kind: 'certificate' | 'photo' | 'other'; file_path: string; file_name: string; mime_type: string };
type Certificate = {
  id: string; certificate_number: string; student_name: string; mobile: string | null; email: string | null;
  contact_address: string | null; course_name: string; language: string; level: string | null; issue_date: string;
  status: 'valid' | 'revoked' | 'replaced'; status_note: string | null; file_path: string | null; file_name: string | null;
  certificate_attachments?: CertificateAttachment[];
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
  $<HTMLButtonElement>('download-template').disabled = currentProfile.role === 'viewer';
  $<HTMLButtonElement>('bulk-upload').disabled = currentProfile.role === 'viewer';
  $<HTMLButtonElement>('import-csv').disabled = currentProfile.role === 'viewer';
  setOnly('dashboard');
  await Promise.all([loadCertificates(), supabase.from('staff_profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', currentUser.id)]);
}

async function loadCertificates() {
  if (!supabase) return;
  const { data, error } = await supabase.from('certificates')
    .select('id,certificate_number,student_name,mobile,email,contact_address,course_name,language,level,issue_date,status,status_note,file_path,file_name,certificate_attachments(id,kind,file_path,file_name,mime_type)')
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
    const attachments = item.certificate_attachments || [];
    const scanPath = attachments.find((file) => file.kind === 'certificate')?.file_path || item.file_path;
    const photoPath = attachments.find((file) => file.kind === 'photo')?.file_path;
    if (scanPath) { const file = document.createElement('button'); file.type = 'button'; file.textContent = 'Scan'; file.addEventListener('click', () => openPrivateFile(scanPath)); actions.append(file); }
    if (photoPath) { const photo = document.createElement('button'); photo.type = 'button'; photo.textContent = 'Photo'; photo.addEventListener('click', () => openPrivateFile(photoPath)); actions.append(photo); }
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

async function validatePrivateFile(file: File, allowPdf = true) {
  const allowed = allowPdf ? ['application/pdf', 'image/jpeg', 'image/png'] : ['image/jpeg', 'image/png'];
  if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: use ${allowPdf ? 'a PDF, JPG, or PNG' : 'a JPG or PNG'} no larger than 10 MB.`);
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const validMagic = (allowPdf && file.type === 'application/pdf' && String.fromCharCode(...header.slice(0, 5)) === '%PDF-') ||
    (file.type === 'image/png' && header.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') ||
    (file.type === 'image/jpeg' && header[0] === 255 && header[1] === 216 && header[2] === 255);
  if (!validMagic) throw new Error(`${file.name}: the file contents do not match its stated type.`);
}

async function fileHash(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadAttachmentFile(recordId: string, file: File, kind: CertificateAttachment['kind']) {
  if (!supabase || !currentUser) throw new Error('Your secure session has ended. Sign in again.');
  await validatePrivateFile(file, kind !== 'photo');
  const path = `${recordId}/${kind}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from('certificate-files').upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { error: recordError } = await supabase.from('certificate_attachments').insert({
    certificate_id: recordId, kind, file_path: path, file_name: file.name, mime_type: file.type,
    file_sha256: await fileHash(file), created_by: currentUser.id,
  });
  if (recordError) throw recordError;
}

async function uploadFile(recordId: string, oldPath: string | null) {
  if (!supabase) return { path: oldPath, hash: null as string | null };
  const file = $<HTMLInputElement>('certificate-file').files?.[0];
  if (!file) return { path: oldPath, hash: null as string | null };
  await validatePrivateFile(file);
  const path = `${recordId}/${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from('certificate-files').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const hash = await fileHash(file);
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
    const photo = $<HTMLInputElement>('student-photo').files?.[0];
    if (photo) await uploadAttachmentFile(recordId, photo, 'photo');
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

async function downloadTemplate() {
  if (!supabase || currentProfile?.role === 'viewer') return;
  setNotice('dashboard-message', 'Preparing the protected Excel template…');
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch('/api/admin/template', { headers: { authorization: `Bearer ${session?.access_token || ''}` } });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    return setNotice('dashboard-message', result.error || 'The Excel template could not be downloaded.', 'error');
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = 'difl-certificate-bulk-import-template.xlsx';
  link.click();
  URL.revokeObjectURL(link.href);
  setNotice('dashboard-message', 'Excel template downloaded.', 'success');
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

function excelSerialToIso(value: string) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return value.trim();
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

function normalizeIssueDate(value: string) {
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return excelSerialToIso(trimmed);
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dayFirst = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  return trimmed;
}

async function unzipWorkbook(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Excel workbooks must be no larger than 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error('This is not a valid .xlsx workbook.');
  const entries = new Map<string, { method: number; compressedSize: number; uncompressedSize: number; localOffset: number }>();
  let cursor = view.getUint32(end + 16, true);
  const total = view.getUint16(end + 10, true);
  const decoder = new TextDecoder();
  let totalUncompressed = 0;
  for (let i = 0; i < total; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('The workbook ZIP directory is invalid.');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    totalUncompressed += uncompressedSize;
    if (uncompressedSize > 25 * 1024 * 1024 || totalUncompressed > 60 * 1024 * 1024) throw new Error('The workbook expands beyond the safe processing limit.');
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const readText = async (name: string) => {
    const entry = entries.get(name);
    if (!entry) return '';
    const localNameLength = view.getUint16(entry.localOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + entry.compressedSize);
    let content: Uint8Array;
    if (entry.method === 0) content = compressed;
    else if (entry.method === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error('The workbook uses an unsupported compression format.');
    return decoder.decode(content);
  };
  return { readText };
}

function xmlDocument(text: string, label: string) {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`${label} in the workbook is malformed.`);
  return document;
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() || 'A';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsx(file: File) {
  const archive = await unzipWorkbook(file);
  const sharedXml = await archive.readText('xl/sharedStrings.xml');
  const shared = sharedXml ? [...xmlDocument(sharedXml, 'Shared strings').querySelectorAll('si')].map((item) => [...item.querySelectorAll('t')].map((part) => part.textContent || '').join('')) : [];
  const sheetXml = await archive.readText('xl/worksheets/sheet1.xml');
  if (!sheetXml) throw new Error('The workbook must contain a first worksheet.');
  const sheet = xmlDocument(sheetXml, 'First worksheet');
  const rows: string[][] = [];
  for (const row of sheet.querySelectorAll('sheetData > row')) {
    const values: string[] = [];
    for (const cell of row.querySelectorAll('c')) {
      const index = columnIndex(cell.getAttribute('r') || 'A1');
      const type = cell.getAttribute('t');
      const raw = cell.querySelector('v')?.textContent || '';
      values[index] = type === 's' ? (shared[Number(raw)] || '') : type === 'inlineStr' ? [...cell.querySelectorAll('is t')].map((part) => part.textContent || '').join('') : raw;
    }
    if (values.some((part) => String(part || '').trim())) rows.push(values.map((part) => String(part || '').trim()));
  }
  return rows;
}

function fileMatchKey(name: string) {
  return name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function selectBulkFile(files: File[], requested: string, certificateNumber: string, kind: 'certificate' | 'photo') {
  if (requested) return files.find((file) => file.name.toLowerCase() === requested.toLowerCase()) || null;
  const prefix = fileMatchKey(certificateNumber);
  return files.find((file) => {
    const key = fileMatchKey(file.name.replace(/\.[^.]+$/, ''));
    return key.startsWith(prefix) && (kind === 'photo' ? /(photo|photograph|studentimage|studentphoto)/.test(key.slice(prefix.length)) : /(certificate|cert|scan)/.test(key.slice(prefix.length)));
  }) || null;
}

function downloadVerificationLinks(links: string[][]) {
  const escaped = links.map((parts) => parts.map((part) => `"${part.replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([escaped], { type: 'text/csv' }));
  link.download = `difl-verification-links-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importExcel(event: SubmitEvent) {
  event.preventDefault();
  if (!supabase || !currentUser || currentProfile?.role === 'viewer') return;
  const excel = $<HTMLInputElement>('excel-file').files?.[0];
  if (!excel) return setNotice('bulk-message', 'Select the completed Excel workbook.', 'error');
  const files = [...($<HTMLInputElement>('bulk-files').files || [])];
  const submit = $<HTMLButtonElement>('start-bulk');
  submit.disabled = true;
  setNotice('bulk-message', 'Validating workbook and matching private files…');
  try {
    if (files.length > 5000) throw new Error('Select no more than 5,000 attachment files in one import.');
    const rows = await parseXlsx(excel);
    if (rows.length < 2) throw new Error('The Excel workbook contains no certificate records.');
    if (rows.length > 2001) throw new Error('Import no more than 2,000 certificate rows at a time.');
    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const required = ['certificate_number', 'student_name', 'course_name', 'language', 'issue_date'];
    if (required.some((header) => !headers.includes(header))) throw new Error(`Excel must include: ${required.join(', ')}.`);
    const index = (name: string) => headers.indexOf(name);
    const at = (row: string[], name: string) => index(name) < 0 ? '' : (row[index(name)] || '').trim();
    const planned: { record: Record<string, unknown>; token: string; certificateNumber: string; certificateFile: File | null; photoFile: File | null }[] = [];
    const seen = new Set<string>();
    for (const [offset, raw] of rows.slice(1).entries()) {
      const rowNumber = offset + 2;
      const certificateNumber = normalizeCertificateNumber(at(raw, 'certificate_number'));
      const issueDate = normalizeIssueDate(at(raw, 'issue_date'));
      if (!certificateNumber || !at(raw, 'student_name') || !at(raw, 'course_name') || !at(raw, 'language') || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) throw new Error(`Row ${rowNumber} has invalid required data or date.`);
      if (seen.has(certificateNumber)) throw new Error(`Certificate ${certificateNumber} appears more than once in the workbook.`);
      seen.add(certificateNumber);
      const requestedCertificate = at(raw, 'certificate_file');
      const requestedPhoto = at(raw, 'photo_file');
      const certificateFile = selectBulkFile(files, requestedCertificate, certificateNumber, 'certificate');
      const photoFile = selectBulkFile(files, requestedPhoto, certificateNumber, 'photo');
      if (requestedCertificate && !certificateFile) throw new Error(`Row ${rowNumber}: certificate file "${requestedCertificate}" was not selected.`);
      if (requestedPhoto && !photoFile) throw new Error(`Row ${rowNumber}: photo file "${requestedPhoto}" was not selected.`);
      if (certificateFile) await validatePrivateFile(certificateFile);
      if (photoFile) await validatePrivateFile(photoFile, false);
      const token = randomVerificationToken();
      planned.push({ certificateNumber, token, certificateFile, photoFile, record: {
        id: crypto.randomUUID(), certificate_number: certificateNumber, verification_token_hash: await sha256(token),
        student_name: at(raw, 'student_name'), mobile: at(raw, 'mobile') || null, email: at(raw, 'email').toLowerCase() || null,
        contact_address: at(raw, 'contact_address') || null, course_name: at(raw, 'course_name'), language: at(raw, 'language'),
        level: at(raw, 'level') || null, issue_date: issueDate, status: ['valid','revoked','replaced'].includes(at(raw, 'status').toLowerCase()) ? at(raw, 'status').toLowerCase() : 'valid',
        source: 'archive_digitisation', created_by: currentUser.id, updated_by: currentUser.id,
      }});
    }
    const existing = new Set<string>();
    for (let offset = 0; offset < planned.length; offset += 100) {
      const { data, error } = await supabase.from('certificates').select('certificate_number').in('certificate_number', planned.slice(offset, offset + 100).map((item) => item.certificateNumber));
      if (error) throw error;
      for (const item of data || []) existing.add(item.certificate_number);
    }
    if (existing.size) throw new Error(`Already registered: ${[...existing].slice(0, 10).join(', ')}${existing.size > 10 ? '…' : ''}. No records were imported.`);
    setNotice('bulk-message', `Creating ${planned.length} protected records…`);
    for (let offset = 0; offset < planned.length; offset += 100) {
      const { error } = await supabase.from('certificates').insert(planned.slice(offset, offset + 100).map((item) => item.record));
      if (error) throw error;
    }
    let uploaded = 0;
    for (const [index, item] of planned.entries()) {
      setNotice('bulk-message', `Uploading private files ${index + 1} of ${planned.length}…`);
      const recordId = String(item.record.id);
      if (item.certificateFile) { await uploadAttachmentFile(recordId, item.certificateFile, 'certificate'); uploaded += 1; }
      if (item.photoFile) { await uploadAttachmentFile(recordId, item.photoFile, 'photo'); uploaded += 1; }
    }
    downloadVerificationLinks([['certificate_number', 'verification_link'], ...planned.map((item) => [item.certificateNumber, `${location.origin}/verify/?code=${item.token}`])]);
    $<HTMLFormElement>('bulk-form').reset();
    setNotice('bulk-message', `${planned.length} certificates and ${uploaded} private files uploaded. Verification links were downloaded.`, 'success');
    await loadCertificates();
  } catch (error) {
    setNotice('bulk-message', error instanceof Error ? error.message : 'The bulk import could not be completed.', 'error');
  } finally { submit.disabled = false; }
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
$('bulk-upload').addEventListener('click', () => { setNotice('bulk-message'); $<HTMLFormElement>('bulk-form').reset(); $<HTMLDialogElement>('bulk-dialog').showModal(); });
$('download-template').addEventListener('click', downloadTemplate);
$('close-bulk').addEventListener('click', () => $<HTMLDialogElement>('bulk-dialog').close());
$('cancel-bulk').addEventListener('click', () => $<HTMLDialogElement>('bulk-dialog').close());
$<HTMLFormElement>('bulk-form').addEventListener('submit', importExcel);
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
