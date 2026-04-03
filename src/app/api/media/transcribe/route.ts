export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import { transcribeFile } from '@/lib/transcription/transcribe'

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

  try {
    const result = await transcribeFile(mediaItem.file_url, mediaItem.file_name)

    // Update media item with transcription
    const { data: updated, error: updateError } = await supabase
      .from('media_items')
      .update({
        transcription: result.text,
        transcription_model: result.model,
        transcription_status: 'transcribed',
        duration_seconds: result.duration ?? null,
      })
      .eq('id', mediaItemId)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ transcription: result.text, model: result.model, mediaItem: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed'

    await supabase
      .from('media_items')
      .update({ transcription_status: 'failed', metadata: { error: message } })
      .eq('id', mediaItemId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
