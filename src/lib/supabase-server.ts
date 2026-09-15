import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Certificate service is not configured.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export function sameOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin) return origin === expectedOrigin;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

export async function readJsonBody(request: Request, maxBytes = 4096) {
  const mediaType = (request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw new Error('JSON content type required');

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error('Request body too large');

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new Error('Request body too large');
  return JSON.parse(body) as unknown;
}

export async function verifiedStaff(request: Request, roles: string[]) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  const jwtPart = token.split('.')[1];
  if (!jwtPart) return null;
  const padded = jwtPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(jwtPart.length / 4) * 4, '=');
  let payload: { aal?: string };
  try { payload = JSON.parse(atob(padded)); } catch { return null; }
  if (payload.aal !== 'aal2') return null;
  const { data: profile } = await admin.from('staff_profiles').select('role,active').eq('user_id', user.id).maybeSingle();
  if (!profile?.active || !roles.includes(profile.role)) return null;
  return { admin, user, profile };
}
