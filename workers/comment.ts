/**
 * Cloudflare Pages Function: /api/comment
 *
 * GET  /api/comment?targetType=book&targetId=...  → list comments
 * POST /api/comment                                 → create comment (JWT required)
 *
 * Skeleton: validates the JWT (if present) and echoes back the
 * would-be-created record. Persistence to D1 plugs in once the
 * `comments` table is migrated.
 */
import type { APIRoute } from 'astro';
import { extractBearer, verifySession } from '../../src/lib/auth';

export const prerender = false;

interface CreateCommentBody {
  targetType: 'book' | 'chapter' | 'segment';
  targetId: string;
  segmentId?: string;
  content: string;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');
  if (!targetType || !targetId) {
    return json({ error: 'targetType and targetId are required' }, 400);
  }
  // Skeleton: empty list. Real impl will query `comments`.
  return json({ ok: true, comments: [] });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
  const token = extractBearer(request);
  const session = token ? await verifySession(token, env) : null;
  if (!session) return json({ error: 'authentication required' }, 401);

  let body: CreateCommentBody;
  try {
    body = (await request.json()) as CreateCommentBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.content?.trim() || !body.targetType || !body.targetId) {
    return json({ error: 'content, targetType, targetId are required' }, 400);
  }

  return json(
    {
      ok: true,
      comment: {
        id: crypto.randomUUID(),
        author: session.username ?? session.sub,
        content: body.content,
        targetType: body.targetType,
        targetId: body.targetId,
        segmentId: body.segmentId ?? null,
        createdAt: new Date().toISOString(),
      },
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
