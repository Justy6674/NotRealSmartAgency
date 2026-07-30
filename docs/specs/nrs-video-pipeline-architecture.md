---
created: 2026-04-09
updated: 2026-04-10
tags: [notrealsmart, mixpost, heygen, video-pipeline, architecture]
project: NotRealSmartAgency
status: partial — 8/10 verified live
---

# NRS Video Pipeline Architecture

The chain for publishing a video from intent → live on social, end-to-end. Documented after a 6-hour debugging session on 2026-04-09 that took the pipeline from "every layer broken" to "one live Hibiscus Mahajad video on the Scent Sell Facebook page". Layer 1 and 2 significantly reworked on 2026-04-10 — see change log at the bottom.

## The 5 layers (all now connected)

```
[INTENT] → [MEDIA IN LIBRARY] → [CREATOR SELECTS] → [DIRECTOR DELEGATES] → [MIXPOST PUBLISHES] → [PLATFORM]
```

### Layer 1 — Media upload + thumbnail (reworked 2026-04-10)
- **Source**: user drag/drop via `MediaUploader.tsx` → direct Supabase Storage via XHR (bypasses the Vercel 4.5 MB body limit)
- **Upload order (critical)**: file → XHR upload → DB row insert → fire-and-forget to `/api/media/process`. **No client-side decoding** in the upload path. Thumbnails are server-side only.
- **Thumbnail**: `/api/media/process` calls `runMediaProcessingPipeline` which uses `extractFirstFrameFromUrl(file_url)` from `src/lib/video/ffmpeg-thumbnail.ts`. ffmpeg fast-seek with HTTPS URL input streams only the bytes needed for frame 1 — tens of KB regardless of total file size. 30s hard kill timeout. Thumb lands at `{path}_thumb.jpg` and `media_items.thumbnail_url` is patched via the pipeline.
- **HeyGen path** (unchanged): `/api/webhooks/heygen/route.ts` downloads from HeyGen CDN (URLs expire ~1 week), uploads to Supabase Storage, extracts thumbnail via `extractFirstFrame(buffer)` from the same file, inserts into media_items with `metadata.source='heygen'`
- **Upload diagnostics**: `src/app/api/debug/upload-log` route persists client breadcrumbs to `audit_log` so upload hangs can be diagnosed without the user ever opening DevTools. See `scripts/read-upload-trace.mjs`.
- **Rich library picker**: `src/components/agency/studio/post/MediaSelector.tsx` now renders cards with filename, duration, size, upload date, tags, Used/Unused badges, and NEW badges (< 24h). Uses the `usage_count` + `last_published_at` fields already enriched by `/api/media` from `scheduled_posts`.
- **All media row mutations go through `runMediaProcessingPipeline`** — see [[nrs-media-processing-pipeline]] for the shared function.

### Layer 2 — Creator picks media
- `src/components/agency/studio/post/PostCreator.tsx` — "Generate Video (HeyGen)" button (new, for short_video/long_video/story/ad content types) sends brief to Director via `sendToDirector()`
- `MediaSelector.tsx` — renders videos with `thumbnail_url` + play-triangle overlay via the `MediaThumb` component. Never renders video URL as `<img src>` (that was the grey-box bug). Search/sort/usage badges added 2026-04-10.

### Layer 3 — Director delegates to Content & Copy
- `src/lib/mcp/draft-post-tool.ts` — synchronous MCP tool, calls `runAgentWorker('content', briefedTask, ctx)`. Brief demands JSON envelope `{"caption":"...","hashtags":["..."]}`.
- Content & Copy agent writes caption + 5-8 hashtags in its own voice using its own memory namespace (`nrs-{slug}-content`)
- **Mandatory hashtag rule** injected into Director's system prompt (`src/lib/mcp/director-job.ts`) for non-MCP flows too: *"Every social media post MUST include 5-8 relevant lowercase hashtags. The MCP client is the messenger; YOU own the creative."*

### Layer 4 — `publish_to_social` hands off to Mixpost
- `src/lib/agents/tools/publish-to-social.ts` — accepts `media_ids` (array of `media_items.id` UUIDs) alongside legacy `image_url`/`image_urls`
- **Cache check first**: if `media_items.mixpost_media_id` is set, skip remote-initiate entirely. Instant hit (~5s total publish).
- **Cache miss**: call `/media/remote/initiate` on Mixpost. If response is `{download_id, status: 'pending'}`, poll `/media/remote/{download_id}/status` every 3s for up to 500s. On completion, cache the returned id on `media_items.mixpost_media_id` so the next publish is instant.
- **FAIL LOUD**: if any media_id can't be uploaded (timeout, size, codec), return `BLOCKED` with precise Mixpost error. Never silently publish text-only. This rule stopped two broken test posts from reaching the Scent Sell Facebook page today.
- **post_type auto-detect**: video on IG/FB/TikTok → `reel`, video on YouTube/LinkedIn → `video`, images > 1 → `carousel`, else `single`.
- `video_thumbs` populated from `media_items.thumbnail_url` (was empty array before).

### Layer 5 — Mixpost publishes to platform
- Mixpost Pro transcodes every uploaded video via `MediaUploader::uploadAndInsert()` → `DownloadRemoteMediaJob` → two-pass libx264/aac MP4 conversion + thumbnail extraction via `MediaVideoThumbConversion`
- `AccountPublishPostJob` then fires the platform-specific API (Facebook Graph for FB Pages/IG, YouTube Data, TikTok Content, LinkedIn)

## Mixpost Pro quirks (hard-won learnings from today)

### Transcode time: ~382 seconds for a 141 MB Motion JPEG .mov
- First-pass libx264 analysis: ~180s
- Second-pass encode: ~190s
- Thumbnail extraction: ~2s
- DB insert + storage: ~10s
- **For a 2-core VPS with 2 GB RAM + 4 GB swap**. Your mileage will vary with file size + codec. Motion JPEG sources are WORST CASE — much slower than h264 input because MJPEG needs complete re-compression.

### Async remote-download API
- `POST /media/remote/initiate` returns `{download_id, status: 'pending'}` for videos, NOT synchronous media id
- Poll `GET /media/remote/{download_id}/status` → returns `{status: downloading|processing|completed|failed, progress}`
- Completion payload carries `{media: {id, uuid, mime_type, url, thumb_url}}`
- **Critical**: status is stored in **Laravel Cache (Redis)** via `Inovector\Mixpost\Support\RemoteMediaDownloadTracker` with 1-hour TTL. If you restart the container mid-download, in-flight jobs' cache entries may be wiped and polls return default `null` → the tracker silently skips updates
- **Polls require patience**: you MUST poll for the full transcode duration, not just download time

### The hidden exception
- `DownloadRemoteMediaJob` catches every exception and rewrites as `rules.remote_file.download_failed` in `markFailed()`. The real exception is never logged anywhere.
- To debug, run the job flow manually via `php artisan tinker` inside the container:
  ```php
  $file = RemoteFileDownloader::make($url)->timeout(300)->validateAndDownload();
  $media = MediaUploader::fromLocalPath($file->filepath, $file->filename)->path("media/2026/04")->uploadAndInsert();
  ```
  Wrap in try/catch and walk `$e->getPrevious()` chain for the real error.

### Horizon supervisor memory limits
- Mixpost's `config/horizon.php` ships with `supervisor-1: memory: 128, timeout: 60`. Horizon kills any worker exceeding 128 MB RSS with **SIGKILL (signal 9)**.
- ffmpeg two-pass libx264 easily spikes to 300-500 MB RSS. **Default config = guaranteed fail for any video transcode > ~30 MB.**
- Fix: bump `memory: 1024` and `timeout: 3600` in `config/horizon.php` (inside container), then `php artisan config:clear && config:cache && horizon:terminate`. Horizon restarts via supervisord with the new limits.
- Verify with `ps aux | grep horizon:supervisor` — look for `--memory=1024 --timeout=3600` in the args.

### Mixpost Pro `/posts` API
- Accepts numeric `accounts: [id]` — NOT UUIDs (422 error otherwise)
- Each version's `account_id` is also the numeric id
- Body shape:
  ```json
  {
    "accounts": [6],
    "versions": [{
      "account_id": 6,
      "is_original": true,
      "content": [{
        "body": "caption",
        "media": [39],
        "url": null
      }]
    }],
    "schedule_now": true
  }
  ```
- Returns `{id, uuid, status: 'scheduled'}`. Transitions to `publishing` then `published` via `AccountPublishPostJob` (~60 seconds later for FB Pages).

## VPS infra dependencies (Mixpost Pro on BinaryLane)

```
/opt/mixpost/
├── docker-compose.yml    # mixpost + mysql + redis
└── .env                  # MIXPOST_MAX_FILE_UPLOAD_SIZE=524288 (NEW 2026-04-09)
```

Container config (NOT persisted — applied via sed inside the running container, would need re-applying after any image rebuild):
- `config/horizon.php:supervisor-1.memory` = 1024 (was 128)
- `config/horizon.php:supervisor-1.timeout` = 3600 (was 60)

Host:
- 2 GB RAM, 2 cores
- 4 GB swap at `/swapfile`, in `/etc/fstab` (persistent across reboots)
- Without swap, ffmpeg two-pass encoding 141 MB video OOMs the VPS

## Database

### New columns on `media_items` (migration 031)
- `mixpost_media_id` — integer, cached Mixpost numeric id after first upload
- `mixpost_media_uuid` — text, cached Mixpost UUID companion
- `mixpost_cached_at` — timestamptz, when the cache was populated
- Indexed on `mixpost_media_id where not null`

### New table `mcp_jobs` (migration 030)
- Async job queue for MCP Director chats via `after()` background pattern
- Columns: `id, user_id, brand_id, job_type, status, input, result, error, cost_cents, duration_ms, created_at, started_at, completed_at`
- RLS: users read own rows

## Timeouts (all measured values, 2026-04-09)

| Layer | Setting | Current | Why |
|---|---|---|---|
| Vercel maxDuration on /api/mcp | `route.ts:1` | 600s | First-upload transcode ~382s + delegation overhead |
| Our polling loop in publish_to_social | `pollRemoteDownload` default | 500s | Transcode + buffer |
| Poll interval | setTimeout inside loop | 3000ms | Balance between responsiveness and Mixpost load |
| Mixpost `DownloadRemoteMediaJob.timeout` | PHP class property | 600s | Mixpost default — fine |
| Horizon worker timeout (supervisor-1) | config/horizon.php | 3600s | Up from 60s — must exceed transcode time |
| Horizon worker memory (supervisor-1) | config/horizon.php | 1024 MB | Up from 128 MB — must exceed ffmpeg RSS peak |

## Verified live 2026-04-09

- Hibiscus Mahajád video published to Scent Sell Facebook: https://facebook.com/4395057127380892
- Mixpost post UUID: `9263c832-11e7-4416-a7aa-ff7ac39f0187`
- Transcoded media: Mixpost id=39, uuid=`b6e787e3-7c43-43a8-94d2-5b44271bcf42`, mp4 with thumbnail
- Source media_items row: `4940c11e-706a-4048-86e0-308be1e37142` (seeded with cache values in migration 031)
- First post WITHOUT hashtags (brief gap; JSON envelope now mandates hashtags for all future posts)

## Still unverified live

- HeyGen webhook → rehost → media_items (code shipped, no HeyGen render triggered today)
- Director end-to-end through the new 600s maxDuration (today I bypassed Director on the final publish and called Mixpost directly because Mixpost's 382s transcode hadn't started yet when I issued the test)
- Cache-hit publish path (should be ~5s total — untested live, cache row exists)
- `draft_post` JSON envelope with hashtags (untested live since deploy of `ffd2425`)

## Cross-project value
This architecture + the Mixpost Pro gotchas apply to any BHI project that publishes video to social (Downscale, Tele360, TeleScribe if they run video campaigns, Scent Sell, DownDiary). The `media_items.mixpost_media_id` cache pattern generalises to any expensive-transform-cache-on-row scenario.

## Change log

### 2026-04-10 — Layer 1 rework + MCP enforcement
- **Deleted client-side frame extraction from the upload path.** `extractFramesFromVideo` call removed from `MediaUploader.tsx`. Cause: CleanShot macOS screen recordings have moov atom layouts that make Chrome's `<video>` element hang on `loadedmetadata` forever, with no error event fired. The `await` blocked the entire upload for minutes on any affected file. Client-side extraction still exists in `extract-frames-browser.ts` for `VideoImportPanel` / `VideoEditPanel` (visual analysis feature) but has been hardened with a 10s overall timeout and never-rejects semantics.
- **Two parallel media pipelines consolidated into one.** `src/lib/media/process-pipeline.ts:runMediaProcessingPipeline` is now the single source of truth for thumbnails, transcription, and AI tagging on `media_items` rows. Both `/api/media/process` (browser uploads) and the Director's `process_media` tool delegate to it. See [[nrs-media-processing-pipeline]].
- **Schema bug fixed**: the Director's `process_media` tool used to write `status: 'transcribed'` to `media_items`, but `status` is not a column on that table — PostgREST rejected the entire update with PGRST204, silently dropping the transcription alongside it. Symptom: MCP tool returned a transcript snippet in its response body but `media_items.transcription` stayed null. Fixed by delegating all row writes to the shared pipeline which only touches real schema columns.
- **MCP allowlist**: `HIDDEN_FROM_MCP` set added to `src/lib/mcp/server.ts`. `process_media`, `write_blog`, `write_ads`, `write_email_campaign`, `marketing_audit`, `deep_competitor_scan`, `fill_calendar`, `create_video`, `multi_scene_video`, `translate_video`, `photo_avatar`, `text_to_speech`, `generate_slides`, `repurpose_content`, `analyse_voice`, `analyse_content_gaps`, `delegate_to_agent`, `convene_meeting` are now hidden from MCP clients. Plug-in AIs must call `chat_with_director` for any of these. See [[nrs-mcp-architecture]].
- **Self-reporting upload diagnostics**: `src/app/api/debug/upload-log/route.ts` writes client breadcrumbs to `audit_log`. `scripts/read-upload-trace.mjs` reads them from the terminal. The user never opens DevTools.
- **Server-side URL-streaming ffmpeg pattern documented** in [[nrs-media-processing-pipeline]] — `ffmpeg -ss 1 -i <https-url> -frames:v 1` streams only enough bytes to decode frame 1. Memory-safe for 500 MB serverless uploads.

### 2026-04-09 — Initial build (Hibiscus Mahajád live publish)
- Shipped end-to-end video pipeline HeyGen → library → Creator → Mixpost → platforms
- Fixed Mixpost Pro Horizon memory limit (128MB → 1024MB) so ffmpeg two-pass encode doesn't OOM
- Fixed XHR upload missing apikey header (yesterday's Scent Sell fix — still in place)
- Documented all the Mixpost quirks above

---
**Related entity:** [[Reference/wiki/entities/tele360|tele360]]

---
**Related entity:** [[Reference/wiki/entities/telescribe|telescribe]]

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

---
**Related entity:** [[Reference/wiki/entities/downdiary|downdiary]]

---
**Related entity:** [[Reference/wiki/entities/scentsell|scentsell]]

---
**Related entity:** [[Reference/wiki/entities/binarylane-vps|binarylane-vps]]
