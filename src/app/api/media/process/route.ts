export const maxDuration = 120
export const runtime = 'nodejs' // ffmpeg-static requires Node runtime

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'

const ProcessSchema = z.object({
  mediaItemId: z.string().uuid(),
})

/**
 * Background media processing HTTP endpoint.
 *
 * Called fire-and-forget from MediaUploader after the browser upload completes.
 * This route is a thin wrapper — all real work happens in the shared pipeline
 * at src/lib/media/process-pipeline.ts, which is also used by the Director's
 * process_media tool so both code paths write the same shape to media_items.
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

  // Verify ownership before running — the pipeline itself trusts whoever
  // the supabase client is scoped to, so we check here on the user path.
  const { data: ownership } = await supabase
    .from('media_items')
    .select('id')
    .eq('id', mediaItemId)
    .eq('user_id', user.id)
    .single()
  if (!ownership) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  const result = await runMediaProcessingPipeline({ supabase, mediaItemId })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, report: result.report },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    tags: result.tags,
    thumbnail_url: result.thumbnail_url,
    ai_description: result.ai_description,
    transcription_status: result.transcription_status,
    report: result.report,
  })
}
