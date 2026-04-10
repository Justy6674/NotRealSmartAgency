/**
 * Canonical media processing pipeline.
 *
 * ONE source of truth for: thumbnail generation, transcription, and AI tagging.
 * Writes the structured per-stage report to media_items.metadata.processing so
 * the UI, the Director, and any debugging script see the same state.
 *
 * Called by:
 *   - /api/media/process (HTTP route, fired by MediaUploader after upload)
 *   - src/lib/agents/tools/process-media.ts (Director tool — adds caption
 *     generation on top, but reuses this pipeline for the transcription +
 *     thumbnail + AI tagging work)
 *
 * Guarantees:
 *   - Failures in one stage never cascade to others (each stage is isolated)
 *   - Transcription is persisted to media_items.transcription (fixes the
 *     previous bug where createProcessMediaTool wrote to a non-existent
 *     `status` column, causing the entire update to silently fail)
 *   - The per-stage report lives at metadata.processing and is incrementally
 *     merged — multiple runs can fill in missing stages without clobbering
 *     each other
 *
 * Runs in Node.js runtime only — ffmpeg-static requires it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { transcribeFile } from '@/lib/transcription/transcribe'
import { extractFirstFrameFromUrl } from '@/lib/video/ffmpeg-thumbnail'
import {
  generateDeterministicTags,
  generateAITagsForImage,
  generateAITagsFromTranscript,
  guessTagCategory,
} from '@/lib/media/auto-tagger'

const AUTO_TRANSCRIBE_MAX_SIZE = 100 * 1024 * 1024 // 100MB — auto-transcribe threshold
const THUMBNAIL_MAX_SIZE = 500 * 1024 * 1024 // 500MB — skip thumb on absurdly large files

export type StageStatus = 'ok' | 'failed' | 'skipped'

export interface StageReport {
  status: StageStatus
  error?: string
  duration_ms?: number
}

export interface ProcessingReport {
  thumbnail: StageReport
  transcription: StageReport
  ai: StageReport
  completed_at: string
}

export type ProcessingStage = 'thumbnail' | 'transcription' | 'ai'

async function runStage<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T; duration_ms: number } | { ok: false; error: string; duration_ms: number }> {
  const start = Date.now()
  try {
    const value = await fn()
    return { ok: true, value, duration_ms: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
    }
  }
}

export interface PipelineResult {
  success: boolean
  error?: string
  mediaItemId: string
  tags: string[]
  thumbnail_url: string | null
  transcription: string | null
  transcription_status: string | null
  ai_description: string | null
  report: ProcessingReport
}

/**
 * Run the canonical media processing pipeline for a single media_items row.
 *
 * Works with either a user-scoped Supabase client (from server.ts createClient)
 * or an admin client (from admin.ts createAdminClient). Callers are responsible
 * for whatever authorisation check makes sense in their context — the pipeline
 * itself just operates on the row.
 *
 * Stages can be filtered via `runStages`; default is all three. Thumbnail and
 * transcription stages are both safe to re-run (upsert on storage + conditional
 * transcription), so callers can safely call this multiple times.
 */
export async function runMediaProcessingPipeline({
  supabase,
  mediaItemId,
  runStages,
}: {
  supabase: SupabaseClient
  mediaItemId: string
  runStages?: ProcessingStage[]
}): Promise<PipelineResult> {
  const stages = new Set<ProcessingStage>(runStages ?? ['thumbnail', 'transcription', 'ai'])

  const { data: mediaItem, error: fetchError } = await supabase
    .from('media_items')
    .select('*')
    .eq('id', mediaItemId)
    .single()

  if (fetchError || !mediaItem) {
    return {
      success: false,
      error: `Media item not found: ${fetchError?.message ?? 'no row'}`,
      mediaItemId,
      tags: [],
      thumbnail_url: null,
      transcription: null,
      transcription_status: null,
      ai_description: null,
      report: {
        thumbnail: { status: 'skipped', error: 'fetch failed' },
        transcription: { status: 'skipped', error: 'fetch failed' },
        ai: { status: 'skipped', error: 'fetch failed' },
        completed_at: new Date().toISOString(),
      },
    }
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('name, niche, content_pillars, compliance_flags, description, target_audience, tone_of_voice')
    .eq('id', mediaItem.brand_id)
    .single()

  const isImage = (mediaItem.file_type as string).startsWith('image/')
  const isVideo = (mediaItem.file_type as string).startsWith('video/')
  const isAudio = (mediaItem.file_type as string).startsWith('audio/')
  const isVideoOrAudio = isVideo || isAudio
  const fileSize = mediaItem.file_size_bytes ?? 0

  const updates: Record<string, unknown> = {}
  let allTags: string[] = [...(mediaItem.tags ?? [])]

  // Start from any prior report (merge-don't-clobber).
  const priorReport = (mediaItem.metadata as Record<string, unknown> | null)?.processing as
    | ProcessingReport
    | undefined
  const report: ProcessingReport = {
    thumbnail: priorReport?.thumbnail ?? { status: 'skipped' },
    transcription: priorReport?.transcription ?? { status: 'skipped' },
    ai: priorReport?.ai ?? { status: 'skipped' },
    completed_at: '',
  }

  // ── Step 0: Deterministic tags (always, can't fail) ──────────────────────
  const deterministicTags = generateDeterministicTags(brand, mediaItem.file_type, mediaItem.file_name)
  allTags = [...new Set([...allTags, ...deterministicTags])]

  // ── Step 1: Thumbnail (videos only, server-side ffmpeg, streams from URL) ─
  if (stages.has('thumbnail') && isVideo && !mediaItem.thumbnail_url && fileSize < THUMBNAIL_MAX_SIZE) {
    const result = await runStage(async () => {
      const thumbBuffer = await extractFirstFrameFromUrl(mediaItem.file_url)

      // Derive thumbnail storage path from the main file's storage path.
      const mainUrl = new URL(mediaItem.file_url)
      const pathMatch = mainUrl.pathname.match(/\/storage\/v1\/object\/public\/media\/(.+)$/)
      if (!pathMatch) throw new Error('Could not parse storage path from file_url')
      const mainStoragePath = decodeURIComponent(pathMatch[1])
      const thumbStoragePath = `${mainStoragePath}_thumb.jpg`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(thumbStoragePath, thumbBuffer, {
          contentType: 'image/jpeg',
          upsert: true, // allow re-runs
        })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(thumbStoragePath)
      return publicUrl.publicUrl
    })

    if (result.ok) {
      updates.thumbnail_url = result.value
      report.thumbnail = { status: 'ok', duration_ms: result.duration_ms }
      console.log(`[pipeline:${mediaItemId}] thumbnail ok in ${result.duration_ms}ms`)
    } else {
      report.thumbnail = { status: 'failed', error: result.error, duration_ms: result.duration_ms }
      console.error(`[pipeline:${mediaItemId}] thumbnail failed after ${result.duration_ms}ms: ${result.error}`)
    }
  } else if (stages.has('thumbnail') && isVideo && fileSize >= THUMBNAIL_MAX_SIZE) {
    report.thumbnail = { status: 'skipped', error: 'file too large (>500MB)' }
  } else if (stages.has('thumbnail') && isVideo && mediaItem.thumbnail_url) {
    report.thumbnail = { status: 'skipped', error: 'already has thumbnail' }
  }

  // ── Step 2: Transcription ────────────────────────────────────────────────
  if (stages.has('transcription') && isVideoOrAudio && !mediaItem.transcription && fileSize < AUTO_TRANSCRIBE_MAX_SIZE) {
    updates.transcription_status = 'transcribing'
    await supabase.from('media_items').update({ transcription_status: 'transcribing' }).eq('id', mediaItemId)

    const transcriptionResult = await runStage(async () => {
      return await transcribeFile(mediaItem.file_url, mediaItem.file_name, fileSize)
    })

    if (transcriptionResult.ok) {
      const transcription = transcriptionResult.value
      updates.transcription = transcription.text
      updates.transcription_model = transcription.model
      updates.transcription_status = 'transcribed'
      if (transcription.duration) updates.duration_seconds = transcription.duration
      report.transcription = { status: 'ok', duration_ms: transcriptionResult.duration_ms }
      console.log(`[pipeline:${mediaItemId}] transcription ok in ${transcriptionResult.duration_ms}ms`)
    } else {
      updates.transcription_status = 'failed'
      report.transcription = {
        status: 'failed',
        error: transcriptionResult.error,
        duration_ms: transcriptionResult.duration_ms,
      }
      console.error(
        `[pipeline:${mediaItemId}] transcription failed after ${transcriptionResult.duration_ms}ms: ${transcriptionResult.error}`,
      )
    }
  } else if (stages.has('transcription') && isVideoOrAudio && mediaItem.transcription) {
    report.transcription = { status: 'skipped', error: 'already transcribed' }
  } else if (stages.has('transcription') && isVideoOrAudio && fileSize >= AUTO_TRANSCRIBE_MAX_SIZE) {
    updates.transcription_status = 'pending'
    report.transcription = { status: 'skipped', error: 'file too large (>100MB) — manual transcription only' }
  }

  // ── Step 3: AI analysis (images) or transcript analysis (videos) ────────
  if (stages.has('ai')) {
    if (isImage) {
      const result = await runStage(async () => {
        if (!brand) throw new Error('brand missing')
        return await generateAITagsForImage(mediaItem.file_url, brand)
      })
      if (result.ok) {
        if (result.value.description) updates.ai_description = result.value.description
        if (result.value.tags.length) allTags = [...new Set([...allTags, ...result.value.tags])]
        updates.transcription_status = 'transcribed'
        report.ai = { status: 'ok', duration_ms: result.duration_ms }
        console.log(`[pipeline:${mediaItemId}] ai vision ok in ${result.duration_ms}ms`)
      } else {
        report.ai = { status: 'failed', error: result.error, duration_ms: result.duration_ms }
        console.error(`[pipeline:${mediaItemId}] ai vision failed: ${result.error}`)
      }
    } else if (isVideoOrAudio) {
      // AI transcript analysis — needs a transcription to work with. Use whichever
      // we just produced or was already persisted.
      const transcript =
        (updates.transcription as string | undefined) ?? (mediaItem.transcription as string | null)
      if (transcript && brand) {
        const aiResult = await runStage(async () => {
          return await generateAITagsFromTranscript(transcript, brand)
        })
        if (aiResult.ok) {
          if (aiResult.value.description) updates.ai_description = aiResult.value.description
          if (aiResult.value.tags.length) allTags = [...new Set([...allTags, ...aiResult.value.tags])]
          report.ai = { status: 'ok', duration_ms: aiResult.duration_ms }
        } else {
          report.ai = { status: 'failed', error: aiResult.error, duration_ms: aiResult.duration_ms }
          console.error(`[pipeline:${mediaItemId}] ai transcript analysis failed: ${aiResult.error}`)
        }
      } else if (!transcript) {
        report.ai = { status: 'skipped', error: 'no transcript available' }
      }
    }
  }

  // ── Step 4: Persist tags + per-stage report to metadata ─────────────────
  report.completed_at = new Date().toISOString()
  updates.tags = allTags
  updates.metadata = {
    ...((mediaItem.metadata as Record<string, unknown>) ?? {}),
    processing: report,
  }

  const { error: updateError } = await supabase.from('media_items').update(updates).eq('id', mediaItemId)

  if (updateError) {
    console.error(`[pipeline:${mediaItemId}] final update failed: ${updateError.message}`)
    return {
      success: false,
      error: `DB update failed: ${updateError.message}`,
      mediaItemId,
      tags: allTags,
      thumbnail_url: (updates.thumbnail_url as string) ?? mediaItem.thumbnail_url ?? null,
      transcription: (updates.transcription as string) ?? mediaItem.transcription ?? null,
      transcription_status: (updates.transcription_status as string) ?? mediaItem.transcription_status ?? null,
      ai_description: (updates.ai_description as string) ?? mediaItem.ai_description ?? null,
      report,
    }
  }

  // ── Step 5: Upsert structured media_tags ────────────────────────────────
  if (brand && allTags.length) {
    const tagInserts = allTags.map((tag) => ({
      user_id: mediaItem.user_id,
      name: tag,
      brand_id: mediaItem.brand_id,
      category: guessTagCategory(tag),
      colour: '#6366f1',
    }))
    await supabase
      .from('media_tags')
      .upsert(tagInserts, { onConflict: 'user_id,name,brand_id', ignoreDuplicates: true })
  }

  return {
    success: true,
    mediaItemId,
    tags: allTags,
    thumbnail_url: (updates.thumbnail_url as string) ?? mediaItem.thumbnail_url ?? null,
    transcription: (updates.transcription as string) ?? mediaItem.transcription ?? null,
    transcription_status: (updates.transcription_status as string) ?? mediaItem.transcription_status ?? null,
    ai_description: (updates.ai_description as string) ?? mediaItem.ai_description ?? null,
    report,
  }
}
