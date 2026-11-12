import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonHeaders, readJsonBody, sameOrigin } from '../../lib/supabase-server';
import {
  cleanAssistantText,
  DIFL_ASSISTANT_SYSTEM_PROMPT,
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_ASSISTANT_MESSAGES,
} from '../../lib/difl-assistant';

export const prerender = false;

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(MAX_ASSISTANT_MESSAGE_CHARS),
});
const bodySchema = z.object({ messages: z.array(messageSchema).min(1).max(MAX_ASSISTANT_MESSAGES) });

const requestWindows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function visitorKey(request: Request) {
  return request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function isRateLimited(request: Request) {
  const key = visitorKey(request);
  const now = Date.now();
  if (requestWindows.size > 2_000) {
    for (const [entryKey, entry] of requestWindows) {
      if (entry.resetAt <= now) requestWindows.delete(entryKey);
    }
  }
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return reply(403, { error: 'Request rejected.' });
  if (isRateLimited(request)) return reply(429, { error: 'Please wait a few minutes before sending another message.' });

  try {
    const parsed = bodySchema.safeParse(await readJsonBody(request, 8192));
    if (!parsed.success) return reply(400, { error: 'Please send a short course-related message.' });

    const messages = parsed.data.messages.map((message) => ({
      role: message.role,
      content: cleanAssistantText(message.content).slice(0, MAX_ASSISTANT_MESSAGE_CHARS),
    })).filter((message) => message.content.length > 0);
    if (!messages.length || messages.at(-1)?.role !== 'user') return reply(400, { error: 'Please send a question for DIFL Guide.' });

    const model = import.meta.env.AI_GATEWAY_MODEL;
    const token = import.meta.env.AI_GATEWAY_API_KEY || import.meta.env.VERCEL_OIDC_TOKEN;
    if (!model || !token) {
      return reply(503, {
        error: 'DIFL Guide is being activated. Please call +91 93145 02814 or send an enquiry and the team will help you.',
      });
    }

    const upstream = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: DIFL_ASSISTANT_SYSTEM_PROMPT }, ...messages],
        temperature: 0.2,
        max_tokens: 260,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      console.error('DIFL Guide upstream error', upstream.status);
      return reply(503, { error: 'DIFL Guide is temporarily unavailable. Please call +91 93145 02814 for immediate help.' });
    }

    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = cleanAssistantText(data.choices?.[0]?.message?.content || '').slice(0, 1400);
    if (!content) return reply(503, { error: 'DIFL Guide could not answer right now. Please call +91 93145 02814.' });
    return reply(200, { message: content });
  } catch (error) {
    console.error('DIFL Guide request failed', error instanceof Error ? error.message : 'unknown error');
    return reply(503, { error: 'DIFL Guide is temporarily unavailable. Please call +91 93145 02814 for immediate help.' });
  }
};

export const ALL: APIRoute = () => new Response(JSON.stringify({ error: 'Method not allowed.' }), {
  status: 405,
  headers: { ...jsonHeaders, allow: 'POST' },
});
