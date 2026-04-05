import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  // Optional: verify webhook secret if configured
  const secret = request.headers.get('x-heygen-signature')
  if (process.env.HEYGEN_WEBHOOK_SECRET && secret !== process.env.HEYGEN_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const body = await request.json()
  const eventType = body.event_type ?? body.event
  const eventData = body.data ?? body

  const supabase = createAdminClient()

  // Handle video completion events
  if (eventType === 'avatar_video.success' || eventType === 'video.completed') {
    const videoId = eventData.video_id
    const videoUrl = eventData.video_url ?? eventData.url

    if (videoId) {
      const { data: outputs } = await supabase
        .from('outputs')
        .select('id')
        .eq('metadata->>job_id', videoId)
        .limit(1)

      if (outputs?.length) {
        await supabase
          .from('outputs')
          .update({
            metadata: {
              job_id: videoId,
              provider: 'heygen',
              status: 'completed',
              video_url: videoUrl,
            },
            content: videoUrl ? `Video ready: ${videoUrl}` : 'Video completed',
          })
          .eq('id', outputs[0].id)
      }
    }
  }

  // Handle video failure events
  if (eventType === 'avatar_video.fail' || eventType === 'video.failed') {
    const videoId = eventData.video_id
    const error = eventData.error ?? eventData.message ?? 'Video generation failed'

    if (videoId) {
      const { data: outputs } = await supabase
        .from('outputs')
        .select('id')
        .eq('metadata->>job_id', videoId)
        .limit(1)

      if (outputs?.length) {
        await supabase
          .from('outputs')
          .update({
            metadata: {
              job_id: videoId,
              provider: 'heygen',
              status: 'failed',
              error,
            },
          })
          .eq('id', outputs[0].id)
      }
    }
  }

  // Handle translation completion
  if (eventType === 'video_translate.success') {
    const translateId = eventData.video_translate_id
    const videoUrl = eventData.url

    if (translateId) {
      const { data: outputs } = await supabase
        .from('outputs')
        .select('id')
        .eq('metadata->>job_id', translateId)
        .limit(1)

      if (outputs?.length) {
        await supabase
          .from('outputs')
          .update({
            metadata: {
              job_id: translateId,
              provider: 'heygen',
              status: 'completed',
              video_url: videoUrl,
            },
          })
          .eq('id', outputs[0].id)
      }
    }
  }

  return NextResponse.json({ received: true })
}
