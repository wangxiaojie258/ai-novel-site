/**
 * Rank — leaderboard calculation.
 *
 * Boards supported: daily / weekly / monthly / all-time.
 * Metrics: read count, reward cents, comment count, bookmark count.
 *
 * Skeleton implementation: emits empty boards with the right shape,
 * plus query helpers to wire up to D1 once the schema is migrated.
 */
import type { D1 } from './db';

export type RankWindow = 'day' | 'week' | 'month' | 'all';
export type RankMetric = 'reads' | 'rewards' | 'comments' | 'bookmarks';

export interface RankEntry {
  bookId: string;
  title: string;
  author: string;
  score: number;
  rank: number;
}

export interface RankBoard {
  window: RankWindow;
  metric: RankMetric;
  generatedAt: string;
  entries: RankEntry[];
}

const WINDOW_SECONDS: Record<RankWindow, number> = {
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  all: Number.MAX_SAFE_INTEGER,
};

export function windowStart(window: RankWindow, now: number = Date.now()): number {
  return Math.floor((now - WINDOW_SECONDS[window] * 1000) / 1000);
}

export function emptyBoard(window: RankWindow, metric: RankMetric): RankBoard {
  return {
    window,
    metric,
    generatedAt: new Date().toISOString(),
    entries: [],
  };
}

/**
 * Fetch a rank board. The current implementation returns an empty board;
 * once events are being written into D1 (reads / rewards / comments /
 * bookmarks), the corresponding `SELECT` below can be enabled.
 */
export async function getBoard(
  db: D1 | null,
  window: RankWindow,
  metric: RankMetric,
  limit = 20,
): Promise<RankBoard> {
  if (!db) return emptyBoard(window, metric);

  const since = windowStart(window);
  const sql = (() => {
    switch (metric) {
      case 'reads':
        return `SELECT b.id AS book_id, b.title, b.author, COUNT(*) AS score
                FROM book_reads r JOIN books b ON b.id = r.book_id
                WHERE r.created_at >= ${since}
                GROUP BY b.id ORDER BY score DESC LIMIT ${limit}`;
      case 'rewards':
        return `SELECT b.id AS book_id, b.title, b.author, COALESCE(SUM(rw.amount_cents), 0) AS score
                FROM rewards rw JOIN books b ON b.id = rw.book_id
                WHERE rw.created_at >= ${since}
                GROUP BY b.id ORDER BY score DESC LIMIT ${limit}`;
      case 'comments':
        return `SELECT b.id AS book_id, b.title, b.author, COUNT(*) AS score
                FROM comments c JOIN books b ON b.id = c.target_id
                WHERE c.target_type = 'book' AND c.created_at >= ${since}
                GROUP BY b.id ORDER BY score DESC LIMIT ${limit}`;
      case 'bookmarks':
        return `SELECT b.id AS book_id, b.title, b.author, COUNT(*) AS score
                FROM bookshelf bs JOIN books b ON b.id = bs.book_id
                WHERE bs.updated_at >= ${since}
                GROUP BY b.id ORDER BY score DESC LIMIT ${limit}`;
    }
  })();

  try {
    const rows = await db
      .prepare(sql)
      .all<{ book_id: string; title: string; author: string; score: number }>();
    const entries: RankEntry[] = (rows.results ?? []).map((r, i) => ({
      bookId: r.book_id,
      title: r.title,
      author: r.author,
      score: r.score,
      rank: i + 1,
    }));
    return { window, metric, generatedAt: new Date().toISOString(), entries };
  } catch {
    // Tables not yet created — return empty board.
    return emptyBoard(window, metric);
  }
}
