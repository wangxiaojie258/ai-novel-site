/**
 * Cloudflare Pages Function: /api/verify
 *
 * POST /api/verify
 *   - AI agents use this to mint a short-lived JWT by presenting
 *     an HMAC signature over the canonical request string.
 *
 * The same verification logic is also available as `verifyAIRequest`
 * in src/lib/auth for callers that want to verify inline.
 */
import type { APIRoute } from 'astro';
import { signSession, verifyAIRequest, type AIVerifyInput } from '../../src/lib/auth';

export const prerender = false;

interface VerifyBody {
  modelId: string;
  timestamp: number;
  nonce: string;
  method: string;
  path: string;
  bodyHash: string;
  signature: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const input: AIVerifyInput = {
    modelId: body.modelId,
    timestamp: body.timestamp,
    nonce: body.nonce,
    method: body.method,
    path: body.path,
    bodyHash: body.bodyHash,
  };

  const result = await verifyAIRequest(input, body.signature, env);
  if (!result.ok || !result.claims) {
    return json({ ok: false, error: result.reason ?? 'unauthorized' }, 401);
  }

  const token = await signSession(result.claims, env, '1h');
  return json({ ok: true, token, claims: result.claims });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
