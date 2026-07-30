# External Integrations

**Analysis Date:** 2026-07-30

Every integration below is verified against source. Status is one of:
- **Live** — code path is complete and reachable in production
- **Configured-optional** — complete code, but returns `null`/"not configured" without env vars
- **Degraded** — present but demonstrably second-class (fallback-only, or stale copy)
- **Aspirational** — referenced in docs/config but no working code path

## Data Storage

### Supabase — Postgres, Auth, Storage, pgvector — **Live**
Project `uyhtrwlotoriblicqqrl`. The system of record for everything: brands, conversations, agent registry, media, scheduled posts, memories, audit log, API keys.

**Three clients — never mix them:**
| Client | File | Key | Use |
|---|---|---|---|
| Browser | `src/lib/supabase/client.ts` | anon | Client components, RLS-enforced |
| Server | `src/lib/supabase/server.ts` | anon + cookie session | RSC + API routes, RLS-enforced |
| Admin | `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, cron, MCP, publishers — bypasses RLS |
| Middleware | `src/lib/supabase/middleware.ts` | anon | `updateSession()`, called from `src/middleware.ts` on every non-static request |

- Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Admin client is deliberately session-less (`autoRefreshToken: false, persistSession: false`, `src/lib/supabase/admin.ts:7-10`)
- Storage: `media` bucket; public object URLs whitelisted in `next.config.ts` `images.remotePatterns`
- Migrations: `supabase/migrations/` (41 files). Notable: `024_memory_v2.sql` (pgvector), `025_api_keys.sql`, `026_oauth.sql`, `034_direct_publishing.sql`, `039_project_scope_security.sql`, `040_github_app_connectors.sql`, `042_remove_heygen_video_provider.sql`

### Scent Sell Supabase (cross-project read) — **Live**
`src/app/api/sync/scentsell/route.ts` opens a **second** Supabase client against a different project (`https://dejjxzdgahtfzakkceby.supabase.co`, hardcoded at line 20) using `SCENTSELL_ANON_KEY`, to pull marketplace + sample-shop product images into the NRS media pantry. Deduplicated via `metadata.scentsell_sync_key`. Auth: `CRON_SECRET` bearer, but the route is **not registered in `vercel.json`** — manual/ad-hoc invocation only.

## AI & Models

### Vercel AI Gateway — **Live, and the only model path**
- Client: `@ai-sdk/gateway`, `gateway(modelId)`. Policy centralised in `src/lib/ai/model-routing.ts`
- Auth: **none in code.** No `AI_GATEWAY_API_KEY` or `ANTHROPIC_API_KEY` appears anywhere in `src/`. Vercel injects the credential.
- Four tiers (`src/lib/ai/model-routing.ts:30-42`):
  - `fast` → `anthropic/claude-haiku-4.5` (fallbacks: gemini-3-flash, gpt-5.4-nano)
  - `agency` → `anthropic/claude-sonnet-5` — the default (fallbacks: gpt-5.4, gemini-3-flash)
  - `frontier` → `anthropic/claude-opus-5` — routed to only for high-stakes health/regulatory work on health brands (`isHighStakesHealthcareWork`, line 186)
  - `code` → `openai/gpt-5.3-codex` — routed to on code-shaped input (`isCodeWork`, line 182)
- Every request sets `disallowPromptTraining: true` and `caching: 'auto'`; regulated requests can add `zeroDataRetention` (`createGatewayProviderOptions`, line 113)
- Cost: real per-model USD table incl. cache-read/cache-write rates, `estimateGatewayCost()` (line 150), charged to budget rounded up to whole cents
- Consumed by ~20 files, including `src/app/api/chat/route.ts:392`, `src/lib/agents/worker.ts`, and most `src/lib/agents/tools/*`

### OpenAI (direct, narrow) — **Live**
Two non-Gateway uses of `OPENAI_API_KEY`:
1. Embeddings — `text-embedding-3-small` (1536 dims) via `openai.embedding()` with a 100-entry LRU cache, `src/lib/memory/embeddings.ts:2,11,39`. Never throws; returns `[]` on failure.
2. Whisper transcription fallback (see Deepgram below)

Image generation goes *through* the Gateway: `gateway.image('openai/gpt-image-1')` (`src/lib/agents/tools/generate-image.ts:22`).

### Deepgram + Whisper (ASR) — **Live**
`src/lib/transcription/transcribe.ts` — deliberate 2-layer fallback:
1. Deepgram `nova-2`, URL mode (`https://api.deepgram.com/v1/listen?model=nova-2&language=en-AU&...`, line 25). Deepgram fetches the file itself, so serverless memory is untouched and file size is unbounded. 3-min timeout. Auth: `Authorization: Token ${DEEPGRAM_API_KEY}`.
2. OpenAI `whisper-1` (`https://api.openai.com/v1/audio/transcriptions`, line 63). Requires downloading the file, so it is skipped above 25 MB. Auth: `Bearer ${OPENAI_API_KEY}`.

Both failing throws with a joined error string listing each layer's reason.

## Publishing

### Mixpost Pro (self-hosted) — **Live, primary publisher**
The most deeply wired integration in the codebase.
- Client: `src/lib/mixpost/client.ts` (899 lines) — accounts, media, tags, post creation
- Auth: `MIXPOST_API_TOKEN` bearer against `MIXPOST_API_URL`. Mixpost Pro v6 routes are **workspace-scoped**: `{MIXPOST_API_URL}/api/{MIXPOST_WORKSPACE_UUID}/accounts` (`client.ts:74-79`); the client falls back to the unscoped path if the UUID is unset
- Brand mapping: `src/lib/mixpost/brand-mapping.ts` — fuzzy-matches Mixpost account names to NRS brands
- Draft sync: `src/lib/mixpost/sync-draft.ts` — pushes every NRS draft into Mixpost on save, idempotent via `metadata.mixpost.post_uuid`
- Tag sync: `src/lib/mixpost/sync-tags.ts` — mirrors brand names and hashtag-group names into Mixpost tags, cached on `brands.mixpost_tag_id` / `hashtag_groups.mixpost_tag_id` (migration `032_mixpost_tag_sync.sql`)
- UI tokens shared with native publishers: `src/lib/mixpost/ui-tokens.ts` exports `PLATFORM_CHAR_LIMITS` / `PLATFORM_MEDIA_LIMITS`, consumed by `src/lib/publishers/{meta,youtube,linkedin,tiktok,twitter}.ts`
- Kill switch: `NEXT_PUBLIC_MIXPOST_DISABLED`
- API surface: 10 routes under `src/app/api/mixpost/` (`accounts`, `media`, `media/remote/[id]/status`, `ping`, `posts`, `posts/[postId]`, `posts/[postId]/approve`, `posts/[postId]/queue`, `tags`, `templates`)
- Providers mapped: facebook_page, facebook_group, instagram, linkedin, linkedin_page, tiktok, youtube, x/twitter, mastodon, pinterest, google (`client.ts:15-28`)

### Native platform publishers — **Live behind per-platform feature flags**
`src/lib/publishers/dispatcher.ts` routes each publish to a native platform client or falls back to Mixpost, gated by `USE_NATIVE_PUBLISHER_<PLATFORM>=true` env flags (dispatcher header, lines 1-9). Native publishers are lazy-imported so platform code isn't pulled in when only Mixpost is used.

| Platform | Client | API | OAuth env |
|---|---|---|---|
| Meta (FB Pages + IG Business) | `src/lib/publishers/meta.ts` | Graph API v21.0; IG two-step container flow, Reels via `media_type=REELS`; refresh via `fb_exchange_token` | `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI` |
| YouTube | `src/lib/publishers/youtube.ts` | Data API v3 resumable upload; video-only, rejects text/image at validation | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI` |
| LinkedIn | `src/lib/publishers/linkedin.ts` | — | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI` |
| TikTok | `src/lib/publishers/tiktok.ts` | — | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_OAUTH_REDIRECT_URI` |
| X/Twitter | `src/lib/publishers/twitter.ts` | — | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `TWITTER_OAUTH_REDIRECT_URI` |

- OAuth flows: 10 routes, `src/app/api/oauth/{meta,youtube,linkedin,tiktok,twitter}/{initiate,callback}`
- Token storage: `src/lib/publishers/token-store.ts` → `social_oauth_tokens` table via the **admin** client, 5-minute pre-expiry refresh buffer. **Access tokens are stored plaintext** — the file's own header (lines 6-10) flags pgcrypto encryption as deferred hardening
- Supporting: `rate-limiter.ts` (`canPublish`/`recordPublish`), `media-validator.ts`, `retry-queue.ts` (`enqueueRetry`). Every attempt logged to `publisher_runs`
- Schema: `supabase/migrations/034_direct_publishing.sql`

### Blotato (MCP client) — **Configured-optional**
NRS acts as an MCP *client* to `https://mcp.blotato.com/mcp` (`src/lib/blotato/client.ts:15`) over JSON-RPC `tools/call`.
- Auth: `blotato-api-key` header, read per-user from `user_integrations.cached_data.api_key` where `provider='blotato'` and `is_active` (line 181). No env-var fallback — Blotato is user-supplied only.
- Wraps 13 Blotato tools: accounts, publishing, content extraction (sources), visual generation from templates, content calendar CRUD, presigned media upload
- Surfaced to agents as 8 tools in `src/lib/agents/tools/blotato.ts`
- Positioned as complementary to Mixpost: Blotato for AI creation/visuals/repurposing, Mixpost for scheduling/analytics/publishing (client.ts:10-12)

### Ayrshare — **Degraded (vestigial fallback)**
Exactly one live reference remains: `src/app/api/cron/publish-posts/route.ts:207` reads `AYRSHARE_API_KEY` as a fallback behind the `user_integrations` lookup. There is no `src/lib/ayrshare/` client. Treat as deprecated; Mixpost superseded it.

## Design & Media Sources

### Canva — **Live, the largest external tool surface**
- Client: `src/lib/canva/client.ts` (136 lines) — `https://api.canva.com/rest/v1`
- Agent tools: `src/lib/agents/tools/canva.ts` — **1,731 lines**, the biggest tool file in the repo. Exposes ~30 tools: `design_graphic`, `export_design`, `get_design`, `get_design_pages`, `get_design_content`, `get_design_assets`, `search_designs`, `search_folders`, `create_folder`, `list_folder_items`, `move_item_to_folder`, `upload_asset_from_url`, `import_design_from_url`, `resize_design`, `generate_design_structured`, `design_from_candidate`, `start_editing_transaction` / `perform_editing_operations` / `commit_editing_transaction` / `cancel_editing_transaction`, comment CRUD (`comment_on_design`, `reply_to_comment`, `list_comments`, `list_replies`), `get_presenter_notes`, `get_export_formats`, brand kits (`get_brand_kit`, `list_brand_kits`, `extract_brand_kit`)
- Auth — **hybrid, OAuth-first**: `getCanvaToken()` reads `user_integrations` for `provider='canva'`, auto-refreshes when within 60s of expiry using Basic `client_id:client_secret` against `/oauth/token`, writes the new token back; falls back to platform `CANVA_API_KEY` (`client.ts:11-42`)
- Env: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_API_KEY`
- Routes: `src/app/api/canva/{auth,callback,designs,brand-kits,import-to-media}`
- **Doc disagreement:** `CLAUDE.md` says Canva is reached "via Canva MCP (`mcp__claude_ai_Canva__*`)". It is not — it is a direct REST integration with its own OAuth.

### Stock media — **Configured-optional**
Thin proxy routes, each returning a friendly "not configured" error when the key is absent:
- Unsplash — `src/app/api/unsplash/search/route.ts`, `https://api.unsplash.com/search/photos`, `UNSPLASH_ACCESS_KEY`
- Pexels — `src/app/api/pexels/search/route.ts`, `https://api.pexels.com/v1/search`, `PEXELS_API_KEY`
- Giphy — `src/app/api/giphy/search/route.ts`, `https://api.giphy.com/v1/gifs/search`, `GIPHY_API_KEY` (rating capped at pg-13)

### Bitly — **Configured-optional**
`src/app/api/shorten/route.ts` → `https://api-ssl.bitly.com/v4/shorten`, `BITLY_ACCESS_TOKEN`. Returns "Bitly not configured. Add BITLY_ACCESS_TOKEN in Settings." when unset. Resolution side: `resolve_shortlink` tool.

### Modal cloud-GPU video toolkit — **Configured-optional**
`src/lib/video-toolkit/client.ts` — three independent Modal HTTPS endpoints, no auth header (endpoint URL *is* the credential):
| Capability | Model | Env | Timeout |
|---|---|---|---|
| Voiceover | Qwen3-TTS (9 preset speakers) | `MODAL_QWEN3_TTS_ENDPOINT_URL` | 120s |
| Image | FLUX.2 | `MODAL_FLUX2_ENDPOINT_URL` | 120s |
| Music | ACE-Step | `MODAL_ACE_STEP_ENDPOINT_URL` | 180s |

`isToolkitConfigured()` / `getConfiguredTools()` report per-capability availability. Routes: `src/app/api/video-toolkit/{voiceover,image,music,status}`.

### HeyGen — **Removed**
Deliberately excised, not merely unused. Migration `supabase/migrations/042_remove_heygen_video_provider.sql` drops it from the schema, and `src/lib/agents/heygen-removal.test.ts` is a standing guard test that walks every `.ts`/`.tsx` file under `src/` and asserts zero mentions plus the absence of `src/lib/heygen`, `src/app/api/heygen`, `src/app/api/webhooks/heygen`. `CLAUDE.md`'s video tool list (`create_video`, `multi_scene_video`, `translate_video`, `photo_avatar`, `talking_photo`, `text_to_speech`) describes tools that no longer exist.

### Headless browser rendering — **Live**
`playwright-core` + `@sparticuz/chromium`, used only by `src/lib/agents/tools/rendered-website-scan.ts`. `next.config.ts` traces the Chromium Brotli pack into six specific routes (`/api/chat`, `/api/mcp`, `/api/webhooks/telegram`, `/api/telegram/mini-app/message`, `/api/brands/[brandId]/review`, `/api/integrations/github/callback`) because the pack path is assembled at runtime and static tracing misses it.

## Source Control

### GitHub App — **Live**
- Config: `src/lib/github/github-app.ts` — `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (escaped `\n` unescaped on read, line 29). Credentials live in a dedicated `.env.github-app` file.
- Client: `src/lib/github/github-app-client.ts` — mints an RS256 JWT in server memory (`createGitHubAppJwt`, 9-minute expiry, 30s clock skew) then exchanges it for a short-lived installation access token against `https://api.github.com` with `X-GitHub-Api-Version: 2022-11-28`
- **Security posture is explicit in the source:** installation tokens "are minted at request time and never written to Supabase, Telegram, agent memory, or audit logs" (`github-app.ts:12-15`). Repository text is redacted through `redactRepositoryProductText` and path-filtered by `isAllowedGitHubProductPath` (`src/lib/github/project-connection.ts`)
- Install flow: `gitHubAppInstallUrlWithState()` → `https://github.com/apps/{slug}/installations/new?state=...`; state hashed via `hashGitHubConnectState`
- Routes: `src/app/api/integrations/github/{start,callback}`, `src/app/api/github/sync`, `src/app/api/scan-github-quick`
- Schema: `supabase/migrations/040_github_app_connectors.sql`
- Also: `repository-context.ts`, `project-connection.ts`, each with unit tests

## Messaging & Email

### Telegram (NRS control channel) — **Live, feature-flagged**
The second-largest integration by file count — 24 files in `src/lib/telegram/`, half of them tests.
- Config: `src/lib/telegram/nrs-telegram-config.ts` — `NRS_TELEGRAM_BOT_TOKEN`, `NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN`, and an explicit `NRS_TELEGRAM_CHANNEL_ENABLED === 'true'` gate that "must be deliberately set after token rotation and production acceptance" (line 4)
- API client: `src/lib/telegram/telegram-api.ts` → `https://api.telegram.org/bot{token}/*`. **Only inline keyboards are supported** — reply keyboards are refused because their visible text can be replayed as ordinary chat input and misread as a project selector (lines 35-39)
- Webhook: `src/app/api/webhooks/telegram/route.ts` — `runtime = 'nodejs'`, `maxDuration = 300`. Verifies the secret with `timingSafeEqual`, resolves a scoped grant, then runs `runDirectorJob` via `after()`. Capabilities are fixed to `['director:chat','draft:post','direct:read','direct:utility']` (line 25)
- Pairing: short-lived one-time code, hashed (`telegram-pairing.ts`, `src/app/api/telegram/pair`). The comment at `nrs-telegram-config.ts:11-15` is explicit that no hard-coded bot owner exists, because "one ambient Telegram identity [would be] an implicit passport to every project"
- Mini App: `src/lib/telegram/mini-app.ts` + `src/app/api/telegram/mini-app/{session,select,message,jobs/[jobId]}`; chat menu button registered via `setChatMenuButton` with a `web_app` type
- Response contracts under test: `telegram-execution-contract.ts`, `telegram-research-contract.ts`, `telegram-response-quality.ts`, `telegram-marketing-copy.ts`, `telegram-thread.ts`

### Resend — **Live**
`resend` ^6.9.4, instantiated per-route rather than through a shared client:
- `src/app/api/team/route.ts:7` — team invitations
- `src/app/api/team/accept/route.ts:6` and `src/app/api/team/send-welcome/route.ts:6`
- `src/app/api/email-report/route.ts:5` — "Email Me" action on chat messages
- `src/app/api/webhooks/mixpost/route.ts:323` — post-published notification
- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`
- Templates: `src/lib/email/templates/`, `src/lib/emails/post-published.ts`

### Gmail (read) — **Degraded**
`src/lib/agents/tools/read-gmail.ts` hits `https://gmail.googleapis.com/gmail/v1/users/me/messages` with a **static `GMAIL_ACCESS_TOKEN` env var** (line 21) — no refresh token, no OAuth flow. Its own error message tells the user to "Set up OAuth at console.cloud.google.com" (line 25). Google access tokens expire in ~1 hour, so this works only for as long as a manually pasted token lives.

## Payments

### Stripe — **Live, but the plan catalogue is stale**
- Client: `src/lib/stripe/client.ts` — lazy singleton behind a `Proxy`, `apiVersion: '2026-02-25.clover'`, `STRIPE_SECRET_KEY`
- Routes: `src/app/api/stripe/{checkout,portal,webhook}`; webhook verified with `STRIPE_WEBHOOK_SECRET`
- Plans: `src/lib/stripe/config.ts` — three tiers (Starter $29, Professional $79, Practice $149) keyed by `STRIPE_STARTER_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`
- **The plan copy does not describe this product.** Features list "All 24 phases unlocked", "Basic compliance scanner", "Halaxy & Xero integrations", "multi-practitioner support" — clinic-practice language carried over from a sibling BHI project, not NRS marketing-agency features. Treat `config.ts` as unreviewed.

## Sibling-Product Connectors

### Abe AI (regulatory corpus) — **Configured-optional**
`src/lib/abeai/full-client.ts` + `regulatory-corpus.ts`. Server-only, reached exclusively from AI SDK tools (`use_abe_ai`), bearer-token auth against an organisation-scoped base URL from `getAbeAiConfig()`. The key "never crosses to the browser" (full-client.ts:33-35).

### PICO Search (clinical evidence) — **Configured-optional**
`src/lib/pico/client.ts` → `https://www.picosearch.ai` (overridable via `PICO_SEARCH_API_BASE`). Auth: `PICO_SEARCH_API_KEY`, **validated to start with `pks_`** before the client will initialise (line 35). Async job model: submit → `poll_url` → status (`queued`→`routing`→`fan_out`→`ranking`→`synthesising`→`completed`). Agent tool: `use_pico_search`.

### Scent Sell marketing connector — **Configured-optional**
`SCENT_SELL_MARKETING_CONNECTOR_URL` + `SCENT_SELL_MARKETING_CONNECTOR_TOKEN`, used by `src/lib/agents/tools/project-backend-marketing.ts` (`inspect_project_marketing_backend`). Distinct from the direct Supabase image sync above.

## The MCP Server NRS Exposes

### `/api/mcp` — **Live**
NRS is itself an MCP server, consumed by Claude Desktop/Mobile/Code and any MCP client.
- Handler: `src/app/api/mcp/route.ts` — `WebStandardStreamableHTTPServerTransport`, stateless (fresh server per request), `dynamic = 'force-dynamic'`, `maxDuration = 600` (sized for Director delegation plus a ~382s first-upload Mixpost video transcode)
- Server factory: `src/lib/mcp/server.ts` — `createNRSMcpServer(principal)`. Every connection is **project-scoped**; `listGrantedProjectIds(principal)` means a user identity alone is never sufficient to enumerate workspaces
- Tool list is registered upfront and must never shrink — MCP clients cache it and won't refetch without a reconnect (server.ts:11-14). Not-ready tools return "coming soon" rather than disappearing
- CORS wide open (`Access-Control-Allow-Origin: *`) but gated by auth; six discovery methods are deliberately unauthenticated: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `prompts/list`, `resources/list` (route.ts:29-36)

**Two auth methods, one credential type:**
1. Bearer API key — prefix `nrs_sk_`, SHA-256 hashed in `api_keys` (migration `025_api_keys.sql`). Issued at `src/app/api/keys`, validated by `resolveApiKey()` (`src/lib/auth/api-key.ts`)
2. OAuth 2.0 — full RFC 8414 discovery + RFC 7591 dynamic registration + PKCE S256. Routes: `src/app/api/mcp/{authorize,token,register,code}`, login page `src/app/mcp-login/`. Discovery documents at `src/app/api/well-known/oauth-{authorization-server,protected-resource}` are rewritten to `/.well-known/*` in `next.config.ts`. `grant_types_supported: ['authorization_code','refresh_token']`, `code_challenge_methods_supported: ['S256']`

**Grant model** (`src/lib/auth/api-key.ts:31`): only grants with `channel === 'mcp'`, `status === 'active'`, no `revoked_at`, and not past `expires_at` become a principal. Default capabilities: `director:chat`, `draft:post`, `direct:read`, `direct:utility`. Schema: `supabase/migrations/039_project_scope_security.sql`.

**Tool exposure is an allowlist, not a denylist.** `src/lib/mcp/director-only-tools.ts` defines `DIRECT_MCP_TOOLS` — 15 tools an external client may call directly: `get_brand_kit`; reads `query_media`/`query_calendar`/`query_outputs`/`query_analytics`/`query_social_analytics`; design reads `search_designs`/`list_brand_kits`/`get_export_formats`; bounded utilities `scan_website`/`browse_page`/`generate_image`/`save_output`; asset handling `upload_media`/`export_design`. Everything else is Director-only, reachable via `chat_with_director` (`src/lib/mcp/director-chat.ts`) → async `runDirectorJob` (`director-job.ts`) → poll `get_director_response` (`director-job-tool.ts`), or the sync shortcut `draft_post` (`draft-post-tool.ts`).

> **Doc disagreement:** `CLAUDE.md` documents a `HIDDEN_FROM_MCP: ReadonlySet<string>` denylist in `src/lib/mcp/server.ts`. That symbol no longer exists; the policy was inverted to the `DIRECT_MCP_TOOLS` allowlist, and the header comment now states new tools "stay Director-only unless explicitly reviewed". Also, `publish_to_social` and `manage_posts` — listed in `CLAUDE.md` as MCP-exposed — are **not** in the allowlist and are therefore Director-only.

**Resources:** `brands://list`. **Prompts:** `quick_start`.

## Incoming Webhooks

| Endpoint | Source | Verification |
|---|---|---|
| `/api/webhooks/mixpost` | Mixpost Pro (9 events: post created/updated/scheduled/published/publishing_failed/deleted, account added/updated/deleted) | HMAC SHA-256 over the raw body against `X-Signature`, `crypto.timingSafeEqual` — `src/lib/webhooks/mixpost-signature.ts`. **Missing secret is accepted in `development`/`test` only; every other environment rejects** (lines 27-32). Env: `MIXPOST_WEBHOOK_SECRET` |
| `/api/webhooks/telegram` | Telegram Bot API | `timingSafeEqual` against `NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN` |
| `/api/stripe/webhook` | Stripe | `STRIPE_WEBHOOK_SECRET` signature |

## Outgoing Webhooks

User-registered webhooks: `src/lib/webhooks/dispatcher.ts` + `events.ts`, managed at `src/app/api/user-webhooks/`, `user-webhooks/[id]`, `user-webhooks/[id]/deliveries`. Schema: `supabase/migrations/037_user_webhooks.sql`. Agent tool: `register_webhook`.

## Calendar Feed (outgoing)

`src/app/api/calendar/feed` — iCal feed for Google/Apple Calendar, authenticated by `?key=nrs_sk_...` query param (the same API-key type as MCP).

## Scheduled Jobs

Registered in `vercel.json`:
| Path | Schedule | Purpose |
|---|---|---|
| `/api/heartbeat` | `*/15 * * * *` | Autonomous task processing, budget enforcement |
| `/api/cron/publish-posts` | `*/5 * * * *` | Publish due posts via Mixpost (Ayrshare fallback) |
| `/api/cron/daily-intel` | `0 20 * * *` | Daily intelligence research |

**Not registered but present** — reachable only by manual `CRON_SECRET`-authenticated call: `/api/cron/consolidate-memories`, `/api/cron/monitor-alerts`, `/api/cron/performance-learn`, `/api/sync/scentsell`.

## Environment Configuration

**Required for the app to function at all:**
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`

**Required for the core publishing loop:**
`MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WORKSPACE_UUID`, `MIXPOST_WEBHOOK_SECRET`, `CRON_SECRET`

**AI:** none. The Gateway credential is Vercel-injected. `OPENAI_API_KEY` is needed only for embeddings and the Whisper fallback.

**Secrets location:** `.env.local` (git-ignored), plus a dedicated `.env.github-app` for the GitHub App private key. Mirrored into Vercel project env. Per-user third-party credentials live in the `user_integrations` table (`cached_data` JSONB) and take precedence over env vars for Canva and Blotato.

## Summary of Doc/Code Disagreements

1. **Canva** — `CLAUDE.md` says "via Canva MCP (`mcp__claude_ai_Canva__*`)". Reality: direct REST at `https://api.canva.com/rest/v1` with its own OAuth refresh loop.
2. **MCP allowlist** — `HIDDEN_FROM_MCP` denylist in `server.ts` was replaced by the `DIRECT_MCP_TOOLS` allowlist in `director-only-tools.ts`. `publish_to_social` and `manage_posts`, documented as MCP-exposed, are now Director-only.
3. **HeyGen / video generation** — documented as a live capability with 7 tools; actually removed by migration `042` and enforced absent by `heygen-removal.test.ts`.
4. **Native publishers** — five direct platform-API publishers with full OAuth flows and a feature-flagged dispatcher exist (`src/lib/publishers/`), and are essentially undocumented in `CLAUDE.md`, which describes publishing as Mixpost-with-Ayrshare-fallback.
5. **Abe AI, PICO Search, Blotato, Modal toolkit, Bitly, Unsplash, Pexels, Giphy, Scent Sell connectors** — all present in code, none in `CLAUDE.md`'s integration list.
6. **Stripe plan catalogue** — `src/lib/stripe/config.ts` describes a clinic-practice product ("24 phases", "Halaxy & Xero"), not NRS.
7. **Gmail** — documented as an agent capability; implemented against a manually pasted, non-refreshing access token.

---

*Integration audit: 2026-07-30*
