---
created: 2026-04-10
tags: [notrealsmart, media, pipeline, architecture, ffmpeg, deepgram]
project: NotRealSmartAgency
status: live (shipped 2026-04-10 in commit 1a18fb8)
---

# NRS Media Processing Pipeline — Single Source of Truth

One canonical function owns **every** media_items row mutation that touches thumbnails, transcription, AI tagging, or the per-stage processing report. Built 2026-04-10 to close a bug where two parallel pipelines diverged and silently dropped transcriptions.

## The one function

```ts
// src/lib/media/process-pipeline.ts
export async function runMediaProcessingPipeline({
  supabase,           // admin or user-scoped client
  mediaItemId,        // uuid
  runStages?,         // optional filter: ['thumbnail'|'transcription'|'ai']
}): Promise<PipelineResult>
```

- Pure function — takes a Supabase client, returns a structured result
- Safe to run multiple times (re-runs upsert to storage, conditional transcription)
- Never cascades failures — each stage is isolated via a `runStage()` helper
- Merges prior `metadata.processing` reports instead of clobbering (so a caller that only re-runs the `ai` stage doesn't wipe the `thumbnail` report)

## Who calls it

| Caller | Path | When |
|---|---|---|
| Browser uploads | `MediaUploader.tsx` → `/api/media/process` → pipeline | Fire-and-forget after Supabase Storage upload completes |
| NRS Director | `createProcessMediaTool` → pipeline | When Director runs `process_media` as part of a delegated task |
| Backfill / admin | `scripts/run-pipeline.ts` | One-off backfills via tsx + service role |

**Both user-facing paths now land in the same code.** There is no second pipeline.

## The three stages

### Stage 1 — Thumbnail (videos only)
Uses `extractFirstFrameFromUrl(videoUrl)` from `src/lib/video/ffmpeg-thumbnail.ts`.
- Runs `ffmpeg -ss 1 -i <https-url> -frames:v 1 -vf scale=720:-1 -q:v 3`
- `-ss` before `-i` = fast-seek, streams only the bytes needed to decode frame 1
- Memory cost: tens of KB regardless of file size (safe for 500MB Vercel serverless)
- Hard 30s kill timeout on the process, 15s rw_timeout on the input socket
- **Skipped** if `thumbnail_url` already populated OR file > 500MB

### Stage 2 — Transcription (video/audio only)
Uses `transcribeFile(fileUrl, fileName, fileSize)` from `src/lib/transcription/transcribe.ts`.
- Layer 1: Deepgram nova-2 URL mode (no file download into Vercel memory, any size)
- Layer 2: OpenAI Whisper fallback (only for files < 25MB, requires download)
- Persists to `media_items.transcription`, `transcription_model`, `transcription_status`, `duration_seconds`
- **Skipped** if `transcription` already populated OR file > 100MB (manual trigger required)

### Stage 3 — AI tagging + description
- Images: Claude vision via `generateAITagsForImage(fileUrl, brand)`
- Video/audio: transcript analysis via `generateAITagsFromTranscript(text, brand)`
- Persists to `media_items.ai_description` and extends `tags` array
- Uses AI Gateway (`anthropic/claude-haiku-4-5-20251001`) — auto-injected on Vercel
- **Skipped** if no transcript available for video/audio

## What gets persisted

After a successful run, the `media_items` row looks like:

```sql
thumbnail_url:        https://.../file_thumb.jpg  -- if video
transcription:        "Full text of the transcript..."
transcription_model:  "deepgram-nova-2"
transcription_status: "transcribed"
duration_seconds:     143.03
ai_description:       "Brief AI-written summary"
tags:                 ["deterministic","tags","+ai-tags"]
metadata.processing: {
  thumbnail:     { status: "ok", duration_ms: 1234 },
  transcription: { status: "ok", duration_ms: 9922 },
  ai:            { status: "ok", duration_ms: 2100 },
  completed_at:  "2026-04-10T00:00:16.248Z"
}
```

`metadata.processing.captions` is appended separately by the Director's `process_media` tool after Stage 3 completes.

## Error handling contract

- **Stage failures are never fatal** — other stages continue
- Stage errors live in `metadata.processing.<stage>.error` (string, human-readable)
- Only fatal failure is a DB write error at the final `media_items.update(...)` step
- Caller can inspect `result.success` (bool) and `result.report` (full per-stage breakdown)

## The bug this fixed

Before 2026-04-10, the Director's `process_media` tool had its own mini-pipeline at `src/lib/agents/tools/process-media.ts`. It transcribed successfully but wrote:

```ts
.update({
  transcription: result.text,
  transcription_model: result.model,
  duration_seconds: result.duration ?? null,
  status: 'transcribed',          // ← column does not exist
})
```

**PostgREST rejects the entire update with PGRST204 when any column is unknown.** The transcription write was silently dropped even though the tool returned `success: true` with a transcript snippet in the response body. Calling the tool via MCP from Claude Code produced a transcript to read but left `media_items.transcription = null`.

Fixed by deleting the tool's custom write code entirely and having it delegate to `runMediaProcessingPipeline`. The shared pipeline only writes to real schema columns.

**Schema reminder** — `media_items` has `transcription_status` but **no `status` column**. Any new tool that tries to set `status` will silently wipe its entire update.

## Related files

- `src/lib/media/process-pipeline.ts` — the function
- `src/app/api/media/process/route.ts` — HTTP wrapper (thin, ~50 lines)
- `src/lib/agents/tools/process-media.ts` — Director tool (delegates + adds captions/drafts)
- `src/lib/video/ffmpeg-thumbnail.ts` — `extractFirstFrame` (buffer) + `extractFirstFrameFromUrl` (streaming)
- `src/lib/transcription/transcribe.ts` — 2-layer Deepgram/Whisper
- `src/lib/media/auto-tagger.ts` — deterministic + AI tags
- `scripts/run-pipeline.ts` — CLI runner via tsx
- `scripts/verify-media-state.mjs` — dump full row state
- `scripts/backfill-media-processing.mjs` — system-ffmpeg backfill for legacy rows

## The other bug this fixed (same session)

MediaUploader.tsx used to call `extractFramesFromVideo(file, 1)` client-side BEFORE uploading, as a blocking `await`. CleanShot macOS screen recordings (MOV container with uncommon moov atoms) can make Chrome's `<video>` element hang on `loadedmetadata` forever. No overall timeout existed, so the entire upload was parked forever waiting on a cosmetic thumbnail.

Fix: deleted client-side frame extraction from the upload path. Thumbnails are now server-side only via the pipeline. Upload starts immediately, bytes flow, thumbnail lands a few seconds later via the background process call.

Incidentally also added a defensive 10s overall timeout to `extract-frames-browser.ts` for the two other places it's still used (`VideoImportPanel`, `VideoEditPanel` — visual analysis feature, not upload).

## Cross-project value

The URL-streaming ffmpeg thumbnail pattern (`ffmpeg -ss 1 -i <https-url>`) generalises to any project doing media processing on serverless with memory limits. Saves hundreds of MB of RAM and avoids the "download whole file into Vercel" trap.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]
