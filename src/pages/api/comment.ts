/**
 * Comment API: /api/comment
 *
 * GET  /api/comment?targetType=book&targetId=...  → list comments
 * POST /api/comment { targetType, targetId, content } → create comment (auth required)
 */
import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/auth';

export const prerender = false;

interface CreateCommentBody {
  targetType: string;
  targetId: string;
  content: string;
}

function getDB(locals: App.Locals): D1Database | undefined {
  return (locals as Record<string, unknown>).runtime &&
    ((locals as Record<string, unknown>).runtime as Record<string, unknown>).env
    ? (((locals as Record<string, unknown>).runtime as Record<string, unknown>).env as Record<string, D1Database>).DB
    : undefined;
}

function getEnv(locals: App.Locals): Record<string, string> {
  return (
    ((locals as Record<string, unknown>)?.runtime as Record<string, unknown>)?.env ??
    {}
  ) as Record<string, string>;
}

async function getSession(request: Request, locals: App.Locals): Promise<{ sub: string; username?: string } | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const env = getEnv(locals);
  const claims = await verifySession(match[1], env);
  return claims ? { sub: claims.sub, username: claims.username } : null;
}

export const GET: APIRoute = async ({ request, url, locals }) => {
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');
  if (!targetType || !targetId) {
    return json({ error: 'targetType and targetId are required' }, 400);
  }

  const db = getDB(locals);
  if (!db) return json({ comments: [] });

  try {
    const result = await db.prepare(
      'SELECT id, user_id, username, content, created_at FROM comments WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(targetType, targetId).all<{ id: string; user_id: string; username: string; content: string; created_at: string }>();

    const comments = (result.results ?? []).map((r) => ({
      id: r.id,
      author: r.username,
      content: r.content,
      createdAt: r.created_at,
    }));

    return json({ comments });
  } catch {
    return json({ comments: [] });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request, locals);
  if (!session) return json({ error: '请先登录' }, 401);

  let body: CreateCommentBody;
  try {
    body = (await request.json()) as CreateCommentBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.content?.trim() || !body.targetType || !body.targetId) {
    return json({ error: 'content, targetType, targetId are required' }, 400);
  }

  const db = getDB(locals);

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db!.prepare(
      'INSERT INTO comments (id, user_id, username, target_type, target_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, session.sub, session.username ?? '', body.targetType, body.targetId, body.content.trim(), now).run();

    return json({
      ok: true,
      comment: {
        id,
        author: session.username ?? session.sub,
        content: body.content.trim(),
        createdAt: now,
      },
    }, 201);
  } catch (err: unknown) {
    return json({ error: '评论失败，请重试', detail: String(err) }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
