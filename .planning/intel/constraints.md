# Constraints

Extracted from the 8 SPEC-class documents in the ingest set. Each entry is a hard technical contract that downstream work must respect. Where a constraint has been overtaken by verified code reality, the entry says so.

---

## C-01: media_items has no `status` column
- source: docs/specs/nrs-media-processing-pipeline.md, docs/specs/nrs-video-pipeline-architecture.md
- type: schema
- content: `media_items` has `transcription_status` but **no `status` column**. PostgREST rejects an entire update with PGRST204 when any named column is unknown, silently dropping every other field in the same write. The Director's `process_media` tool previously wrote `status: 'transcribed'` and lost its transcription this way while still returning `success: true`. Any new write to `media_items` must be checked against `src/types/database.ts:MediaItem` first.

## C-02: runMediaProcessingPipeline is the only permitted writer of media processing fields
- source: docs/specs/nrs-media-processing-pipeline.md
- type: api-contract
- content: Signature `runMediaProcessingPipeline({ supabase, mediaItemId, runStages? }): Promise<PipelineResult>`. Pure function, idempotent, three isolated stages (thumbnail / transcription / ai) via a `runStage()` helper. Stage failures are never fatal — errors land in `metadata.processing.<stage>.error` and other stages continue. Prior `metadata.processing` reports are merged, never clobbered. The only fatal failure is a DB write error at the final update. Callers inspect `result.success` and `result.report`.

## C-03: Media pipeline stage skip thresholds
- source: docs/specs/nrs-media-processing-pipeline.md
- type: nfr
- content: Thumbnail — skipped if `thumbnail_url` already set OR file > 500 MB; `ffmpeg -ss 1 -i <https-url> -frames:v 1 -vf scale=720:-1 -q:v 3`; `-ss` before `-i` is fast-seek and streams only the bytes needed for frame 1 (tens of KB regardless of file size); 30s hard kill, 15s input socket rw_timeout. Transcription — Deepgram nova-2 URL mode first, OpenAI Whisper fallback only for files < 25 MB; skipped if `transcription` already set OR file > 100 MB. AI tagging — Claude vision for images, transcript analysis for video/audio, via AI Gateway (`anthropic/claude-haiku-4-5-20251001`); skipped if no transcript.

## C-04: Mixpost Pro /posts API takes numeric account IDs, not UUIDs
- source: docs/specs/nrs-video-pipeline-architecture.md
- type: api-contract
- content: `accounts: [id]` must be numeric — UUIDs produce a 422. Each version's `account_id` is also numeric. Body shape: `{"accounts":[6],"versions":[{"account_id":6,"is_original":true,"content":[{"body":"caption","media":[39],"url":null}]}],"schedule_now":true}`. Returns `{id, uuid, status:'scheduled'}`, transitioning to `publishing` then `published` via `AccountPublishPostJob` (~60s for FB Pages).

## C-05: Mixpost remote-media download is asynchronous and must be polled to completion
- source: docs/specs/nrs-video-pipeline-architecture.md
- type: protocol
- content: `POST /media/remote/initiate` returns `{download_id, status:'pending'}` for videos, not a synchronous media id. Poll `GET /media/remote/{download_id}/status` → `{status: downloading|processing|completed|failed, progress}`. Completion payload carries `{media:{id,uuid,mime_type,url,thumb_url}}`. Polling must span the full transcode duration, not just download time. Status lives in Laravel Cache (Redis) via `RemoteMediaDownloadTracker` with a 1-hour TTL — restarting the container mid-download can wipe in-flight cache entries, after which polls return default `null` and the tracker silently skips updates.

## C-06: Publishing timeout chain — every layer must exceed transcode time
- source: docs/specs/nrs-video-pipeline-architecture.md, docs/specs/nrs-mixpost-upload-limits.md
- type: nfr
- content: Measured 2026-04-09/10. Vercel `maxDuration` on `/api/mcp` = 600s. `pollRemoteDownload` default = 500s, 3000ms interval. Mixpost `DownloadRemoteMediaJob.timeout` = 600s. Horizon supervisor-1 timeout = 3600s (up from 60s). Horizon supervisor-1 memory = 1024 MB (up from 128 MB). NRS client `src/lib/mixpost/sync-draft.ts:POLL_MAX_SECONDS` = 1800. Reference transcode: ~382s for a 141 MB Motion JPEG `.mov` on a 2-core / 2 GB VPS. ffmpeg two-pass libx264 spikes to 300–500 MB RSS, so the Horizon default of 128 MB is a guaranteed SIGKILL for any transcode above ~30 MB.

## C-07: 2 GB upload ceiling requires five layers raised in sync
- source: docs/specs/nrs-mixpost-upload-limits.md
- type: nfr
- content: Any single layer left at its old value blocks uploads. Host nginx `client_max_body_size` 2048M; container nginx `client_max_body_size` 2048M; container PHP-FPM `upload_max_filesize` 2048M / `post_max_size` 2048M / `memory_limit` 1024M; `MIXPOST_MAX_VIDEO_FILE_SIZE=2048` (Laravel validator defaults to 200 MB if unset, regardless of nginx/PHP, erroring with Mixpost's own typo `"The video must no be greater than 200 MB"`); Horizon supervisor-1 timeout 3600. Overrides persist via host-mounted files (`/opt/mixpost/overrides/{zzz-uploads.ini,nginx-default.conf,horizon.php}`) because the container filesystem is ephemeral — `docker exec` edits are lost on recreate.

## C-08: Mixpost webhook event names and HMAC verification
- source: docs/specs/nrs-mixpost-webhooks.md
- type: protocol
- content: Nine events, derived from Pro source (the public docs do not publish the list). Post: `post.created`, `post.updated`, `post.scheduled`, `post.published`, `post.publishing_failed`, `post.deleted`. Account: `account.added`, `account.updated`, `account.deleted`. **`post.published.failed` does not exist** — the NRS receiver previously listened for it and silently dropped every failure webhook (fixed 2026-04-10). Not emitted at all: `media.uploaded`, `media.deleted`, any `workspace.*` (Enterprise tier only). Wire format `{"event":"...","data":{...}}`. Signature is `hash_hmac('sha256', json_encode($data), $secret)` in header `X-Signature`, present only when a secret is configured. The raw body MUST be read via `await request.text()` before parsing — any re-serialisation changes the bytes and breaks verification. Comparison must be timing-safe with a length pre-check.

## C-09: MCP server transport and auth
- source: docs/specs/nrs-mcp-architecture.md
- type: api-contract
- content: Endpoint `https://www.notrealsmart.com.au/api/mcp`. Streamable HTTP, stateless. Auth is either a Bearer API key (`nrs_sk_...`, SHA-256 hashed in `api_keys`) or OAuth 2.0 for Claude Desktop/Mobile. Both auth methods resolve to the same key type. All access methods — web, Desktop, Mobile, Cowork, Claude Code, any MCP client — hit the same Director, agents, brands, memory, budget and audit log.

## C-10: MCP tool exposure is governed by DIRECT_MCP_TOOLS (allowlist), not HIDDEN_FROM_MCP
- source: src/lib/mcp/director-only-tools.ts (verified 2026-07-30); supersedes docs/specs/nrs-mcp-architecture.md
- type: api-contract
- content: `DIRECT_MCP_TOOLS` is an explicit allowlist in `src/lib/mcp/director-only-tools.ts`; everything not named in it is Director-only by default. Verified members include `get_brand_kit`, `query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`, `search_designs`, `list_brand_kits`, `get_export_formats`, `scan_website`, `browse_page`, `generate_image`, `save_output`, `upload_media`, `export_design`. `grep -rn "HIDDEN_FROM_MCP" src/` returns nothing. `publish_to_social` and `manage_posts` — which the SPEC and CLAUDE.md both list as MCP-exposed — are **not** in the allowlist and are Director-only in reality.

## C-11: Direct publishing platform requirements, quotas and review gates
- source: docs/specs/nrs-social-publishing-build-plan.md
- type: nfr
- content: **Meta** — scopes `instagram_business_basic`, `instagram_business_content_publish`, `pages_manage_posts`, `pages_read_engagement`; app review with screencast per permission, 5+ business days; IG Business/Creator linked to a Page; 60-day long-lived refreshable token; 200 API calls/hour/account and 100 posts/24h (reduced from 5,000/hour in 2025); two-step publish (create container, then publish) with a processing wait for video; video must sit at a public URL. **YouTube** — scope `youtube.upload`; verification required for sensitive scopes; 10,000 quota units/day with 1,600 per upload (~6/day); access token expires hourly, refresh token long-lived. **TikTok** — scopes `video.publish`, `video.upload`; 5–10 business day review with mandatory sandbox testing; **unaudited apps are restricted to PRIVATE posts**; Business accounts only; videos 3s–10min; ~15 posts/day. **LinkedIn** — `w_member_social` is self-service Open Permissions, `w_organization_social` needs Community Management API access; 60-day tokens with limited auto-refresh; 100 API calls/day/user; company page posting needs admin access.

## C-12: Platform character limits and per-platform version model
- source: docs/specs/nrs-creative-studio-definitive-architecture.md, docs/specs/nrs-mixpost-visual-parity-inventory.md
- type: api-contract
- content: `src/lib/post-versions.ts` holds `PLATFORM_CHAR_LIMITS` and `createVersionsFromMaster`; `src/lib/template-variables.ts` holds 8 built-in variables and `resolveTemplate()`. Per-platform hashtag counts differ (30 Instagram, 5 TikTok). Mixpost parity requires per-platform metadata fields NRS does not yet have (13 `ProviderVersionOptions` components): Facebook audience + link preview; Instagram first comment, location, cover image; TikTok privacy, comments/duet/stitch, content disclosure; YouTube title, category, privacy, shorts toggle; LinkedIn article link; X poll + thread settings; Pinterest board, pin link, alt text; Mastodon content warning + visibility; Threads reply control; Bluesky reply gate + language.

## C-13: Compliance is mandatory for AHPRA/TGA brands and blocks publication
- source: docs/specs/nrs-creative-studio-definitive-architecture.md
- type: nfr
- content: Creator Card 8 auto-runs compliance for AHPRA/TGA brands, warns on claim language, before/after images and testimonials, renders green/amber/red, and **blocks publishing if red**. Studio Rule 5: "Never skip compliance for health brands." Non-health brands skip the card entirely. Exposure is $60,000 per offence.
- note: PARTIALLY VIOLATED in code. The gate exists and fails closed on the `publish_to_social` path (verified 2026-07-30). It is **absent from `src/lib/publishers/`** (the direct path) and absent from the scheduled cron publisher. See INGEST-CONFLICTS.md → BLOCKERS.

## C-14: Every draft creation path must stamp metadata.source
- source: docs/specs/nrs-creative-studio-definitive-architecture.md, docs/specs/nrs-creator-build-checklist.md
- type: schema
- content: Studio Rule 6 — `metadata.source` is stamped on every draft creation path without exception, so the Review tab can render source badges (AI Generate, Calendar Fill, Manual, Director, MCP/External) and filter by them. PostCreator stamps `metadata.source = 'post_creator'`.

## C-15: Draft sync to Mixpost is idempotent via metadata.mixpost.post_uuid
- source: docs/specs/nrs-mixpost-webhook-setup.md, docs/specs/nrs-video-pipeline-architecture.md
- type: protocol
- content: Draft created in NRS → sync → appears in Mixpost within 30s. Scheduling inside Mixpost flips `scheduled_posts.status` from `draft` to `scheduled` within 5s, driven entirely by the `post.scheduled` webhook with no polling. On publish, a Resend email fires via `buildPostPublishedEmail` and status becomes `published`. On failure, status becomes `failed` and the error lands in `scheduled_posts.error`. Idempotency key is `metadata.mixpost.post_uuid`.

## C-16: media_items Mixpost cache columns (migration 031)
- source: docs/specs/nrs-video-pipeline-architecture.md
- type: schema
- content: `mixpost_media_id` (integer, cached Mixpost numeric id after first upload), `mixpost_media_uuid` (text), `mixpost_cached_at` (timestamptz). Indexed on `mixpost_media_id where not null`. A cache hit skips remote-initiate entirely and makes publish ~5s instead of ~382s.

## C-17: mcp_jobs table (migration 030)
- source: docs/specs/nrs-mcp-architecture.md, docs/specs/nrs-video-pipeline-architecture.md
- type: schema
- content: Async job queue for `chat_with_director` background runs via the `after()` pattern. Columns: `id, user_id, brand_id, job_type, status, input, result, error, cost_cents, duration_ms, created_at, started_at, completed_at`. RLS: users read own rows.

## C-18: Every social post must carry 5–8 lowercase hashtags
- source: docs/specs/nrs-video-pipeline-architecture.md
- type: nfr
- content: Mandatory rule injected into the Director's system prompt (`src/lib/mcp/director-job.ts`) and into the `draft_post` brief, which demands the JSON envelope `{"caption":"...","hashtags":["..."]}`. Stated as: "Every social media post MUST include 5-8 relevant lowercase hashtags. The MCP client is the messenger; YOU own the creative."

## C-19: Diagnose client-side failures without asking the user to open DevTools
- source: docs/specs/nrs-video-pipeline-architecture.md, docs/specs/nrs-media-processing-pipeline.md
- type: nfr
- content: `src/app/api/debug/upload-log/route.ts` persists client breadcrumbs to `audit_log` (`action='upload_debug'`, `entity_type='media_upload_trace'`); `scripts/read-upload-trace.mjs` reads them from the terminal. Each breadcrumb carries the git commit SHA so stale bundles are visible. The user never opens DevTools.

## C-20: Unverified-live items carried by the video pipeline spec
- source: docs/specs/nrs-video-pipeline-architecture.md (frontmatter `status: partial — 8/10 verified live`)
- type: nfr
- content: Four items are explicitly flagged as never confirmed live and must be treated as open, not settled: HeyGen webhook → rehost → media_items (code shipped, no render triggered); Director end-to-end through the 600s maxDuration (the live test bypassed the Director and called Mixpost directly); the cache-hit publish path (~5s expected, cache row exists, untested); the `draft_post` JSON hashtag envelope since deploy `ffd2425`.
