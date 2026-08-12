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
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
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
