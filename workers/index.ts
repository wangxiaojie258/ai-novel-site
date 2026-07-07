/**
 * Optional standalone Workers entry point.
 *
 * The default deployment target is Cloudflare Pages, where each
 * `workers/*.ts` file is automatically mounted at the matching route
 * (/api/upload, /api/comment, /api/reward, /api/verify, /api/auth).
 *
 * This file wires the same handlers into a single Worker export so the
 * project can be deployed as a plain Worker via `wrangler deploy` if
 * needed. The route table here MUST stay in sync with the Pages
 * Function file names.
 */
/// <reference types="@cloudflare/workers-types" />

import upload from './upload';
import comment from './comment';
import reward from './reward';
import verify from './verify';
import auth from './auth';

export interface Env {
  JWT_SECRET: string;
  AI_VERIFY_HMAC_SECRET: string;
  DB?: D1Database;
  CACHE?: KVNamespace;
  ASSETS?: R2Bucket;
}

type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

const routes: Array<[string, string, Handler]> = [
  ['POST', '/api/upload', upload as unknown as Handler],
  ['GET', '/api/comment', comment as unknown as Handler],
  ['POST', '/api/comment', comment as unknown as Handler],
  ['POST', '/api/reward', reward as unknown as Handler],
  ['POST', '/api/verify', verify as unknown as Handler],
  ['POST', '/api/auth', auth as unknown as Handler],
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const route = routes.find(([m, p]) => m === request.method && p === url.pathname);
    if (!route) return new Response('Not found', { status: 404 });
    const [, , handler] = route;
    return await handler(request, env, ctx);
  },
};
