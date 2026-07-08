/**
 * Session middleware for Astro Cloudflare Pages.
 *
 * Reads JWT from 'session' cookie and injects claims into Astro.locals.session.
 * Astro Cloudflare adapter supports middleware via src/middleware.ts.
 */
import { defineMiddleware } from 'astro/middleware';
import { verifySession, type SessionClaims } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const cookie = context.cookies.get('session');
  let session: SessionClaims | null = null;

  if (cookie?.value) {
    const env = (context.locals as Record<string, unknown>).runtime
      ? (
          ((context.locals as Record<string, unknown>).runtime as Record<string, unknown>)
            .env as Record<string, string>
        )
      : undefined;
    session = await verifySession(cookie.value, env);
  }

  (context.locals as Record<string, unknown>).session = session;
  return next();
});
