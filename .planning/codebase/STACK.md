# Technology Stack

**Analysis Date:** 2026-07-28

## Languages

**Primary:**
- TypeScript 5.x (`strict: true`) — all of `src/`, `scripts/*.ts`. Config: `tsconfig.json` (target ES2017, `moduleResolution: bundler`, path alias `@/* → ./src/*`).
- TSX / React 19 — 266 components under `src/components/`.

**Secondary:**
- SQL (PostgreSQL) — 42 migrations in `supabase/migrations/001_initial_schema.sql` … `042_remove_heygen_video_provider.sql`.
- JavaScript (`.mjs`) — operational scripts only: `scripts/verify-media-state.mjs`, `scripts/read-upload-trace.mjs`, `scripts/inspect-schema.mjs`, `postcss.config.mjs`, `eslint.config.mjs`.

## Runtime

**Environment:**
- Node.js (`@types/node` ^20) on Vercel serverless / Fluid Compute. Long-running routes declare `export const maxDuration = 300` (see `src/app/api/chat/route.ts:1`).
- Next.js App Router, Edge-adjacent middleware at `src/middleware.ts`.

**Package Manager:**
- npm. Lockfile: `package-lock.json` — present.
- `.npmrc` present at repo root.

## Frameworks

**Core:**
- `next` 15.5.21 — App Router, flat routes (no route groups). Config: `next.config.ts`.
- `react` / `react-dom` ^19.2.0.
- `tailwindcss` ^4 with `@tailwindcss/postcss` — config lives in `postcss.config.mjs` + CSS-first Tailwind 4 (no `tailwind.config`).
- `@base-ui/react` ^1.3.0 — shadcn/ui v4 primitives in `src/components/ui/` (14 primitives: `button.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`, …). Compose with the `render` prop, not `asChild`.

**AI:**
- `ai` ^6.0.235 (Vercel AI SDK v6) — `streamText` in `src/app/api/chat/route.ts`, `generateText` in `src/lib/agents/worker.ts`.
- `@ai-sdk/gateway` ^3.0.157 — every model call goes through `gateway(...)`; also supplies `gateway.tools.perplexitySearch` for web search.
- `@ai-sdk/anthropic` ^3.0.58, `@ai-sdk/openai` ^3.0.50 — direct providers available but gateway is the default path.
- `@ai-sdk/react` ^3.0.136 — chat streaming hooks in `src/components/agency/ChatInterface.tsx`.
- `@modelcontextprotocol/sdk` — `McpServer` in `src/lib/mcp/server.ts` (transitive; not a direct `package.json` entry).

**Testing:**
- Node's built-in test runner via `tsx`: `npm test` → `tsx --test $(find src -name '*.test.ts' -print)`. 47 `*.test.ts` files, co-located beside implementation (e.g. `src/lib/ai/model-routing.test.ts`, `src/lib/agents/goal-loop.test.ts`).

**Build/Dev:**
- `next dev --turbopack` for dev; `next build` (Webpack) for production — Turbopack is not used for the Vercel build.
- `eslint` ^9 with `eslint-config-next` 15.3.3, flat config at `eslint.config.mjs`.
- `tsx` ^4.23.1 — runs TypeScript scripts and tests.
- `shadcn` ^4.14.1 CLI for UI primitive generation.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.99.1 + `@supabase/ssr` ^0.9.0 — database, auth, storage, RLS. Three clients in `src/lib/supabase/`.
- `zod` ^4.3.6 — request validation. **Import `zod/v3` for AI SDK tool schemas** (see `src/app/api/chat/route.ts:3`); plain `zod` elsewhere.
- `zustand` ^5.0.11 — single client store `src/stores/agency-store.ts`, persisted to localStorage key `nrs-agency`.
- `stripe` ^20.4.1 + `@stripe/stripe-js` ^8.9.0 — billing, `src/lib/stripe/`.
- `resend` ^6.9.4 — transactional email, `src/lib/email/` and `src/lib/emails/`.

**Media / video:**
- `ffmpeg-static` ^5.3.0 + `fluent-ffmpeg` ^2.1.3 — thumbnails, transcode. `src/lib/video/`.
- `@sparticuz/chromium` ^149 + `playwright-core` ^1.62 — headless rendered-website audits. Bundled per-route via `outputFileTracingIncludes` in `next.config.ts`.
- `react-filerobot-image-editor` ^5.0.0-beta — in-browser image editing, `src/components/agency/studio/editor/`.

**UI / visual:**
- `@fullcalendar/*` ^6.1.20 — content calendar.
- `@dnd-kit/core|sortable|utilities` — drag/drop grid + sortable media.
- `@tiptap/*` ^3.22 — rich-text composer (mention, link, image, character-count).
- `chart.js` ^4.5.1 + `react-chartjs-2` + `chartjs-plugin-zoom` — analytics charts.
- `gsap` ^3.14 + `@gsap/react`, `motion` ^12.38 — landing/about animation.
- `three` ^0.183 + `@react-three/fiber|drei|postprocessing` — **landing + about heroes only**. `transpilePackages: ['three']` in `next.config.ts`. Do not use for new features.
- `lucide-react`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `next-themes`, `emoji-mart`, `react-markdown`, `html-to-image`, `clsx` + `tailwind-merge` + `class-variance-authority`.

## Configuration

**Environment:**
- All secrets in `.env.local` (git-ignored). Template: `.env.local.example`. Never commit.
- Variable names in use (values never read here): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WEB_URL`, `MIXPOST_WEBHOOK_SECRET`, `MIXPOST_WORKSPACE_UUID`, `NEXT_PUBLIC_MIXPOST_WEB_URL`, `NEXT_PUBLIC_MIXPOST_WORKSPACE_UUID`, `NEXT_PUBLIC_MIXPOST_DISABLED`, `AYRSHARE_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_OAUTH_REDIRECT_URI`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `TWITTER_OAUTH_REDIRECT_URI`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI`, `CANVA_API_KEY`, `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `GMAIL_ACCESS_TOKEN`, `GIPHY_API_KEY`, `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `BITLY_ACCESS_TOKEN`, `MODAL_QWEN3_TTS_ENDPOINT_URL`, `MODAL_FLUX2_ENDPOINT_URL`, `MODAL_ACE_STEP_ENDPOINT_URL`, `SCENT_SELL_MARKETING_CONNECTOR_URL`, `SCENT_SELL_MARKETING_CONNECTOR_TOKEN`, `SCENTSELL_ANON_KEY`, `USE_NATIVE_PUBLISHER_<PLATFORM>`, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`.
- Hybrid key pattern: third-party keys are read from the `user_integrations` table first, then fall back to the env var — so power users bring their own keys and everyone else gets platform defaults.
- No `ANTHROPIC_API_KEY` needed: AI Gateway credentials are auto-injected by Vercel.

**Build:**
- `next.config.ts` — `outputFileTracingRoot: process.cwd()` (stops inheriting a parent workspace lockfile on Vercel), per-route `outputFileTracingIncludes` for `@sparticuz/chromium` binaries, `transpilePackages: ['three']`, remote image patterns (`uyhtrwlotoriblicqqrl.supabase.co`, `www.google.com`, `**.com.au`), rewrites for `/favicon.ico` and both `/.well-known/oauth-*` documents, and global security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS).
- `vercel.json` — cron schedule only (see INTEGRATIONS.md).
- `supabase/config.toml` — Supabase CLI project link.

## Scripts

```bash
npm run dev      # next dev --turbopack (port 3000)
npm run build    # next build (Webpack)
npm run start    # next start
npm run lint     # eslint (flat config v9)
npm test         # tsx --test over every src/**/*.test.ts
```

Operational scripts in `scripts/` (run with `npx tsx` or `node`):
- `scripts/run-pipeline.ts` — re-run the media pipeline for one `media_items` row.
- `scripts/backfill-drafts-to-mixpost.ts`, `scripts/backfill-tags-to-mixpost.ts`, `scripts/backfill-media-to-mixpost.ts` — idempotent Mixpost catch-up.
- `scripts/backfill-media-processing.mjs` — system-ffmpeg backfill for legacy media rows.
- `scripts/seed-agent-prompts.ts`, `scripts/seed-brand-memories.ts`, `scripts/seed-knowledge-bank.ts` — seed data.
- `scripts/verify-media-state.mjs`, `scripts/read-upload-trace.mjs`, `scripts/diagnose-upload.mjs`, `scripts/inspect-schema.mjs`, `scripts/inspect-director-config.mjs` — diagnostics.
- `scripts/export-help-to-gitbook.ts` — docs export.

## Platform Requirements

**Development:**
- Node 20+, npm, Supabase CLI linked to project `uyhtrwlotoriblicqqrl`, populated `.env.local`.
- Verification is manual: `npm run dev`, exercise the feature, check the Supabase row. `npm run build` and `npm run lint` must both pass clean before a feature is claimed complete.

**Production:**
- Vercel (Next.js, Fluid Compute for `maxDuration: 300` routes, Vercel Cron, AI Gateway).
- Supabase (Postgres + Auth + Storage) — project ref `uyhtrwlotoriblicqqrl`.
- Mixpost Pro self-hosted on a BinaryLane VPS (`/opt/mixpost/docker-compose.yml`).

---

*Stack analysis: 2026-07-28*
