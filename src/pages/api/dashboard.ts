/**
 * Dashboard API: /api/dashboard
 * Returns aggregated user data for the dashboard page.
 */
import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/auth';

export const prerender = false;

function getDB(locals: App.Locals): D1Database | undefined {
  return (locals as Record<string, unknown>).runtime &&
    ((locals as Record<string, unknown>).runtime as Record<string, unknown>).env
    ? (((locals as Record<string, unknown>).runtime as Record<string, unknown>).env as Record<string, D1Database>).DB
    : undefined;
}

function getEnv(locals: App.Locals): Record<string, string> {
  return (
    ((locals as Record<string, unknown>)?.runtime as Record<string, unknown>)?.env ?? {}
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

export const GET: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request, locals);
  if (!session) return json({ error: 'unauthorized' }, 401);

  const db = getDB(locals);
  if (!db) return json({ error: 'database unavailable' }, 500);

  try {
    // Bookshelf count
    const shelfResult = await db.prepare(
      'SELECT COUNT(*) as cnt FROM bookshelf WHERE user_id = ?'
    ).bind(session.sub).first<{ cnt: number }>();
    const bookshelfCount = shelfResult?.cnt ?? 0;

    // Reading progress - recent books with progress
    const progressResult = await db.prepare(
      'SELECT novel_id, chapter_number, chapter_title, updated_at FROM reading_progress WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10'
    ).bind(session.sub).all<{ novel_id: string; chapter_number: number; chapter_title: string; updated_at: string }>();
    const readingNow = (progressResult.results ?? []).map((r) => ({
      novelId: r.novel_id,
      chapterNumber: r.chapter_number,
      chapterTitle: r.chapter_title,
      updatedAt: r.updated_at,
    }));

    // Recent comments
    const commentResult = await db.prepare(
      'SELECT id, target_type, target_id, content, created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(session.sub).all<{ id: string; target_type: string; target_id: string; content: string; created_at: string }>();
    const recentComments = (commentResult.results ?? []).map((c) => ({
      id: c.id,
      targetType: c.target_type,
      targetId: c.target_id,
      content: c.content,
      createdAt: c.created_at,
    }));

    return json({
      username: session.username ?? session.sub,
      bookshelfCount,
      readingNow,
      recentComments,
    });
  } catch (err: unknown) {
    return json({ error: String(err) }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
