export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import { transcribeFile } from '@/lib/transcription/transcribe'
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
  const isVideoOrAudio = !isImage
  const fileSize = mediaItem.file_size_bytes ?? 0

  const updates: Record<string, unknown> = {}
  let allTags: string[] = [...(mediaItem.tags ?? [])]

  try {
    // ── Step 1: Deterministic tags (always) ──────────────────────────────────
    const deterministicTags = generateDeterministicTags(
      brand,
      mediaItem.file_type,
      mediaItem.file_name
    )
    allTags = [...new Set([...allTags, ...deterministicTags])]

    // ── Step 2: AI processing ────────────────────────────────────────────────

    if (isImage) {
      // Images: Claude vision for description + tags
      try {
        const aiResult = await generateAITagsForImage(mediaItem.file_url, brand!)
        if (aiResult.description) updates.ai_description = aiResult.description
        if (aiResult.tags.length) allTags = [...new Set([...allTags, ...aiResult.tags])]
        updates.transcription_status = 'transcribed' // images don't need audio transcription
      } catch (err) {
        console.error('[auto-tag] AI vision failed:', err)
        // Non-fatal — keep deterministic tags
      }
    } else if (isVideoOrAudio && fileSize < AUTO_TRANSCRIBE_MAX_SIZE) {
      // Small video/audio: auto-transcribe + AI tags from transcript
      try {
        updates.transcription_status = 'transcribing'
        await supabase
          .from('media_items')
          .update({ transcription_status: 'transcribing' })
          .eq('id', mediaItemId)

        const transcription = await transcribeFile(
          mediaItem.file_url,
          mediaItem.file_name,
          fileSize
        )

        updates.transcription = transcription.text
        updates.transcription_model = transcription.model
        updates.transcription_status = 'transcribed'
        if (transcription.duration) updates.duration_seconds = transcription.duration

        // AI tags from transcript
        if (transcription.text && brand) {
          try {
            const aiResult = await generateAITagsFromTranscript(transcription.text, brand)
            if (aiResult.description) updates.ai_description = aiResult.description
            if (aiResult.tags.length) allTags = [...new Set([...allTags, ...aiResult.tags])]
          } catch (err) {
            console.error('[auto-tag] AI transcript analysis failed:', err)
          }
        }
      } catch (err) {
        console.error('[process] Transcription failed:', err)
        updates.transcription_status = 'failed'
        updates.metadata = {
          ...(mediaItem.metadata ?? {}),
          transcription_error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    } else if (isVideoOrAudio) {
      // Large video/audio: skip transcription, deterministic tags only
      // User can manually trigger transcription later
      updates.transcription_status = 'pending'
    }

    // ── Step 3: Save tags + updates ──────────────────────────────────────────
    updates.tags = allTags

    await supabase
      .from('media_items')
      .update(updates)
      .eq('id', mediaItemId)

    // ── Step 4: Ensure tags exist in structured media_tags table ─────────────
    if (brand && allTags.length) {
      const tagInserts = allTags.map(tag => ({
        user_id: user.id,
        name: tag,
        brand_id: mediaItem.brand_id,
        category: guessTagCategory(tag),
        colour: '#6366f1',
      }))

      // Upsert — ignore conflicts (tag already exists)
      await supabase
        .from('media_tags')
        .upsert(tagInserts, { onConflict: 'user_id,name,brand_id', ignoreDuplicates: true })
    }

    return NextResponse.json({
      success: true,
      tags: allTags,
      ai_description: updates.ai_description ?? null,
      transcription_status: updates.transcription_status ?? null,
    })
  } catch (error) {
    console.error('[process] Pipeline error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
