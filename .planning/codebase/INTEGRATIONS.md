# External Integrations

**Analysis Date:** 2026-07-28

## APIs & External Services

**AI / models:**
- Vercel AI Gateway — the single model path. Client: `@ai-sdk/gateway`. Policy is centralised in `src/lib/ai/model-routing.ts` (`GATEWAY_MODELS`, `GATEWAY_FALLBACKS`, `GATEWAY_MODEL_PRICING`). Tiers: `fast` → `anthropic/claude-haiku-4.5`, `agency` → `anthropic/claude-sonnet-5`, `frontier` → `anthropic/claude-opus-5`, `code` → `openai/gpt-5.3-codex`. Credentials auto-injected on Vercel; no env var to set.
- Perplexity search — via `gateway.tools.perplexitySearch(...)`, granted to `overall`, `seo`, `competitor` agents in `src/app/api/chat/route.ts`.
- OpenAI — Whisper transcription fallback only. Auth: `OPENAI_API_KEY`. `src/lib/transcription/transcribe.ts`.
- Deepgram (nova-2) — primary ASR. Auth: `DEEPGRAM_API_KEY`. `src/lib/transcription/`.

**Social publishing:**
- Mixpost Pro (self-hosted, BinaryLane VPS) — primary publisher and media library. Client: `src/lib/mixpost/client.ts`. Auth: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WORKSPACE_UUID` (Mixpost Pro v6 requires the workspace UUID in API paths). Helpers: `src/lib/mixpost/sync-draft.ts`, `src/lib/mixpost/sync-tags.ts`, `src/lib/mixpost/brand-mapping.ts`. Routes under `src/app/api/mixpost/`.
- Native platform publishers — `src/lib/publishers/` with per-platform modules `meta.ts`, `linkedin.ts`, `tiktok.ts`, `twitter.ts`, `youtube.ts`. Routing lives in `src/lib/publishers/dispatcher.ts` behind per-platform flags `USE_NATIVE_PUBLISHER_<PLATFORM>=true`; anything else falls back to Mixpost. Support modules: `token-store.ts`, `rate-limiter.ts`, `media-validator.ts`, `retry-queue.ts`.
- Ayrshare — legacy fallback. Auth: `AYRSHARE_API_KEY`.

**Platform OAuth (self-serve account connect):**
- Meta (`META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`) — `src/app/api/oauth/meta/initiate`, `.../callback`
- LinkedIn (`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI`) — `src/app/api/oauth/linkedin/*`
- TikTok (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_OAUTH_REDIRECT_URI`) — `src/app/api/oauth/tiktok/*`
- X/Twitter (`TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `TWITTER_OAUTH_REDIRECT_URI`) — `src/app/api/oauth/twitter/*`
- YouTube (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI`) — `src/app/api/oauth/youtube/*`

Tokens land in `social_oauth_tokens` and are refreshed through `src/lib/publishers/token-store.ts`.

**Design & media assets:**
- Canva — `src/lib/canva/client.ts`, OAuth at `src/app/api/canva/auth` + `src/app/api/canva/callback`, designs proxy at `src/app/api/canva/designs`, import at `src/app/api/canva/import-to-media`. Auth: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_API_KEY`.
- Stock media — Unsplash (`UNSPLASH_ACCESS_KEY`, `src/app/api/unsplash/search`), Pexels (`PEXELS_API_KEY`, `src/app/api/pexels/search`), Giphy (`GIPHY_API_KEY`, `src/app/api/giphy/search`).
- Modal-hosted owned video toolkit — voiceover (`MODAL_QWEN3_TTS_ENDPOINT_URL`), image (`MODAL_FLUX2_ENDPOINT_URL`), music (`MODAL_ACE_STEP_ENDPOINT_URL`). Client: `src/lib/video-toolkit/`, routes `src/app/api/video-toolkit/{voiceover,image,music,status}`.

**Other:**
- GitHub App — repo scanning and brand auto-fill. `src/lib/github/`, routes `src/app/api/integrations/github/start`, `.../callback`, `src/app/api/github/sync`, `src/app/api/scan-github-quick`. Tables: `github_app_installations`, `github_connect_requests`, `github_installation_repositories`, `github_repository_bindings`.
- Gmail read — `GMAIL_ACCESS_TOKEN`, tool `src/lib/agents/tools/read-gmail.ts`.
- Bitly link shortening — `BITLY_ACCESS_TOKEN`, route `src/app/api/shorten`.
- Telegram Bot + Mini App — `src/lib/telegram/` (`telegram-api.ts`, `mini-app.ts`, `telegram-pairing.ts`, `scoped-telegram.ts`), routes `src/app/api/webhooks/telegram`, `src/app/api/telegram/pair`, `src/app/api/telegram/mini-app/{session,select,message,jobs/[jobId]}`, page `src/app/telegram/page.tsx`. Tables: `telegram_accounts`, `telegram_pair_codes`, `telegram_project_sessions`.
- ScentSell marketing connector — cross-project sync. Auth: `SCENT_SELL_MARKETING_CONNECTOR_URL`, `SCENT_SELL_MARKETING_CONNECTOR_TOKEN`, `SCENTSELL_ANON_KEY`. Route `src/app/api/sync/scentsell`.
- AbeAI regulatory corpus — `src/lib/abeai/full-client.ts`, `src/lib/abeai/regulatory-corpus.ts`, tool `src/lib/agents/tools/abeai.ts`.
- Headless rendered-website audit — `@sparticuz/chromium` + `playwright-core`, `src/lib/agents/tools/rendered-website-scan.ts`. Chromium binaries are traced into six specific routes by `outputFileTracingIncludes` in `next.config.ts`.

## Data Storage

**Databases:**
- Supabase Postgres — project ref `uyhtrwlotoriblicqqrl`.
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  - Clients (never mix): `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (RSC + API routes, RLS-enforced), `src/lib/supabase/admin.ts` (service role — webhooks, cron, MCP).
  - Schema: 42 migrations in `supabase/migrations/`. Types mirrored in `src/types/database.ts`.
  - Tables referenced from code: `users`, `brands`, `conversations`, `messages`, `outputs`, `agent_configs`, `agent_registry`, `agent_memories`, `goals`, `tasks`, `audit_log`, `execution_audit`, `approval_queue`, `heartbeats`, `project_scans`, `ai_usage`, `media`, `media_items`, `media_tags`, `media_collections`, `media_collection_items`, `scheduled_posts`, `post_activity`, `post_templates`, `posting_schedule_slots`, `hashtag_groups`, `brand_proforma_sections`, `brand_conversation_log`, `inspiration_entries`, `user_integrations`, `team_members`, `api_keys`, `api_key_project_grants`, `project_access_grants`, `project_connectors`, `account_entities`, `oauth_clients`, `oauth_auth_codes`, `mcp_jobs`, `social_oauth_tokens`, `publisher_runs`, `publisher_retry_queue`, `user_webhooks`, `user_webhook_deliveries`, `telegram_accounts`, `telegram_pair_codes`, `telegram_project_sessions`, `github_app_installations`, `github_connect_requests`, `github_installation_repositories`, `github_repository_bindings`, `listings`, `scent_shop_items`.

**File Storage:**
- Supabase Storage, `media` bucket. Upload route `src/app/api/media/upload`, chunked client hook `src/hooks/useChunkedUpload.ts`. Thumbnails written alongside originals as `{path}_thumb.jpg`.
- Mixpost media library mirrors uploads (`src/app/api/mixpost/media`, `src/lib/agents/tools/browse-mixpost-media.ts`).

**Caching:**
- No external cache. In-process caching only (e.g. Mixpost account lookups behind `src/app/api/mixpost/accounts`); Mixpost identifiers are cached back onto rows (`brands.mixpost_tag_id`, `hashtag_groups.mixpost_tag_id`, `media_items.metadata`).

**Vector / embeddings:**
- `src/lib/memory/embeddings.ts` with `agent_memories` — memory v2 stored via `src/lib/memory/store.ts`, facts extracted by `src/lib/memory/fact-extractor.ts`. Legacy keyword memory v1 in `src/lib/ruflo/`.

## Authentication & Identity

**End users:**
- Supabase Auth (email/password). Session refresh on every non-static request via `src/middleware.ts` → `src/lib/supabase/middleware.ts` `updateSession()`. Pages: `src/app/login`, `src/app/signup`, `src/app/forgot-password`, `src/app/reset-password`, callback `src/app/auth/`.
- Authorisation is RLS-first: policies resolve through helper functions `is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand` (migration `supabase/migrations/015_team_members.sql`).
- Team invites: `src/app/api/team`, `src/app/api/team/[id]`, `src/app/api/team/accept`, public landing `src/app/invite/[token]/page.tsx`.

**Machine / AI clients (MCP):**
- Bearer API keys — prefix `nrs_sk_`, SHA-256 hashed into `api_keys`. Generation + validation: `src/lib/auth/api-key.ts`. Management route `src/app/api/keys`.
- OAuth 2.0 with PKCE S256 — `src/app/api/mcp/authorize`, `src/app/api/mcp/token`, `src/app/api/mcp/register` (RFC 7591 dynamic registration), `src/app/api/mcp/code`, branded login page `src/app/mcp-login/page.tsx`. Discovery documents served at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`, rewritten in `next.config.ts` to `src/app/api/well-known/*`. Both auth paths mint the same `nrs_sk_` key type.
- Project scoping is mandatory: `src/lib/security/project-access.ts` (`McpPrincipal`, `listGrantedProjectIds`) — a user identity alone never enumerates workspaces. Grants live in `api_key_project_grants` / `project_access_grants`.

## MCP Surface

**Endpoint:** `https://www.notrealsmart.com.au/api/mcp` — Streamable HTTP, stateless, one server instance per request.

**Factory:** `createNRSMcpServer(principal)` in `src/lib/mcp/server.ts`. Agent tools are converted by `src/lib/mcp/tool-adapter.ts` (`adaptToolsForMCP(..., hiddenFromMcp)`).

**Resource:** `brands://list` — only the projects granted to that connection.

**Exposed tools:** `list_projects` / `list_brands` (alias), `chat_with_director` (`src/lib/mcp/director-chat.ts`), `get_director_response` (`src/lib/mcp/director-job-tool.ts`), `draft_post` (`src/lib/mcp/draft-post-tool.ts`), read-only queries (`query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`) and bounded actions (`publish_to_social`, `manage_posts`, `manage_tags`, `save_output`, `generate_image`, `scan_website`, `browse_page`).

**Hidden from MCP** (`HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts`, enforced by never registering them): `process_media`, `write_blog`, `write_ads`, `write_email_campaign`, `repurpose_content`, `marketing_audit`, `deep_competitor_scan`, `fill_calendar`, `analyse_voice`, `analyse_content_gaps`, `create_video`, `multi_scene_video`, `translate_video`, `photo_avatar`, `text_to_speech`, `generate_slides`, `delegate_to_agent`, `convene_meeting`. Plug-in AIs must route these through `chat_with_director`. Director-only enforcement is also asserted in `src/lib/mcp/director-only-tools.ts` and its tests.

**Async job pattern:** `chat_with_director` returns immediately and kicks an async run (`src/lib/mcp/director-job.ts`) tracked in `mcp_jobs`; the client polls `get_director_response`.

## Monitoring & Observability

**Audit:**
- `audit_log` is append-only (no UPDATE/DELETE policies). Writer: `src/lib/agents/audit.ts` `logAudit()`. Every chat turn and worker run records model, tokens, cost in cents, duration.
- `execution_audit` and `publisher_runs` capture agent execution and per-publish attempts respectively.

**Cost:**
- `ai_usage` rows written in the `onFinish` handler of `src/app/api/chat/route.ts`, priced by `estimateGatewayCost` in `src/lib/ai/model-routing.ts`. Budgets enforced per agent via `checkBudget`/`recordAgentSpend` in `src/lib/agents/registry.ts` — HTTP 429 when exhausted. Dashboard at `src/app/agency/costs/page.tsx`.

**Client diagnostics:**
- Non-technical-user rule: never ask for DevTools. Client breadcrumbs POST to `src/app/api/debug/upload-log/route.ts`, land in `audit_log` with `action='upload_debug'`, and are read from the terminal via `scripts/read-upload-trace.mjs`. Emitter: `src/components/agency/MediaUploader.tsx`.

**Error tracking:** No third-party APM. `console.error` plus the audit tables.

## CI/CD & Deployment

**Hosting:** Vercel. Pushes to `main` deploy production.

**CI:** `.github/` present at repo root. No test gate is wired into the deploy; `npm run build` + `npm run lint` + `npm test` are run manually before shipping.

## Webhooks & Callbacks

**Incoming:**
- `src/app/api/webhooks/mixpost/route.ts` — all 9 Mixpost Pro events (`post.created|updated|scheduled|published|publishing_failed|deleted`, `account.added|updated|deleted`). HMAC SHA-256 verification of the `X-Signature` header using `MIXPOST_WEBHOOK_SECRET`.
- `src/app/api/webhooks/telegram/route.ts` — Telegram bot updates.
- `src/app/api/stripe/webhook/route.ts` — Stripe events, verified with `STRIPE_WEBHOOK_SECRET`.
- OAuth callbacks: `src/app/api/oauth/{meta,linkedin,tiktok,twitter,youtube}/callback`, `src/app/api/canva/callback`, `src/app/api/integrations/github/callback`.

**Outgoing:**
- User-defined webhooks — `src/lib/webhooks/`, management routes `src/app/api/user-webhooks`, `.../[id]`, `.../[id]/deliveries`; UI at `src/app/agency/studio/webhooks/`. Tables `user_webhooks`, `user_webhook_deliveries`. Registered by the Director's `register_webhook` tool.
- iCal feed out — `src/app/api/calendar/feed/route.ts`, authenticated by `?key=nrs_sk_...` for Google/Apple Calendar subscription.

## Scheduled Jobs (Vercel Cron)

Declared in `vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/heartbeat` | `*/15 * * * *` | Autonomous task execution via `runAgentWorker`; budget enforcement + monthly reset. `src/app/api/heartbeat/route.ts` (`maxDuration = 300`) |
| `/api/cron/publish-posts` | `*/5 * * * *` | Publish due `scheduled_posts` through `src/lib/publishers/dispatcher.ts` (native → Mixpost → Ayrshare) |
| `/api/cron/daily-intel` | `0 20 * * *` | Daily industry/competitor research refresh |

Additional cron-shaped routes exist but are not in `vercel.json` (invoke manually or add a schedule): `src/app/api/cron/consolidate-memories`, `src/app/api/cron/monitor-alerts`, `src/app/api/cron/performance-learn`. All cron routes gate on `CRON_SECRET`.

## Payments

- Stripe — `src/lib/stripe/`, routes `src/app/api/stripe/checkout`, `.../portal`, `.../webhook`. Plan price IDs: `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`.

---

*Integration audit: 2026-07-28*
