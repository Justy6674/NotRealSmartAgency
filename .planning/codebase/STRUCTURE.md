# Codebase Structure

**Analysis Date:** 2026-07-28

## Directory Layout

```
NotRealSmartAgency/
├── src/
│   ├── app/                    # Next.js App Router — pages + API routes (flat, no route groups)
│   │   ├── api/                # ~120 route handlers
│   │   ├── agency/             # Authenticated product surface (3 rooms)
│   │   ├── (marketing)/        # Marketing shell
│   │   ├── about|faq|help|pricing|privacy|terms/   # Public content
│   │   ├── login|signup|forgot-password|reset-password|auth/  # Auth
│   │   ├── mcp-login/          # OAuth consent page for MCP clients
│   │   ├── invite/[token]/     # Public team-invite acceptance
│   │   ├── telegram/           # Telegram Mini App surface
│   │   ├── llms.txt/           # llms.txt route
│   │   └── page.tsx            # Landing (WaterRippleHero) — DO NOT TOUCH
│   ├── components/             # 266 .tsx components
│   ├── lib/                    # All business logic + third-party clients
│   ├── hooks/                  # 13 React data hooks
│   ├── stores/                 # Zustand (single store)
│   ├── providers/              # React context providers
│   ├── types/                  # database.ts — single type source
│   └── middleware.ts           # Supabase session refresh
├── supabase/
│   ├── config.toml             # CLI project link
│   └── migrations/             # 001 … 042, forward-only SQL
├── scripts/                    # tsx/node operational + backfill scripts
├── public/                     # Static assets, favicons, MCP icon
├── docs/                       # Project documentation
├── memory/                     # Claude memory artefacts
├── graphify-out/               # Generated knowledge graph (do not hand-edit)
├── .planning/codebase/         # GSD codebase map (this directory)
├── next.config.ts              # Tracing, images, rewrites, security headers
├── vercel.json                 # Cron schedules only
├── eslint.config.mjs           # ESLint v9 flat config
├── postcss.config.mjs          # Tailwind 4
├── tsconfig.json               # strict, @/* → ./src/*
├── CLAUDE.md / AGENTS.md       # Agent operating instructions
└── package.json
```

## Directory Purposes

**`src/app/api/`:**
- Purpose: every HTTP entry point.
- Contains: `route.ts` files only, grouped by domain.
- Key groups: `chat/` (Director), `mcp/` + `mcp/{authorize,token,register,code}/` (MCP + OAuth), `well-known/` (RFC discovery docs), `cron/{publish-posts,daily-intel,consolidate-memories,monitor-alerts,performance-learn}/`, `heartbeat/`, `webhooks/{mixpost,telegram}/`, `oauth/{meta,linkedin,tiktok,twitter,youtube}/{initiate,callback}/`, `media/`, `mixpost/`, `studio/`, `stripe/`, `team/`, `telegram/`, `video-toolkit/`, `debug/upload-log/`.

**`src/app/agency/`:**
- Purpose: the authenticated product, organised into three rooms (see `src/lib/room-config.ts`).
- Director's Office: `chat/page.tsx`, `chat/[conversationId]/page.tsx`.
- Creative Studio: `studio/` + sub-pages `create`, `post`, `posts`, `review`, `calendar`, `media`, `design`, `video`, `campaign`, `repurpose`, `templates/[id]`, `pages/[id]`, `hashtags`, `brand-kit`, `accounts`, `analytics`, `posting-schedule`, `webhooks/[id]`.
- Command Centre: `tasks`, `agents`, `approvals`, `costs`, `activity`, `analytics`.
- Also: `brands/`, `brands/[brandSlug]/`, `team/`, `settings/`, and legacy `outputs/`, `media/`, `calendar/` (folded into Studio).

**`src/components/`:**
- `agency/` — 60 top-level product components (`ChatInterface.tsx`, `MediaUploader.tsx`, `BrandSettings.tsx`, `MessageActions.tsx`, …).
- `agency/studio/` — Creative Studio, with sub-folders `preview/` (phone-frame platform mockups), `editor/` (image editor + crop presets), `dnd/`, `grid/`, `hashtags/`, `templates/`, `approval/`, `post/`, `carousel/`, `review/`, `calendar/`, `media/`, `posts/`, `pages/`, `campaign/`, `design/`, `video/`, `analytics/`, `accounts/`, `brand-kit/`, `posting-schedule/`, `webhooks/`.
- `agency/inline/` — `parseInlineCards.ts` and the rich cards rendered from ```json:card``` blocks in chat.
- `ui/` — 14 shadcn/base-ui primitives.
- `landing/`, `about/`, `faq/`, `help/`, `auth/`, `layout/`, `seo/`, `shared/`.

**`src/lib/`:**
- `agents/` — orchestration core: `worker.ts`, `prompt-builder.ts`, `intent-router.ts`, `registry.ts`, `audit.ts`, `goal-loop.ts`, `director-execution.ts`, `compliance-filter.ts`, `compliance-rules.ts`, `marketing-skills.ts`, `performance-learner.ts`, `website-scan-directive.ts`, plus `knowledge/` (static domain knowledge) and `tools/` (70+ tool factories).
- `mcp/` — `server.ts`, `tool-adapter.ts`, `director-chat.ts`, `director-job.ts`, `director-job-tool.ts`, `draft-post-tool.ts`, `director-only-tools.ts`, `director-completion.ts`.
- `ai/` — `model-routing.ts` (the only place model ids and prices live).
- `memory/` — v2 memory: `embeddings.ts`, `fact-extractor.ts`, `store.ts`, `session-memory.ts`, `founder-learning.ts`. `ruflo/` holds the legacy v1 memory.
- `supabase/` — `client.ts`, `server.ts`, `admin.ts`, `middleware.ts`.
- `publishers/` — `dispatcher.ts` plus `meta|linkedin|tiktok|twitter|youtube.ts`, `token-store.ts`, `rate-limiter.ts`, `media-validator.ts`, `retry-queue.ts`, `types.ts`.
- `mixpost/`, `media/`, `video/`, `video-toolkit/`, `transcription/`, `canva/`, `carousel/`, `posting-queue/`, `content-optimisation/`, `analytics/`, `proforma/`, `discovery/`, `github/`, `telegram/`, `stripe/`, `email/`, `emails/`, `webhooks/`, `security/`, `auth/`, `errors/`, `help/`, `abeai/`, `pico/`, `blotato/`.
- Root-level modules: `chat-dispatch.ts`, `constants.ts`, `room-config.ts`, `slash-commands.ts`, `post-versions.ts`, `template-variables.ts`, `notification-preferences.ts`, `seo.ts`, `utils.ts`.

**`supabase/migrations/`:**
- Purpose: forward-only schema history, `001_initial_schema.sql` → `042_remove_heygen_video_provider.sql`.
- Convention: `NNN_snake_case_description.sql`, zero-padded, never renumbered or edited after being applied.

**`scripts/`:**
- Purpose: one-shot operational work — backfills, seeds, diagnostics. `.ts` files run with `npx tsx`, `.mjs` with `node`.

## Key File Locations

**Entry points:**
- `src/middleware.ts` — session refresh on every non-static request.
- `src/app/api/chat/route.ts` — web Director (`maxDuration = 300`).
- `src/app/api/mcp/route.ts` — MCP Streamable HTTP surface.
- `src/app/api/heartbeat/route.ts` — 15-minute autonomous cron.
- `src/app/page.tsx` — public landing. Do not modify.

**Configuration:**
- `next.config.ts` — tracing includes, image remote patterns, `.well-known` rewrites, security headers.
- `vercel.json` — the three production cron schedules.
- `tsconfig.json` — `@/*` alias, strict mode.
- `eslint.config.mjs`, `postcss.config.mjs`, `supabase/config.toml`.
- `.env.local` (secrets, git-ignored) / `.env.local.example` (template).

**Core logic:**
- `src/lib/agents/worker.ts` — AgentWorker.
- `src/lib/agents/tools/index.ts` — per-agent tool assembly.
- `src/lib/ai/model-routing.ts` — model + cost policy.
- `src/lib/mcp/server.ts` — MCP surface and `HIDDEN_FROM_MCP`.
- `src/lib/media/process-pipeline.ts` — the only media writer.
- `src/lib/publishers/dispatcher.ts` — publish routing.
- `src/lib/security/project-access.ts` — MCP project scoping.

**Types & state:**
- `src/types/database.ts` — every table type, `AgentType`, `AGENT_LABELS`, `AGENT_SUBTITLES`. Hand-maintained; update it in the same commit as the migration.
- `src/stores/agency-store.ts` — the single Zustand store.

**Testing:**
- Co-located `*.test.ts` beside implementation, e.g. `src/lib/ai/model-routing.test.ts`, `src/lib/agents/goal-loop.test.ts`, `src/lib/mcp/mcp-scope-wiring.test.ts`, `src/lib/telegram/telegram-api.test.ts`. 47 files total.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` — `ChatInterface.tsx`, `StudioDashboard.tsx`.
- Library modules: `kebab-case.ts` — `model-routing.ts`, `process-pipeline.ts`, `intent-router.ts`.
- Hooks: `useCamelCase.ts` — `useStudioData.ts`, `useChunkedUpload.ts`. Exception: `use-auth.ts`.
- Tests: `<module>.test.ts` beside the module.
- Routes: always `route.ts`; pages always `page.tsx`.
- Migrations: `NNN_snake_case.sql`.
- Scripts: `kebab-case.ts` / `kebab-case.mjs`.

**Directories:**
- Everything lowercase, kebab-case where multi-word: `src/lib/video-toolkit/`, `src/lib/content-optimisation/`, `src/app/agency/studio/posting-schedule/`.
- Dynamic segments bracketed: `[brandId]`, `[conversationId]`, `[brandSlug]`, `[token]`, `[mediaItemId]`, `[category]/[slug]`.

**Code:**
- Tool factories: `createXTool(ctx)` — `createDelegateTool`, `createConveneMeetingTool`.
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_CONCURRENT_WORKERS`, `GATEWAY_MODELS`, `HIDDEN_FROM_MCP`.
- Australian English throughout: colour, behaviour, organisation, optimisation, analyse.

## Where to Add New Code

**New agent tool:**
- Implementation: `src/lib/agents/tools/<kebab-name>.ts`, exporting `createXTool(ctx)` with a `zod/v3` schema.
- Register: add to the appropriate agent-type set in `src/lib/agents/tools/index.ts`.
- MCP exposure: read-only or bounded single-shot tools are auto-exposed. Multi-step, content-writing or Director-reasoning tools **must** be added to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts` and given a `chat_with_director` example in the `quick_start` prompt.
- Tests: `src/lib/agents/tools/<kebab-name>.test.ts`.

**New API endpoint:**
- `src/app/api/<domain>/route.ts` (nest for sub-resources; use `[param]` for dynamics).
- Validate the body with Zod, return `{ error, friendlyMessage }` on failure.
- Pick the right Supabase client: `server.ts` for user-scoped RLS work, `admin.ts` only for webhooks/cron/MCP.

**New product page:**
- `src/app/agency/<room>/<page>/page.tsx` — flat routing, no route groups.
- Add `export const dynamic = 'force-dynamic'` if it renders base-ui components.
- Register the tab in `src/lib/room-config.ts`.

**New Studio component:**
- `src/components/agency/studio/<Feature>.tsx`, or a sub-folder if it grows past a few files.
- Reuse `src/components/ui/` primitives; compose base-ui with the `render` prop, never `asChild`.
- oklch colours only (silver/chrome, hue ~240); IBM Plex fonts; `lucide-react` icons.
- Read the three Creative Studio specs before touching Creator / Review / Schedule / Media (listed in `CLAUDE.md`).

**New third-party integration:**
- Client: `src/lib/<provider>/client.ts`.
- Key resolution: check `user_integrations` first, then the env var.
- Expose it to agents as a tool in `src/lib/agents/tools/`, not by calling it from a component.

**New database table or column:**
- Migration: `supabase/migrations/0NN_description.sql` (next free number, never edit an applied one).
- Types: update `src/types/database.ts` in the same commit.
- RLS: add policies using the existing helper functions.
- Triggers: the project's trigger function is `update_updated_at()`, not `update_updated_at_column()`.

**New publisher platform:**
- `src/lib/publishers/<platform>.ts` implementing the `Publisher` interface from `src/lib/publishers/types.ts`.
- Register it in `NATIVE_PUBLISHERS` in `src/lib/publishers/dispatcher.ts` (lazy dynamic import) and gate on `USE_NATIVE_PUBLISHER_<PLATFORM>`.
- Add OAuth routes under `src/app/api/oauth/<platform>/{initiate,callback}/`.

**New test:**
- `<module>.test.ts` next to the module, Node test runner style. Picked up automatically by `npm test`.

## Special Directories

**`graphify-out/`:**
- Purpose: generated knowledge graph (`GRAPH_REPORT.md`, `graph.json`, `wiki/`).
- Generated: yes — `graphify update .`. Query it before grepping for codebase-wide questions.
- Hand-edit: no.

**`.planning/`:**
- Purpose: GSD project memory (`codebase/` holds this map).
- Generated: by GSD commands. Committed.

**`memory/`, `.claude/`, `.agents/`, `.codex/`, `.windsurf/`, `.superpowers/`, `.swarm/`, `.claude-flow/`:**
- Purpose: per-runtime agent configuration and skills.
- Generated: by installers. Do not hand-copy skill files.

**`.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, `.vercel/`:**
- Build artefacts. Not committed.

**`docs/`, `public/`:**
- Documentation and static assets. Committed, hand-edited.

**Repo-root loose files:**
- `2026-04-08-post-creator-redesign.md` is a live spec that must be read before Creator work. Several `.zip` / `.pdf` / `Untitled.canvas` files at root are scratch artefacts, not part of the build.

---

*Structure analysis: 2026-07-28*
