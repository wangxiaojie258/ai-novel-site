import type { APIRoute } from 'astro';
import { findUserByUsername, createUser } from '../../lib/db';

export const prerender = false;

function getDB(locals: App.Locals) {
  return (locals as Record<string, unknown>).runtime &&
    ((locals as Record<string, unknown>).runtime as Record<string, unknown>).env
    ? (((locals as Record<string, unknown>).runtime as Record<string, unknown>).env as Record<string, unknown>).DB
    : undefined;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Test: list tables
export const GET: APIRoute = async ({ locals }) => {
  const dbRaw = getDB(locals);
  const db = dbRaw as D1Database | undefined;

  const results: Record<string, unknown> = { step: 'start', dbAvailable: !!db };

  try {
    // Step 1: check tables
    results.step = 'list_tables';
    const tables = await db!.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    results.tables = tables.results;

    // Step 2: try findUserByUsername
    results.step = 'find_user';
    const user = await findUserByUsername(db, 'nonexistent');
    results.userFound = !!user;

    // Step 3: try crypto
    results.step = 'crypto_test';
    const testArr = crypto.getRandomValues(new Uint8Array(4));
    results.cryptoOk = testArr.length === 4;

    results.step = 'all_ok';
  } catch (err: unknown) {
    results.error = err instanceof Error ? err.message : String(err);
    results.errorStack = err instanceof Error ? err.stack : undefined;
  }

  return json(results);
};
