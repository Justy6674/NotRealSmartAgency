export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import { transcribeFile } from '@/lib/transcription/transcribe'
import { correctBrandName } from '@/lib/transcription/brand-vocabulary'

const TranscribeSchema = z.object({
  mediaItemId: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = TranscribeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
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

  if (mediaItem.transcription_status === 'transcribed') {
    return NextResponse.json({ transcription: mediaItem.transcription, model: mediaItem.transcription_model })
  }

  // Mark as transcribing
  await supabase
    .from('media_items')
    .update({ transcription_status: 'transcribing' })
    .eq('id', mediaItemId)

  // The brand's proper nouns, so the recogniser has heard of them.
  //
  // This path — the Studio Video room's Import and Edit panels — called the
  // transcriber WITHOUT a vocabulary and skipped the repair pass, while the
  // other upload path did both. So the same clip transcribed correctly through
  // Telegram and came back with the brand name mangled through the Studio.
  //
  // It could not self-heal either: the main pipeline skips any file that
  // already has a transcript, so a name mis-heard here was permanent and fed
  // the caption, the tags and the search index from then on.
  const { data: brand } = await supabase
    .from('brands')
    .select('name, name_never')
    .eq('id', mediaItem.brand_id)
    .maybeSingle()

  const vocabulary = brand?.name
    ? {
        canonical: brand.name as string,
        terms: [] as string[],
        never: Array.isArray(brand.name_never) ? (brand.name_never as string[]) : [],
      }
    : undefined

  try {
    const result = await transcribeFile(
      mediaItem.file_url,
      mediaItem.file_name,
      mediaItem.file_size_bytes,
      vocabulary,
    )

    // Repair whatever still slipped through, ONCE, before it is stored —
    // correcting it later at the caption leaves the tags and search wrong.
    const text = vocabulary ? correctBrandName(result.text, vocabulary) : result.text

    // Update media item with transcription
    const { data: updated, error: updateError } = await supabase
      .from('media_items')
      .update({
        transcription: text,
        transcription_model: result.model,
        transcription_status: 'transcribed',
        duration_seconds: result.duration ?? null,
      })
      .eq('id', mediaItemId)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)

    // The repaired text, not the raw one — returning the mangled version here
    // would show the owner a misspelt brand name on screen while the corrected
    // one sat in the database, which is its own kind of wrong.
    return NextResponse.json({ transcription: text, model: result.model, mediaItem: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed'

    await supabase
      .from('media_items')
      .update({ transcription_status: 'failed', metadata: { error: message } })
      .eq('id', mediaItemId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
