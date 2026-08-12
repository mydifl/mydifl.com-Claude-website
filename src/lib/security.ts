export function normalizeCertificateNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9/_-]/g, '');
}

export function randomVerificationToken(bytes = 24) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function safeFileName(name: string) {
  const extension = name.toLowerCase().endsWith('.pdf') ? '.pdf' : name.toLowerCase().match(/\.jpe?g$/) ? '.jpg' : '.png';
  return `${crypto.randomUUID()}${extension}`;
}
