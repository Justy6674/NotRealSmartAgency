# Technology Stack

**Analysis Date:** 2026-07-30

## Languages

**Primary:**
- TypeScript 5.x (`typescript: ^5`) — all application code under `src/`. `strict: true`, `noEmit`, `moduleResolution: bundler` (`tsconfig.json`)
- TSX/JSX (React 19) — `src/app/`, `src/components/`

**Secondary:**
- JavaScript (ESM `.mjs`) — operational scripts only: `scripts/verify-media-state.mjs`, `scripts/read-upload-trace.mjs`, `scripts/inspect-schema.mjs`, config files `postcss.config.mjs`, `eslint.config.mjs`
- SQL — Supabase migrations, `supabase/migrations/` (41 files, `022_*` … `042_remove_heygen_video_provider.sql`)

## Runtime

**Environment:**
- Node.js — local dev observed on v22.23.1. No `.nvmrc` / `.node-version` / `engines` field pins a version, so Vercel's project-level Node setting is the only constraint.
- Next.js App Router. Route runtimes are explicit where they matter: 12 routes declare `export const runtime = 'nodejs'`, exactly 1 declares `'edge'`.
- Long-running serverless functions rely on Vercel Fluid Compute: `maxDuration = 300` (`src/app/api/chat/route.ts:1`, `src/app/api/webhooks/telegram/route.ts:23`), `maxDuration = 600` (`src/app/api/mcp/route.ts:1`).

**Package Manager:**
- npm (observed 10.9.8)
- Lockfile: `package-lock.json` present (~503 KB), committed
- `.npmrc` sets `legacy-peer-deps=true` — peer-dependency conflicts are being suppressed rather than resolved

## Frameworks

**Core:**
- `next` **15.5.21** (exact pin) — App Router, flat routes, no route groups
- `react` / `react-dom` ^19.2.0
- `tailwindcss` ^4 with `@tailwindcss/postcss` (`postcss.config.mjs`) — Tailwind v4, CSS-first config
- `@base-ui/react` ^1.3.0 — shadcn/ui v4 sits on base-ui, so composition uses the `render` prop, not `asChild`
- `zustand` ^5.0.11 — single client store, `src/stores/agency-store.ts`

**AI:**
- `ai` ^6.0.235 (Vercel AI SDK v6) — `streamText`, `stepCountIs`, `convertToModelMessages`, `embed`, `experimental_generateImage`
- `@ai-sdk/gateway` ^3.0.157 — every model call routes through the Vercel AI Gateway (`gateway(modelId)`), never a direct provider client
- `@ai-sdk/anthropic` ^3.0.58, `@ai-sdk/openai` ^3.0.50 — installed; `@ai-sdk/openai` is used directly only for embeddings (`src/lib/memory/embeddings.ts:2`)
- `@ai-sdk/react` ^3.0.136 — chat UI transport
- `zod` **^4.3.6** — schema layer for tool definitions

**Testing:**
- Node's built-in test runner via `tsx`: `npm test` → `tsx --test $(find src -name '*.test.ts' -print)`
- 52 `*.test.ts` files, co-located with source (e.g. `src/lib/auth/api-key.test.ts`, `src/lib/mcp/director-only-tools.test.ts`, `src/lib/agents/heygen-removal.test.ts`)
- No Jest/Vitest, no coverage tooling, no CI config in-repo

**Build/Dev:**
- `npm run dev` — `next dev --turbopack`
- `npm run build` — `next build` (Webpack; Turbopack is dev-only)
- `npm run lint` — `eslint` (flat config, `eslint.config.mjs`)
- `eslint` ^9 + `eslint-config-next` **15.3.3** (lags the `next` 15.5.21 runtime)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.99.1 + `@supabase/ssr` ^0.9.0 — database, auth, storage, RLS. Three distinct clients (`src/lib/supabase/{client,server,admin}.ts`) plus `middleware.ts`
- `@modelcontextprotocol/sdk` **1.29.0** — powers `/api/mcp` (`src/lib/mcp/server.ts:1`, `src/app/api/mcp/route.ts:3`). **Not declared in `package.json`.** It resolves only as a transitive dependency of the devDependency `shadcn` (`package-lock.json:12231`). A `--omit=dev` install or a `shadcn` bump that drops the dep would break the production MCP server.
- `stripe` ^20.4.1 (server) + `@stripe/stripe-js` ^8.9.0 (browser)
- `resend` ^6.9.4 — all transactional email

**Media/Video:**
- `ffmpeg-static` ^5.3.0 + `fluent-ffmpeg` ^2.1.3 + `@types/fluent-ffmpeg` — thumbnail extraction (`src/lib/video/ffmpeg-thumbnail.ts`)
- `playwright-core` ^1.62.0 + `@sparticuz/chromium` ^149.0.0 — headless rendered-website audit, used only by `src/lib/agents/tools/rendered-website-scan.ts`. Its Brotli browser pack is traced into 6 specific routes via `outputFileTracingIncludes` in `next.config.ts`
- `react-filerobot-image-editor` ^5.0.0-beta.156 — in-browser image editor (beta pin)

**UI:**
- `@tiptap/*` ^3.22.x (9 packages) — rich text composer
- `@fullcalendar/*` ^6.1.20 (5 packages) — content calendar
- `@dnd-kit/*` — drag-and-drop (grid planner, sortable media)
- `chart.js` ^4.5.1 + `react-chartjs-2` + `chartjs-plugin-zoom` — analytics charts
- `gsap` ^3.14.2 + `@gsap/react`, `motion` ^12.38.0 — landing/about animation
- `three` ^0.183.2 + `@react-three/{fiber,drei,postprocessing}` — **legacy, landing/about heroes only**. `transpilePackages: ['three']` in `next.config.ts`. Repo convention forbids Three.js in new features
- `lucide-react`, `@fontsource/ibm-plex-{sans,mono}`, `emoji-mart`, `react-markdown`, `next-themes`, `html-to-image`, `clsx` + `tailwind-merge` + `class-variance-authority`

## Configuration

**Environment:**
- All secrets in `.env.local` (present, not committed). `.env.local.example` documents the shape. A separate `.env.github-app` holds GitHub App credentials.
- ~55 distinct `process.env.*` keys referenced across `src/` and `scripts/`. Highest-traffic: `NEXT_PUBLIC_APP_URL` (27 refs), `MIXPOST_API_URL` / `MIXPOST_API_TOKEN` / `MIXPOST_WORKSPACE_UUID` (~23 each), `NEXT_PUBLIC_SUPABASE_URL` (20), `SUPABASE_SERVICE_ROLE_KEY` (13)
- **There is no `ANTHROPIC_API_KEY` or `AI_GATEWAY_API_KEY` reference anywhere in `src/`** — the Gateway credential is injected by Vercel and consumed implicitly by `@ai-sdk/gateway`
- Hybrid credential pattern: several providers read `user_integrations.cached_data` first, then fall back to a platform env var (see `src/lib/canva/client.ts:23`, `src/lib/blotato/client.ts:181`)
- Config helpers return `null` rather than throwing when unconfigured — `getGitHubAppConfig()` (`src/lib/github/github-app.ts:17`), `getNRSTelegramConfig()` (`src/lib/telegram/nrs-telegram-config.ts:16`), `getPicoSearchConfig()` (`src/lib/pico/client.ts:31`). Features degrade silently instead of failing the boot.

**Build:**
- `next.config.ts` — `outputFileTracingRoot: process.cwd()` (avoids inheriting a parent workspace lockfile on Vercel), per-route `outputFileTracingIncludes` for the Chromium pack, three remote image patterns (`uyhtrwlotoriblicqqrl.supabase.co`, `www.google.com` favicons, `**.com.au`), rewrites for `/favicon.ico` and both `/.well-known/oauth-*` documents, and global security headers (X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, HSTS 1 year)
- `tsconfig.json` — path alias `@/*` → `./src/*`, target ES2017
- `eslint.config.mjs` — flat config extending `next/core-web-vitals` via `FlatCompat`. **Imports `@eslint/eslintrc` and `@typescript-eslint/eslint-plugin`, neither of which is in `package.json`** — lint works only because they arrive transitively through `eslint-config-next`
- `supabase/config.toml` — `project_id = "NotRealSmartAgency"`

## Platform Requirements

**Development:**
- Node 22.x, npm 10.x
- Populated `.env.local` (Supabase URL/anon/service-role at minimum; everything else degrades)
- Verification is manual: `npm run dev`, exercise the feature, inspect the Supabase row. `npm run build` and `npm run lint` must pass clean, and `npm test` runs the 52 unit tests.

**Production:**
- Vercel, Fluid Compute enabled (routes declare up to `maxDuration = 600`)
- Vercel Cron, declared in `vercel.json`:
  - `/api/heartbeat` — `*/15 * * * *`
  - `/api/cron/publish-posts` — `*/5 * * * *`
  - `/api/cron/daily-intel` — `0 20 * * *`
  - Note: `src/app/api/cron/` also contains `consolidate-memories`, `monitor-alerts`, and `performance-learn` routes that are **not** registered in `vercel.json` — they are only reachable by manual invocation with `CRON_SECRET`
- Supabase project `uyhtrwlotoriblicqqrl` (Postgres + Auth + Storage `media` bucket + pgvector for memory v2, `supabase/migrations/024_memory_v2.sql`)
- A self-hosted Mixpost Pro instance on a BinaryLane VPS (`https://mixpost.notrealsmart.com.au`)

## Notable Constraints

- **Australian English** throughout code and copy (`analyse_voice`, `organisation`, `colour`)
- **oklch colours only**, silver/chrome palette; IBM Plex Sans/Mono
- `force-dynamic` required on pages using base-ui components
- Budget/cost stored as integer cents; USD estimation lives in `estimateGatewayCost()` (`src/lib/ai/model-routing.ts:150`)
- `streamText` is the supported chat path; `ToolLoopAgent` is documented as broken and is not used

## Where the Docs and Code Disagree

`CLAUDE.md` is broadly accurate on architecture but stale on several stack facts:

| `CLAUDE.md` says | Code says | Evidence |
|---|---|---|
| "Next.js 15.3 (NOT 16)" | `next` is pinned to **15.5.21** | `package.json:60` |
| "Zod v3 import path (`zod/v3`) for AI SDK tool schemas" | `zod` **^4.3.6** is the installed major | `package.json:73` |
| "No test runner configured. Verification is manual." | `npm test` exists (`tsx --test`) and 52 test files ship | `package.json:10` |
| "No project-level `eslint.config.*` — uses Next.js defaults" | `eslint.config.mjs` exists with a custom flat config | `eslint.config.mjs` |
| "Default model: `anthropic/claude-sonnet-4`" | Default is `anthropic/claude-sonnet-5`; four tiers (`fast`/`agency`/`frontier`/`code`) with fallback chains | `src/lib/ai/model-routing.ts:30-42` |
| "Cost calculation: `(inputTokens * 0.3 + outputTokens * 1.5) / 100`" | Real per-model USD pricing table with cache-read/cache-write rates, rounded up to whole cents | `src/lib/ai/model-routing.ts:55-63,150` |
| `transpilePackages: ['three']` is the only notable next config | Also `outputFileTracingRoot`, per-route `outputFileTracingIncludes` for Chromium, and `/.well-known/*` rewrites | `next.config.ts` |
| Lists `create_video`, `multi_scene_video`, `translate_video`, `photo_avatar`, `text_to_speech`, `talking_photo`, `video_agent` as agent tools | None of these tools exist. The video provider was deliberately removed (migration `042_remove_heygen_video_provider.sql`) and a guard test asserts zero source references | `src/lib/agents/tools/`, `src/lib/agents/heygen-removal.test.ts` |
| `HIDDEN_FROM_MCP` denylist in `src/lib/mcp/server.ts` | Inverted to an **allowlist**, `DIRECT_MCP_TOOLS`, in `src/lib/mcp/director-only-tools.ts` | `src/lib/mcp/director-only-tools.ts:10` |

---

*Stack analysis: 2026-07-30*
