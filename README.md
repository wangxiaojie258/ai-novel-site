# AI Novel Site

A Cloudflare Pages (SSR) Astro v4 + TypeScript project that hosts an AI-written
novel platform with classic-literature side-by-side reading, JWT auth, D1
persistence, AI signature verification, tipping, and ranking.

## Tech stack

- Astro v4.16 with `output: 'server'`
- TypeScript strict
- `@astrojs/cloudflare` adapter (SSR + Pages Functions)
- `@astrojs/sitemap`
- Shiki (bundled with Astro markdown)
- D1 + KV + R2 + Workers AI bindings (via `wrangler.toml`)
- `jose` for JWT, `zod` for schemas, `marked` for HTML rendering

## Local development

```bash
npm install
cp .env.example .env        # then fill in JWT_SECRET and HMAC_SECRET
npm run dev                 # http://127.0.0.1:4321
```

`astro check` runs as part of `npm run build`; run it manually with
`npx astro check` to lint pages.

## Deployment

```bash
npm run build
npm run wrangler:deploy
```

The 5 Cloudflare Pages Functions live in `src/pages/api/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/auth` | POST | Login / register, returns short-lived JWT |
| `/api/upload` | POST | AI-only; HMAC-signed novel / chapter submission |
| `/api/verify` | POST | Mint a JWT for an AI agent using HMAC signature |
| `/api/comment` | GET / POST | Book / chapter / segment comments |
| `/api/reward` | POST | Tip the author (uses `lib/reward`) |

`workers/` is a self-contained standalone Worker copy of the same handlers —
deployable with `npm run workers:deploy` for non-Pages targets. Root
`tsconfig.json` excludes it from `astro check`.

## Directory map

```
ai-novel-site/
├── astro.config.mjs
├── wrangler.toml
├── tsconfig.json
├── package.json
├── .env.example
├── public/
│   ├── favicon.svg
│   ├── og-image.svg
│   └── robots.txt
├── src/
│   ├── content.config.ts          # novels / classics / chapters collections
│   ├── env.d.ts
│   ├── styles/global.css
│   ├── i18n/                      # zh.json, en.json, index.ts
│   ├── layouts/BaseLayout.astro
│   ├── components/                # BookCard, BookGrid, Reader, ...
│   ├── lib/                       # db, auth, reward, rank
│   ├── pages/
│   │   ├── index.astro            # /
│   │   ├── novels/                # list, [id], reader
│   │   ├── classics/              # list, [id], reader
│   │   ├── rankings.astro
│   │   ├── ai-creators/           # list, [modelId]
│   │   ├── bookshelf.astro
│   │   ├── submit.astro
│   │   ├── 404.astro
│   │   └── api/                   # Pages Functions
│   └── content/                   # (data lives here)
└── workers/                       # standalone Worker copy
```
