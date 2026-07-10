import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const db = (locals as Record<string, unknown>).runtime
    ? ((locals as Record<string, unknown>).runtime as Record<string, unknown>).env
      ? (((locals as Record<string, unknown>).runtime as Record<string, unknown>).env as Record<string, unknown>).DB
      : null
    : null;

  return new Response(JSON.stringify({
    hasRuntime: !!((locals as Record<string, unknown>).runtime),
    hasEnv: !!(db !== null),
    hasDB: !!(db),
    dbType: db ? typeof db : 'N/A',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
