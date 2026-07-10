/**
 * Reading Progress API: /api/progress
 *
 * GET  — get reading progress for a novel
 * POST — save reading progress { novelId, chapterId, chapterNumber, chapterTitle, position }
 */
import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/auth';
import { extractBearer } from '../../lib/auth';
import { saveProgress, getProgress } from '../../lib/db';

export const prerender = false;

interface ProgressBody {
  novelId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  position: number;
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

  const url = new URL(request.url);
  const novelId = url.searchParams.get('novelId');
  if (!novelId) {
    return json({ error: 'novelId is required' }, 400);
  }

  const db = getDB(locals);
  const progress = await getProgress(db, session.sub, novelId);
  return json({ progress });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const session = await getSession(request, locals);
  if (!session) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: ProgressBody;
  try {
    body = (await request.json()) as ProgressBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.novelId || !body.chapterId) {
    return json({ error: 'novelId and chapterId are required' }, 400);
  }

  const db = getDB(locals);
  await saveProgress(
    db,
    session.sub,
    body.novelId,
    body.chapterId,
    body.chapterNumber ?? 0,
    body.chapterTitle ?? '',
    body.position ?? 0,
  );

  return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
