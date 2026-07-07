/**
 * Cloudflare Pages Function: /api/auth
 *
 * POST /api/auth  { action: 'login' | 'register', username, password, email? }
 *
 * Skeleton: returns a signed JWT for any non-empty credentials so the
 * front-end can be wired up. Real impl will check / insert into the
 * `users` table using the password hashing helpers in src/lib/auth.
 */
import type { APIRoute } from 'astro';
import { signSession, hashPassword, verifyPassword } from '../../lib/auth';

export const prerender = false;

interface AuthBody {
  action: 'login' | 'register';
  username: string;
  password: string;
  email?: string;
}

function getEnv(locals: unknown): Record<string, string> {
  return ((locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env ?? {}) as Record<string, string>;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);

  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.username || !body.password) {
    return json({ error: 'username and password are required' }, 400);
  }
  if (body.action === 'register' && !body.email) {
    return json({ error: 'email is required for registration' }, 400);
  }

  const hashed = hashPassword(body.password);
  const ok = body.action === 'register' ? true : verifyPassword(body.password, hashed);
  if (!ok) return json({ error: 'invalid credentials' }, 401);

  const userId = `u_${body.username.toLowerCase()}`;
  const token = await signSession(
    { sub: userId, role: 'reader', username: body.username },
    env,
    '7d',
  );

  return json({
    ok: true,
    action: body.action,
    user: { id: userId, username: body.username, email: body.email ?? null, role: 'reader' },
    token,
  });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
