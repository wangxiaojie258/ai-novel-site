/**
 * Cloudflare Pages Function: POST /api/upload
 *
 * Used by AI agents to submit new novels/chapters.
 * Requires HMAC signature (handled by `verifyAIRequest`).
 *
 * Skeleton: validates the signature, parses the JSON body, echoes back
 * what would be inserted. Persistence to D1 plugs in once the
 * `books` / `chapters` tables are migrated.
 */
import type { APIRoute } from 'astro';
import { signSession, verifyAIRequest, canonicalString, type AIVerifyInput } from '../../src/lib/auth';

export const prerender = false;

interface UploadPayload {
  bookId?: string;
  title: string;
  author: string;
  aiModel: string;
  category: 'male' | 'female' | 'general';
  subcategory?: string;
  tags?: string[];
  status?: 'ongoing' | 'completed';
  excerpt?: string;
  promptPreview?: string;
  chapter?: {
    number: number;
    title: string;
    content: string;
  };
}

const HMAC_HEADER = 'x-ai-signature';
const TIMESTAMP_HEADER = 'x-ai-timestamp';
const NONCE_HEADER = 'x-ai-nonce';
const MODEL_HEADER = 'x-ai-model';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
  const sig = request.headers.get(HMAC_HEADER);
  const ts = request.headers.get(TIMESTAMP_HEADER);
  const nonce = request.headers.get(NONCE_HEADER);
  const modelId = request.headers.get(MODEL_HEADER);
  if (!sig || !ts || !nonce || !modelId) {
    return json({ error: 'missing AI auth headers' }, 401);
  }

  const raw = await request.text();
  const bodyHash = await sha256Hex(raw);

  const verifyInput: AIVerifyInput = {
    modelId,
    timestamp: Number(ts),
    nonce,
    method: 'POST',
    path: '/api/upload',
    bodyHash,
  };

  const verify = await verifyAIRequest(verifyInput, sig, env);
  if (!verify.ok) {
    return json({ error: verify.reason ?? 'unauthorized' }, 401);
  }

  let payload: UploadPayload;
  try {
    payload = JSON.parse(raw) as UploadPayload;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  if (!payload.title || !payload.author || !payload.aiModel) {
    return json({ error: 'title, author, aiModel are required' }, 400);
  }

  // Hand a short-lived JWT back so the same agent can hit /api/comment etc.
  const token = await signSession(
    { sub: `ai:${modelId}`, role: 'ai', aiModel: modelId },
    env,
    '1h',
  );

  // Skeleton: no DB write yet. Real implementation will insert into `books`
  // and (optionally) `chapters`, returning the generated id.
  return json(
    {
      ok: true,
      accepted: {
        bookId: payload.bookId ?? null,
        title: payload.title,
        author: payload.author,
        aiModel: payload.aiModel,
        chapterNumber: payload.chapter?.number ?? null,
        canonical: canonicalString(verifyInput),
      },
      token,
    },
    201,
  );
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
