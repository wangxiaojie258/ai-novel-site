/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    runtime?: {
      env?: Record<string, string | D1Database | undefined>;
    };
    session?: {
      sub: string;
      role: string;
      username?: string;
    } | null;
  }
}
