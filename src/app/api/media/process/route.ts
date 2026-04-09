export const maxDuration = 120
export const runtime = 'nodejs' // ffmpeg-static requires Node runtime

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import { transcribeFile } from '@/lib/transcription/transcribe'
import { extractFirstFrameFromUrl } from '@/lib/video/ffmpeg-thumbnail'
import {
  generateDeterministicTags,
  generateAITagsForImage,
  generateAITagsFromTranscript,
  guessTagCategory,
} from '@/lib/media/auto-tagger'

const ProcessSchema = z.object({
  mediaItemId: z.string().uuid(),
})

const AUTO_TRANSCRIBE_MAX_SIZE = 100 * 1024 * 1024 // 100MB — auto-transcribe threshold
const THUMBNAIL_MAX_SIZE = 500 * 1024 * 1024         // 500MB — skip thumb on absurdly large files

type StageStatus = 'ok' | 'failed' | 'skipped'
interface StageReport {
  status: StageStatus
  error?: string
  duration_ms?: number
}
interface ProcessingReport {
  thumbnail: StageReport
  transcription: StageReport
  ai: StageReport
  completed_at: string
}

async function runStage<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T; duration_ms: number } | { ok: false; error: string; duration_ms: number }> {
  const start = Date.now()
  try {
    const value = await fn()
    return { ok: true, value, duration_ms: Date.now() - start }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), duration_ms: Date.now() - start }
  }
}

/**
 * Background media processing pipeline.
 * Called fire-and-forget from MediaUploader after successful upload.
 *
 * Pipeline:
 * 1. Fetch media item + brand context
 * 2. For images: AI vision → description + tags
 * 3. For video/audio <100MB: Deepgram URL transcription → AI tags from transcript
 * 4. For video/audio >100MB: deterministic tags only (user can manually transcribe)
 * 5. Upsert all tags into media_tags structured table
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = ProcessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { mediaItemId } = parsed.data

  // Fetch media item
  const { data: mediaItem, error: fetchError } = await supabase
    .from('media_items')
    .select('*')
    .eq('id', mediaItemId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  // Fetch brand context
  const { data: brand } = await supabase
    .from('brands')
    .select('name, niche, content_pillars, compliance_flags, description, target_audience')
    .eq('id', mediaItem.brand_id)
    .single()

  const isImage = (mediaItem.file_type as string).startsWith('image/')
  const isVideo = (mediaItem.file_type as string).startsWith('video/')
  const isAudio = (mediaItem.file_type as string).startsWith('audio/')
  const isVideoOrAudio = isVideo || isAudio
  const fileSize = mediaItem.file_size_bytes ?? 0

  const updates: Record<string, unknown> = {}
  let allTags: string[] = [...(mediaItem.tags ?? [])]
  const report: ProcessingReport = {
    thumbnail: { status: 'skipped' },
    transcription: { status: 'skipped' },
    ai: { status: 'skipped' },
    completed_at: '',
  }

  // ── Step 0: Deterministic tags (always, can't fail) ──────────────────────
  const deterministicTags = generateDeterministicTags(
    brand,
    mediaItem.file_type,
    mediaItem.file_name
  )
  allTags = [...new Set([...allTags, ...deterministicTags])]

  // ── Step 1: Thumbnail (videos only, server-side ffmpeg, streams from URL) ─
  if (isVideo && !mediaItem.thumbnail_url && fileSize < THUMBNAIL_MAX_SIZE) {
    const result = await runStage(async () => {
      const thumbBuffer = await extractFirstFrameFromUrl(mediaItem.file_url)

      // Derive thumbnail storage path from the main file's storage path.
      // Main path format: ${user.id}/${brand_id}/${timestamp}_${filename}
      // Thumb path:       ${user.id}/${brand_id}/${timestamp}_${filename}_thumb.jpg
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
      console.log(`[process:${mediaItemId}] thumbnail ok in ${result.duration_ms}ms`)
    } else {
      report.thumbnail = { status: 'failed', error: result.error, duration_ms: result.duration_ms }
      console.error(`[process:${mediaItemId}] thumbnail failed after ${result.duration_ms}ms: ${result.error}`)
    }
  } else if (isVideo && fileSize >= THUMBNAIL_MAX_SIZE) {
    report.thumbnail = { status: 'skipped', error: 'file too large (>500MB)' }
  } else if (isVideo && mediaItem.thumbnail_url) {
    report.thumbnail = { status: 'skipped', error: 'already has thumbnail' }
  }

  // ── Step 2: Transcription / AI ───────────────────────────────────────────
  if (isImage) {
    // Images: Claude vision for description + tags
    const result = await runStage(async () => {
      const aiResult = await generateAITagsForImage(mediaItem.file_url, brand!)
      return aiResult
    })
    if (result.ok) {
      if (result.value.description) updates.ai_description = result.value.description
      if (result.value.tags.length) allTags = [...new Set([...allTags, ...result.value.tags])]
      updates.transcription_status = 'transcribed'
      report.ai = { status: 'ok', duration_ms: result.duration_ms }
      console.log(`[process:${mediaItemId}] ai vision ok in ${result.duration_ms}ms`)
    } else {
      report.ai = { status: 'failed', error: result.error, duration_ms: result.duration_ms }
      console.error(`[process:${mediaItemId}] ai vision failed: ${result.error}`)
    }
  } else if (isVideoOrAudio && fileSize < AUTO_TRANSCRIBE_MAX_SIZE) {
    // Small video/audio: auto-transcribe + AI tags from transcript
    updates.transcription_status = 'transcribing'
    await supabase
      .from('media_items')
      .update({ transcription_status: 'transcribing' })
      .eq('id', mediaItemId)

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
      console.log(`[process:${mediaItemId}] transcription ok in ${transcriptionResult.duration_ms}ms`)

      // AI tags from transcript (separate stage)
      if (transcription.text && brand) {
        const aiResult = await runStage(async () => {
          return await generateAITagsFromTranscript(transcription.text, brand)
        })
        if (aiResult.ok) {
          if (aiResult.value.description) updates.ai_description = aiResult.value.description
          if (aiResult.value.tags.length) allTags = [...new Set([...allTags, ...aiResult.value.tags])]
          report.ai = { status: 'ok', duration_ms: aiResult.duration_ms }
        } else {
          report.ai = { status: 'failed', error: aiResult.error, duration_ms: aiResult.duration_ms }
          console.error(`[process:${mediaItemId}] ai transcript analysis failed: ${aiResult.error}`)
        }
      }
    } else {
      updates.transcription_status = 'failed'
      report.transcription = { status: 'failed', error: transcriptionResult.error, duration_ms: transcriptionResult.duration_ms }
      console.error(`[process:${mediaItemId}] transcription failed after ${transcriptionResult.duration_ms}ms: ${transcriptionResult.error}`)
    }
  } else if (isVideoOrAudio) {
    // Large video/audio: skip transcription, deterministic tags only
    updates.transcription_status = 'pending'
    report.transcription = { status: 'skipped', error: 'file too large (>100MB) — manual transcription only' }
  }

  // ── Step 3: Persist tags + per-stage report to metadata ──────────────────
  report.completed_at = new Date().toISOString()
  updates.tags = allTags
  updates.metadata = {
    ...(mediaItem.metadata ?? {}),
    processing: report,
  }

  const { error: updateError } = await supabase
    .from('media_items')
    .update(updates)
    .eq('id', mediaItemId)

  if (updateError) {
    console.error(`[process:${mediaItemId}] final update failed: ${updateError.message}`)
    return NextResponse.json(
      { error: `DB update failed: ${updateError.message}`, report },
      { status: 500 }
    )
  }

  // ── Step 4: Ensure tags exist in structured media_tags table ─────────────
  if (brand && allTags.length) {
    const tagInserts = allTags.map(tag => ({
      user_id: user.id,
      name: tag,
      brand_id: mediaItem.brand_id,
      category: guessTagCategory(tag),
      colour: '#6366f1',
    }))
    await supabase
      .from('media_tags')
      .upsert(tagInserts, { onConflict: 'user_id,name,brand_id', ignoreDuplicates: true })
  }

  return NextResponse.json({
    success: true,
    tags: allTags,
    thumbnail_url: updates.thumbnail_url ?? mediaItem.thumbnail_url ?? null,
    ai_description: updates.ai_description ?? null,
    transcription_status: updates.transcription_status ?? null,
    report,
  })
}
