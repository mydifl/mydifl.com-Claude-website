import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonHeaders, readJsonBody, sameOrigin, verifiedStaff } from '../../../lib/supabase-server';

export const prerender = false;

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(['admin', 'staff', 'viewer']),
});

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return new Response(JSON.stringify({ error: 'Request rejected.' }), { status: 403, headers: jsonHeaders });
  try {
    const caller = await verifiedStaff(request, ['owner', 'admin']);
    if (!caller) return new Response(JSON.stringify({ error: 'Authorised administrator access with MFA is required.' }), { status: 403, headers: jsonHeaders });
    const body = schema.safeParse(await readJsonBody(request, 4096));
    if (!body.success) return new Response(JSON.stringify({ error: 'Enter a valid name, email, and role.' }), { status: 400, headers: jsonHeaders });
    const { data, error } = await caller.admin.auth.admin.inviteUserByEmail(body.data.email, {
      redirectTo: `${new URL(request.url).origin}/admin/?invited=1`, data: { display_name: body.data.name },
    });
    if (error || !data.user) throw error || new Error('Invitation failed');
    const { error: profileError } = await caller.admin.from('staff_profiles').insert({
      user_id: data.user.id, email: body.data.email, display_name: body.data.name, role: body.data.role,
      active: true, created_by: caller.user.id,
    });
    if (profileError) { await caller.admin.auth.admin.deleteUser(data.user.id); throw profileError; }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch {
    return new Response(JSON.stringify({ error: 'The invitation could not be sent. The account may already exist.' }), { status: 400, headers: jsonHeaders });
  }
};

export const ALL: APIRoute = () => new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { ...jsonHeaders, allow: 'POST' } });
