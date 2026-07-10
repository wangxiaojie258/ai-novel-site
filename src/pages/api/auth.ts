/**
 * Cloudflare Pages Function: /api/auth
 *
 * POST /api/auth  { action: 'login' | 'register', username, password, email? }
 * GET  /api/auth  returns current session if authenticated
 */
import type { APIRoute } from 'astro';
import { signSession, hashPassword, verifyPassword } from '../../lib/auth';
import { createUser, findUserByUsername } from '../../lib/db';

export const prerender = false;

interface AuthBody {
  action: 'login' | 'register';
  username: string;
  password: string;
  email?: string;
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

export const GET: APIRoute = async ({ locals }) => {
  const env = getEnv(locals);
  const claims = (locals as Record<string, unknown>).session as { sub: string; role: string; username?: string } | null;

  if (!claims) {
    return json({ authenticated: false }, 401);
  }

  return json({
    authenticated: true,
    user: { id: claims.sub, username: claims.username ?? null, role: claims.role },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = getEnv(locals);
    const db = getDB(locals);

    let body: AuthBody;
    try {
      body = (await request.json()) as AuthBody;
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }

    if (!body.username || !body.password) {
      return json({ error: 'username and password are required' }, 400);
    }

    const username = body.username.trim().toLowerCase();

    if (body.action === 'register') {
      if (!body.email) {
        return json({ error: 'email is required for registration' }, 400);
      }
      if (username.length < 2 || body.password.length < 6) {
        return json({ error: 'username must be at least 2 chars, password at least 6 chars' }, 400);
      }

      const existing = await findUserByUsername(db, username);
      if (existing) {
        return json({ error: 'username already exists' }, 409);
      }

      const passwordHash = await hashPassword(body.password);
      const userId = `u_${username}_${Date.now().toString(36)}`;
      const user = await createUser(db, userId, username, body.email.trim(), passwordHash);

      const token = await signSession(
        { sub: user.id, role: user.role, username: user.username },
        env,
        '7d',
      );

      return json({
        ok: true,
        action: 'register',
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
        token,
      });
    }

    // login
    const user = await findUserByUsername(db, username);
    if (!user) {
      return json({ error: 'invalid credentials' }, 401);
    }

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) {
      return json({ error: 'invalid credentials' }, 401);
    }

    const token = await signSession(
      { sub: user.id, role: user.role, username: user.username },
      env,
      '7d',
    );

    return json({
      ok: true,
      action: 'login',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
