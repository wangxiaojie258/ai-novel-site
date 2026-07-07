/**
 * Cloudflare Pages Function: /api/reward
 *
 * POST /api/reward
 *   body: { bookId, amount, kind: 'small'|'medium'|'large'|'custom', message? }
 *   - requires a valid session JWT
 *   - delegates to the configured reward provider (stub by default)
 */
import type { APIRoute } from 'astro';
import { extractBearer, verifySession } from '../../src/lib/auth';
import { createReward, DEFAULT_AMOUNT_CENTS, type RewardAmount, validateAmount } from '../../src/lib/reward';
import { getDB } from '../../src/lib/db';

export const prerender = false;

interface RewardBody {
  bookId: string;
  kind: RewardAmount;
  amount?: number;          // cents; required when kind === 'custom'
  message?: string;
  provider?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
  const token = extractBearer(request);
  const session = token ? await verifySession(token, env) : null;
  if (!session) return json({ error: 'authentication required' }, 401);

  let body: RewardBody;
  try {
    body = (await request.json()) as RewardBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  if (!body.bookId) return json({ error: 'bookId is required' }, 400);
  if (!body.kind) return json({ error: 'kind is required' }, 400);

  const amountCents = body.kind === 'custom' ? Number(body.amount ?? 0) : DEFAULT_AMOUNT_CENTS[body.kind];
  const v = validateAmount(amountCents);
  if (!v.ok) return json({ error: v.reason }, 400);

  const db = getDB(env);
  if (!db) {
    // Skeleton: no DB bound, return a stub result so the front-end can be tested.
    return json(
      {
        ok: true,
        stub: true,
        reward: {
          id: crypto.randomUUID(),
          status: 'succeeded',
          amountCents,
          provider: body.provider ?? 'stub',
        },
      },
      201,
    );
  }

  const result = await createReward(db, {
    bookId: body.bookId,
    userId: session.sub,
    amountCents,
    message: body.message,
    provider: body.provider,
  });

  return json({ ok: true, reward: result }, 201);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
