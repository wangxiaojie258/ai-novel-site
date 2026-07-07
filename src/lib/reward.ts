/**
 * Reward — tipping logic.
 *
 * Skeleton implementation that:
 *   - validates amount + message
 *   - creates a record in the `rewards` table
 *   - hands off to a pluggable payment provider
 *
 * Real payment integration (Stripe / WeChat Pay / Cloudflare Workers
 * AI credits) plugs in by swapping the `RewardProvider` implementation.
 */
import { requireDB, type D1 } from './db';

export type RewardAmount = 'small' | 'medium' | 'large' | 'custom';

export interface RewardAmountMap {
  small: number;   // cents
  medium: number;
  large: number;
  custom: number;  // suggested default for custom input
}

export const DEFAULT_AMOUNT_CENTS: RewardAmountMap = {
  small: 600,
  medium: 1800,
  large: 6600,
  custom: 1000,
};

export interface CreateRewardInput {
  bookId: string;
  userId?: string | null;
  amountCents: number;
  message?: string;
  provider?: string;
}

export interface CreateRewardResult {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountCents: number;
  provider: string;
  providerRef?: string;
}

export interface RewardProvider {
  name: string;
  createCharge(input: CreateRewardInput): Promise<{ ref: string; status: 'pending' | 'succeeded' | 'failed' }>;
}

/** Stub provider: marks every charge as succeeded immediately. */
export const stubProvider: RewardProvider = {
  name: 'stub',
  async createCharge(input) {
    return { ref: `stub_${Date.now().toString(36)}`, status: 'succeeded' };
  },
};

export function pickProvider(name: string | undefined): RewardProvider {
  if (name === 'stub' || !name) return stubProvider;
  // Add real providers here (e.g. 'stripe', 'wechat').
  return stubProvider;
}

export function validateAmount(cents: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, reason: 'amount must be > 0' };
  if (cents > 1_000_000) return { ok: false, reason: 'amount too large' };
  if (!Number.isInteger(cents)) return { ok: false, reason: 'amount must be an integer (cents)' };
  return { ok: true };
}

export async function createReward(
  db: D1,
  input: CreateRewardInput,
  provider: RewardProvider = pickProvider(input.provider),
): Promise<CreateRewardResult> {
  const v = validateAmount(input.amountCents);
  if (!v.ok) throw new Error(v.reason);

  const id = crypto.randomUUID();
  const charge = await provider.createCharge(input);

  await db
    .prepare(
      `INSERT INTO rewards (id, book_id, user_id, amount_cents, message, provider, provider_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.bookId,
      input.userId ?? null,
      input.amountCents,
      input.message ?? null,
      provider.name,
      charge.ref,
      Math.floor(Date.now() / 1000),
    )
    .run();

  return {
    id,
    status: charge.status,
    amountCents: input.amountCents,
    provider: provider.name,
    providerRef: charge.ref,
  };
}

/** Aggregated reward totals for a single book. */
export interface BookRewardStats {
  bookId: string;
  totalCents: number;
  count: number;
}

export async function statsForBook(db: D1, bookId: string): Promise<BookRewardStats> {
  // NOTE: `rewards` schema does not yet carry a status column — once the
  // payment provider starts writing it we can filter on status='succeeded'.
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS count
       FROM rewards WHERE book_id = ?`,
    )
    .bind(bookId)
    .first<{ total: number; count: number }>();
  return {
    bookId,
    totalCents: Number(row?.total ?? 0),
    count: Number(row?.count ?? 0),
  };
}

// Re-export the DB helper so consumers only need to import from one place.
export { requireDB };
