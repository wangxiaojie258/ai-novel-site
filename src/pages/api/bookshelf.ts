/**
 * Bookshelf API: /api/bookshelf
 *
 * GET  — list user's bookshelf
 * POST — add/remove book { action: 'add'|'remove', novelId, novelTitle, novelAuthor, novelCover }
 */
import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/auth';
import { extractBearer } from '../../lib/auth';
import {
  getBookshelf,
  addToBookshelf,
  removeFromBookshelf,
} from '../../lib/db';

export const prerender = false;

interface BookshelfBody {
  action: 'add' | 'remove';
  novelId: string;
  novelTitle?: string;
  novelAuthor?: string;
  novelCover?: string;
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

async function getSession(request: Request, locals: App.Locals): Promise<{ sub: string } | null> {
  // Try cookie first, then Authorization header
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : extractBearer(request);
  if (!token) return null;

  const env = getEnv(locals);
  const claims = await verifySession(token, env);
  return claims ? { sub: claims.sub } : null;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request, locals);
  if (!session) {
    return json({ error: 'unauthorized' }, 401);
  }

  const db = getDB(locals);
  const books = await getBookshelf(db, session.sub);
  return json({ books });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request, locals);
  if (!session) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: BookshelfBody;
  try {
    body = (await request.json()) as BookshelfBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.novelId || !body.action) {
    return json({ error: 'novelId and action are required' }, 400);
  }

  const db = getDB(locals);

  if (body.action === 'add') {
    await addToBookshelf(
      db,
      session.sub,
      body.novelId,
      body.novelTitle ?? '',
      body.novelAuthor ?? '',
      body.novelCover ?? '',
    );
    return json({ ok: true, action: 'add' });
  }

  if (body.action === 'remove') {
    await removeFromBookshelf(db, session.sub, body.novelId);
    return json({ ok: true, action: 'remove' });
  }

  return json({ error: 'invalid action, use add or remove' }, 400);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
