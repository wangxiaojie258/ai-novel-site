import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/auth';

export const prerender = false;

function getEnv(locals: App.Locals): Record<string, string> {
  return (((locals as Record<string, unknown>)?.runtime as Record<string, unknown>)?.env ?? {}) as Record<string, string>;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return json({ step: 'no_cookie' });
  }

  const env = getEnv(locals);
  try {
    const claims = await verifySession(token, env);
    return json({ step: 'verified', claims: claims ? { sub: claims.sub, username: claims.username } : null });
  } catch (err: unknown) {
    return json({ step: 'verify_error', error: String(err) });
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
