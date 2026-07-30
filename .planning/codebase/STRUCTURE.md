# Codebase Structure

**Analysis Date:** 2026-07-30

## Directory Layout

```
NotRealSmartAgency/
├── src/
│   ├── app/                      # Next.js App Router — pages + API routes (flat, no route groups)
│   │   ├── api/                  # ~115 route handlers
│   │   ├── agency/               # Authenticated product surface
│   │   ├── help/                 # Public help centre (file-backed articles)
│   │   └── (public pages)        # /, /about, /pricing, /faq, /login, /signup, /telegram, …
│   ├── components/
│   │   ├── agency/               # Product UI (chat, brands, tasks, costs)
│   │   │   ├── studio/           # Creative Studio — the largest UI subsystem
│   │   │   └── inline/           # `json:card` inline rich-card renderers for chat
│   │   ├── ui/                   # shadcn/base-ui primitives (14 files)
│   │   ├── landing/ about/ faq/  # Marketing site components
│   │   ├── auth/ layout/ seo/ shared/ help/
│   ├── lib/                      # All domain logic — the centre of gravity
│   │   ├── agents/               # Agent execution, prompts, routing, goals
│   │   │   ├── tools/            # ~56 tool factories
│   │   │   └── knowledge/        # Static knowledge packs injected into prompts
│   │   ├── mcp/                  # MCP server surface + async Director job
│   │   ├── security/             # Project scope, capabilities, input boundary
│   │   ├── memory/ ruflo/        # Memory v2 (semantic) and v1 (keyword)
│   │   ├── proforma/             # 21-section strategic document
│   │   ├── discovery/            # Source-grounded project onboarding
│   │   ├── publishers/ mixpost/  # Social publishing (native-first, Mixpost fallback)
│   │   ├── media/ transcription/ video/ video-toolkit/ carousel/
│   │   ├── supabase/             # Three clients: client / server / admin
│   │   ├── telegram/ github/ canva/ blotato/ stripe/ email/ emails/
│   │   ├── auth/ ai/ analytics/ webhooks/ posting-queue/ help/ errors/
│   │   └── *.ts                  # Cross-cutting constants + small utilities
│   ├── hooks/                    # 13 client data hooks
│   ├── stores/agency-store.ts    # The single Zustand store
│   ├── providers/                # Auth, theme, root provider composition
│   ├── types/database.ts         # ALL domain types — single file
│   └── middleware.ts             # Supabase session refresh on every request
├── supabase/migrations/          # 012 → 042, forward-only SQL
├── scripts/                      # One-shot ops + backfill scripts (tsx / node)
├── docs/                         # ARCHITECTURE.md, gitbook-export, superpowers
├── public/                       # Static assets
├── .planning/codebase/           # These documents
├── CLAUDE.md / AGENTS.md         # Agent instructions (kept in sync, ~51KB each)
├── vercel.json                   # Cron schedules
└── next.config.ts / tsconfig.json / eslint.config.mjs
```

## Directory Purposes

**`src/app/api/`:**
- Purpose: every server entry point
- Contains: `route.ts` handlers only — no business logic beyond auth, validation, and orchestration
- Key files: `chat/route.ts` (web Director), `mcp/route.ts` (external AI clients), `heartbeat/route.ts` (autonomous cron), `cron/publish-posts/route.ts`, `webhooks/{telegram,mixpost}/route.ts`

**`src/app/agency/`:**
- Purpose: the authenticated product, organised into three "rooms" (`src/lib/room-config.ts`)
- Contains: server components that render an `agency/` client component
- Key files: `chat/page.tsx` (Director's Office), `studio/page.tsx` (Creative Studio, 17 sub-routes), `tasks/page.tsx` (Command Centre)

**`src/lib/agents/`:**
- Purpose: everything about how an agent thinks and runs
- Contains: `worker.ts` (execution unit), `prompt-builder.ts` (system prompt assembly, ~650 lines), `intent-router.ts` (free keyword routing), `registry.ts` (model + budget state), `goal-loop.ts` (autonomous objective loop), `compliance-{rules,filter}.ts`, `marketing-skills.ts`, `performance-learner.ts`, `director-execution.ts`
- Key files: `worker.ts:111` `runAgentWorker`, `prompt-builder.ts:542` `buildSystemPromptWithMemory`

**`src/lib/agents/tools/`:**
- Purpose: agent capabilities
- Contains: ~56 non-test modules, each exporting one or more `create<Name>Tool(...)` factories
- Key files: `index.ts` (`getToolsForAgent` — the per-agent-type tool map), `delegate.ts`, `convene-meeting.ts`, `proforma.ts`, `publish-to-social.ts`, `process-media.ts`, `canva.ts` (29 factories in one file)

**`src/lib/agents/knowledge/`:**
- Purpose: static, versioned domain knowledge injected into prompts
- Key files: `social-media-benchmarks.ts`, `social-media-design-intelligence.ts`, `au-health-marketing-2025.ts`, `brand-portfolio.ts`, `searchable-social-copy.ts`

**`src/lib/mcp/`:**
- Purpose: the external-AI surface and the async Director runner
- Key files: `server.ts` (server factory + `quick_start` prompt), `director-only-tools.ts` (**the allowlist**), `tool-adapter.ts` (AI SDK tool → MCP tool), `director-chat.ts` (queue a job), `director-job.ts` (run it, ~38KB), `director-job-tool.ts` (poll), `draft-post-tool.ts`

**`src/lib/security/`:**
- Purpose: the authorisation model for non-web channels
- Key files: `project-access.ts` (`McpPrincipal`, `ProjectCapability`, `assertProjectCapability`), `execution-scope.ts`, `marketing-data-boundary.ts` (`inspectMarketingInput`)

**`src/lib/proforma/`:**
- Purpose: the 21-section living strategy document per project
- Key files: `sections.ts` (definitions + `CADENCE_DAYS`), `auto-populate.ts` (`ensureProforma` seeding)

**`src/lib/memory/` and `src/lib/ruflo/`:**
- Purpose: two generations of agent memory, both over `agent_memories`
- `ruflo/` is v1: keyword search (`client.ts`), regex extraction (`memory-extractor.ts`), namespace helpers (`namespaces.ts`)
- `memory/` is v2: embeddings (`embeddings.ts`), semantic store/search (`store.ts`), LLM fact extraction (`fact-extractor.ts`), compounding session memory (`session-memory.ts`), founder learning (`founder-learning.ts`)
- Retrieval tries v2 first and falls back to v1 (`src/lib/agents/prompt-builder.ts:557-573`)

**`src/lib/publishers/` and `src/lib/mixpost/`:**
- Purpose: getting a post onto a platform
- `publishers/dispatcher.ts` routes native-first (`meta.ts`, `linkedin.ts`, `tiktok.ts`, `twitter.ts`, `youtube.ts`) then falls back to Mixpost; `rate-limiter.ts`, `retry-queue.ts`, `media-validator.ts`, `token-store.ts` support it
- `mixpost/` holds the client, brand↔account fuzzy mapping, draft sync, tag sync, and webhook signature verification

**`src/components/agency/studio/`:**
- Purpose: Creative Studio — 36 top-level components plus 20 sub-directories (`post/`, `review/`, `calendar/`, `media/`, `preview/`, `editor/`, `dnd/`, `grid/`, `hashtags/`, `templates/`, `approval/`, `analytics/`, `carousel/`, `campaign/`, `design/`, `pages/`, `posts/`, `video/`, `webhooks/`, `brand-kit/`, `accounts/`, `posting-schedule/`, `repurpose/`)
- Note: `accounts/accounts.bak` is a stale backup directory that should be deleted

**`supabase/migrations/`:**
- Purpose: forward-only schema. Numbered `012` → `042`; earlier migrations are not in the repo
- Key files: `013_brand_proforma.sql`, `025_api_keys.sql`, `039_project_scope_security.sql` (the project-isolation model), `041_goal_director_loop.sql`

**`scripts/`:**
- Purpose: one-shot operations run from the terminal, never from the app
- Key files: `run-pipeline.ts` (re-run media processing for one row), `verify-media-state.mjs`, `read-upload-trace.mjs` (read client breadcrumbs without DevTools), `backfill-*-to-mixpost.ts`, `issue-mcp-key.ts`, `seed-agent-prompts.ts`, `inspect-schema.mjs`
- Prefixed `_tmp-*.mjs` files are scratch and safe to remove

## Key File Locations

**Entry Points:**
- `src/app/api/chat/route.ts`: web Director + department chat (streaming)
- `src/app/api/mcp/route.ts`: MCP Streamable HTTP surface
- `src/app/api/webhooks/telegram/route.ts`: Telegram Director channel
- `src/app/api/heartbeat/route.ts`: autonomous work cron
- `src/app/api/cron/publish-posts/route.ts`: scheduled publishing
- `src/middleware.ts`: Supabase session refresh

**Configuration:**
- `next.config.ts`: `transpilePackages: ['three']`, remote image allowlist, security headers
- `vercel.json`: the three registered crons
- `tsconfig.json`: `@/*` → `src/*` path alias
- `eslint.config.mjs`: flat config (a project-level config *does* exist — CLAUDE.md says it doesn't)
- `.env.local`: all secrets, never committed

**Core Logic:**
- `src/lib/agents/worker.ts`: the department execution unit
- `src/lib/agents/prompt-builder.ts`: brand context → system prompt
- `src/lib/agents/tools/index.ts`: which agent gets which tools
- `src/lib/mcp/director-only-tools.ts`: what external AI clients may call directly
- `src/lib/security/project-access.ts`: the capability model
- `src/lib/ai/model-routing.ts`: model tiers, fallbacks, cost
- `src/lib/media/process-pipeline.ts`: the ONE media pipeline
- `src/types/database.ts`: every domain type

**Testing:**
- Tests are co-located: `src/lib/**/<name>.test.ts` (52 files)
- Run with `npm test` → `tsx --test $(find src -name '*.test.ts' -print)`

## Domain Concepts

**Brand (a.k.a. project) — `brands`:**
- The isolation unit. Older code and the UI say "brand"; the security and MCP layers added in migration 039 say "project". Same row, same `brand_id` column everywhere.
- Type: `src/types/database.ts:321`. Carries identity (`name`, `slug`, `tagline`, `description`), reach (`website_url`, `github_url`, `social_urls`), positioning (`niche`, `business_stage`, `marketing_status`, `marketing_notes`), voice (`tone_of_voice`, `brand_colours`, `content_pillars`, `brand_dna_constraints`, `emulation_wishlist`, `post_signature`, `watermark`), market (`target_audience`, `competitors`, `products_services`), constraints (`compliance_flags`), and enrichment (`github_context`, `extra_context`, `channel_strategy`, `video_preferences`).
- Reaches agents through `buildBrandContext` (`src/lib/agents/prompt-builder.ts:251`), rendered as markdown into the system prompt.

**Proforma sections — `brand_proforma_sections`:**
- 21 rows per brand, `UNIQUE(brand_id, section_key)`. Columns: `section_key`, `section_title`, `section_data JSONB`, `rag_status` (red/amber/green/unknown), `review_cadence` (weekly/fortnightly/monthly/quarterly), `last_reviewed_at`, `updated_at`.
- Definitions: `src/lib/proforma/sections.ts:8`. Seeded on first read by `ensureProforma` (`src/lib/proforma/auto-populate.ts:177`), which derives initial RAG from what the brand row already has — e.g. `market_context` starts RED because it needs research, and a RED `market_context` makes the Director auto-run `research_industry` once (`src/app/api/chat/route.ts:213`).
- Agents read via `read_proforma`, the Director writes via `update_proforma` (`src/lib/agents/tools/proforma.ts`).

**Scheduled posts — `scheduled_posts`:**
- The content pipeline row: `draft → scheduled → publishing → published` (plus failure states). Carries `platform`, `caption`, `hashtags[]`, `post_type` (`single|carousel|reel|video`), `media_item_ids[]`, `scheduled_at`, `external_post_id`, `queue_slot_id`, and a `metadata` JSONB that holds `source` (`DraftSource` union at `src/types/database.ts:714`), Mixpost linkage (`metadata.mixpost.post_uuid`), compliance results and edit history.
- Type: `src/types/database.ts:777`. Second-most-referenced table in the codebase (72 call sites).

**Media items — `media_items`:**
- Uploaded/generated assets with `transcription`, `transcription_status`, `ai_description`, `tags[]`, `thumbnail_url`, `duration_seconds`, and a `metadata.processing` per-stage report.
- **Schema gotcha:** there is `transcription_status` but **no `status` column**. Any update including `status:` is rejected wholesale by PostgREST (PGRST204) and silently drops the rest of the update. Check `src/types/database.ts:670` before writing.
- Single write path: `runMediaProcessingPipeline` in `src/lib/media/process-pipeline.ts`.

**Project access grants — `project_access_grants` + `api_key_project_grants`:**
- `(actor_user_id, brand_id, channel)` unique, with a `capabilities text[]` drawn from `director:chat`, `draft:post`, `direct:read`, `direct:utility`, `publish:request` and a channel of `web|mcp|telegram|internal`.
- Joined to a specific key through `api_key_project_grants`, so revoking a key revokes its project reach. Migration 039 revoked every pre-existing key rather than letting it inherit owner-wide access.
- Runtime shape: `McpPrincipal` in `src/lib/security/project-access.ts`.

**API keys — `api_keys`:**
- `nrs_sk_`-prefixed, SHA-256 hashed. `token_kind` is `access | refresh | personal`, with `parent_key_id`, `policy_version`, `expires_at`, `revoked_at`.
- Both the manual key flow and the OAuth flow mint the same kind of key (`src/lib/auth/api-key.ts`).

**Related tables worth knowing:** `project_links` (explicit, directional, purpose-scoped cross-project data flow), `project_connectors` (read-only first-party marketing connectors per project), `execution_audit` (redacted per-decision evidence with CHECK constraints banning raw input), `mcp_jobs` (async Director runs, scope-stamped), `goals`/`tasks` (the autonomous loop), `agent_registry` (per-user, per-department model + budget + status), `agent_memories` (`brand_id` + `isolation_status`, embeddings), `telegram_accounts`/`telegram_project_sessions`.

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` — `ChatInterface.tsx`, `StudioDashboard.tsx`
- Library modules: `kebab-case.ts` — `prompt-builder.ts`, `project-access.ts`, `process-pipeline.ts`
- Hooks: `useCamelCase.ts` — `useStudioData.ts` (one outlier: `use-auth.ts`)
- Tests: co-located `<module>.test.ts`
- Routes: `route.ts` / `page.tsx` per Next.js
- Migrations: `NNN_snake_case.sql`

**Directories:**
- All lowercase kebab-case: `agents/tools`, `video-toolkit`, `content-optimisation`
- Dynamic segments in brackets: `[brandSlug]`, `[conversationId]`, `[mediaItemId]`

**Exports:**
- Tool factories: `create<Name>Tool(...)` returning an AI SDK `tool(...)`
- MCP registrations: `register<Name>Tool(server, principal)`
- Types: `PascalCase` interfaces in `src/types/database.ts`; string-union types for enums (`AgentType`, `PostType`, `DraftSource`, `ProjectCapability`)

## Where to Add New Code

**A new agent tool:**
1. Implementation: `src/lib/agents/tools/<tool-name>.ts`, exporting `create<Name>Tool(supabase, userId, brandId, …)`. Schema via `import { z } from 'zod/v3'`.
2. Wire-up: instantiate in `src/lib/agents/tools/index.ts` and add it to the relevant `toolSets` entries.
3. **Decide MCP exposure.** Nothing is exposed by default. Only add the name to `DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts` if it is read-only, or a bounded utility that writes no marketing copy and publishes nothing. Anything multi-step, content-writing, or outbound stays Director-only, and the `quick_start` prompt in `src/lib/mcp/server.ts:129` should mention it.
4. Test: `src/lib/agents/tools/<tool-name>.test.ts`.

**A new department behaviour or prompt rule:**
- Shared rules belong in `src/lib/agents/prompt-builder.ts`. Note that Director-specific directives are currently duplicated between `src/app/api/chat/route.ts` and `src/lib/mcp/director-job.ts` — add to both, or extract first.
- Static domain knowledge: a new module under `src/lib/agents/knowledge/` plus an injection point in the prompt builder.

**A new API route:**
- `src/app/api/<segment>/route.ts`. Flat routes only — no route groups.
- Auth: `createClient()` from `src/lib/supabase/server.ts` for user-facing routes (RLS applies). Use `createAdminClient()` only for cron/webhook/MCP paths, and pair it with an explicit scope check from `src/lib/security/`.
- Cron routes must verify `Bearer $CRON_SECRET` **and** be registered in `vercel.json`.

**A new UI screen:**
- Page: `src/app/agency/<room>/<name>/page.tsx` (add `export const dynamic = 'force-dynamic'` if it renders base-ui components).
- Component: `src/components/agency/studio/<Name>.tsx` for Studio work, `src/components/agency/<Name>.tsx` otherwise.
- Data: a hook in `src/hooks/use<Name>.ts` hitting a route under `src/app/api/`.
- Navigation: register in `src/lib/room-config.ts`.
- Use the `render` prop for base-ui composition (not `asChild`), oklch colours only, Australian English.

**A new database table or column:**
- Migration: `supabase/migrations/<next-number>_<name>.sql`, forward-only, with RLS enabled and policies using `can_access_brand` / `can_write_for_owner` / `is_owner_or_team_member`.
- Types: add to `src/types/database.ts` in the same change — it is the only type source.
- Triggers: the updated-at trigger function is `update_updated_at()`, not `update_updated_at_column()`.

**A new external integration:**
- Client: `src/lib/<provider>/client.ts` with the credential resolved from `user_integrations` first, then the env var.
- Expose it to agents as a tool, never as a UI concept — users must not see the plumbing.

**Shared helpers:**
- Cross-cutting, no domain: `src/lib/utils.ts`, `src/lib/constants.ts`
- Domain-specific: the matching `src/lib/<domain>/` directory

## Special Directories

**`.planning/codebase/`:**
- Purpose: these analysis documents, consumed by GSD planning/execution commands
- Generated: yes | Committed: yes

**`graphify-out/`:**
- Purpose: generated knowledge graph of the codebase (`GRAPH_REPORT.md`, `graph.json`, `wiki/`)
- Generated: yes, by `graphify` | Committed: check `.gitignore` before relying on it

**`agency-agents-main-EXAMPLE/` and the sibling `.zip` files:**
- Purpose: a vendored reference copy of the `agency-agents` personality library used as a pattern source for the 14 NRS agent definitions
- Generated: no (third-party) | Committed: yes — it is reference material, not build input, and is a candidate for removal

**`docs/gitbook-export/` and `src/lib/help/articles/`:**
- Purpose: the help centre content, authored in-repo and exported by `scripts/export-help-to-gitbook.ts`
- Committed: yes

**`.next/`, `node_modules/`, `tsconfig.tsbuildinfo`:** build output, not committed.

**`memory/`, `.claude/`, `.claude-flow/`, `.swarm/`, `.agents/`, `.codex/`, `.windsurf/`, `.superpowers/`:** agent-tooling configuration, not application code.

## Drift From CLAUDE.md

Verified against the tree on 2026-07-30:

- **"No test runner configured."** There is one: `npm test` → `tsx --test` over 52 co-located `*.test.ts` files.
- **"No project-level `eslint.config.*`."** `eslint.config.mjs` exists at the repo root.
- **Route list is incomplete.** Missing from CLAUDE.md: all of `src/app/api/telegram/*`, `api/oauth/{meta,linkedin,tiktok,twitter,youtube}/*`, `api/pages`, `api/posting-schedule`, `api/post-activity`, `api/user-webhooks/*`, `api/account-entities`, `api/collections/*`, `api/media-tags`, `api/shorten`, `api/giphy|pexels|unsplash/search`, `api/goals/*`, `api/compliance-check`, `api/sync/scentsell`, `api/admin/backfill-research`, and the `/agency/studio/*` sub-routes (accounts, brand-kit, campaign, design, hashtags, pages, posting-schedule, posts, repurpose, review, templates, video, webhooks).
- **`/api/video/generate` and `/api/video/status`** are listed as routes but are now empty directories with no `route.ts` (HeyGen removal).
- **Ayrshare** is referenced throughout CLAUDE.md as the publishing fallback; there is no Ayrshare module under `src/lib/`. The fallback chain is native platform APIs → Mixpost (`src/lib/publishers/dispatcher.ts`).
- **`src/lib/blotato/`** (AI content creation, visual generation, repurposing — 8 Director tools) is not mentioned in CLAUDE.md at all.

---

*Structure analysis: 2026-07-30*
