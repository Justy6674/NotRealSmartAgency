export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyseVideoFrames } from '@/lib/video/visual-analysis'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ mediaItemId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { mediaItemId } = await params

  // Fetch the media item (RLS-protected by user_id)
  const { data: mediaItem, error } = await supabase
    .from('media_items')
    .select('*')
    .eq('id', mediaItemId)
    .eq('user_id', user.id)
    .single()

  if (error || !mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  const frameUrls = (mediaItem.metadata as Record<string, unknown>)?.frame_urls as string[] | undefined
  if (!frameUrls?.length) {
    return NextResponse.json(
      { error: 'No frames available for analysis. Upload frames first.' },
      { status: 400 }
    )
  }

  // Run visual analysis with Claude multimodal
  const analysis = await analyseVideoFrames(frameUrls, mediaItem.transcription, mediaItem.duration_seconds)

  if (!analysis) {
    return NextResponse.json({ error: 'Visual analysis failed' }, { status: 500 })
  }

  // Update media item with analysis results + best thumbnail
  const thumbnailUrl = frameUrls[analysis.thumbnailFrameIndex] ?? frameUrls[0]
  const existingMetadata = (mediaItem.metadata as Record<string, unknown>) ?? {}

  await supabase
    .from('media_items')
    .update({
      metadata: { ...existingMetadata, visual_analysis: analysis, frame_urls: frameUrls },
      thumbnail_url: thumbnailUrl,
    })
    .eq('id', mediaItemId)

  return NextResponse.json({ analysis, thumbnail_url: thumbnailUrl })
}
