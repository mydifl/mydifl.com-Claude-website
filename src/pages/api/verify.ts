import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSupabaseAdmin, jsonHeaders, sameOrigin } from '../../lib/supabase-server';

export const prerender = false;

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/i) });

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return new Response(JSON.stringify({ error: 'Request rejected.' }), { status: 403, headers: jsonHeaders });
  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return new Response(JSON.stringify({ found: false }), { status: 200, headers: jsonHeaders });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.data.token.toLowerCase()));
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('verify_certificate', { p_token_hash: tokenHash });
    if (error) throw error;
    const record = Array.isArray(data) ? data[0] : null;
    return new Response(JSON.stringify(record ? { found: true, certificate: record } : { found: false }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('Certificate verification failed', error instanceof Error ? error.message : 'Unknown server error');
    return new Response(JSON.stringify({ error: 'Verification is temporarily unavailable.' }), { status: 503, headers: jsonHeaders });
  }
};

export const ALL: APIRoute = () => new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { ...jsonHeaders, allow: 'POST' } });
