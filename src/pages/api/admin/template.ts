import type { APIRoute } from 'astro';
import { bulkTemplateBase64 } from '../../../data/bulk-template';
import { jsonHeaders, sameOrigin, verifiedStaff } from '../../../lib/supabase-server';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return new Response(JSON.stringify({ error: 'Request rejected.' }), { status: 403, headers: jsonHeaders });
  const caller = await verifiedStaff(request, ['owner', 'admin', 'staff']);
  if (!caller) return new Response(JSON.stringify({ error: 'Signed-in staff access with MFA is required.' }), { status: 403, headers: jsonHeaders });
  const bytes = Uint8Array.from(atob(bulkTemplateBase64), (character) => character.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="difl-certificate-bulk-import-template.xlsx"',
      'cache-control': 'private, no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
};

export const ALL: APIRoute = () => new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { ...jsonHeaders, allow: 'GET' } });
