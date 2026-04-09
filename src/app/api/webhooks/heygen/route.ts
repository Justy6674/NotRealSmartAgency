export const maxDuration = 300 // video download + rehost + thumbnail can take time
export const runtime = 'nodejs' // ffmpeg-static requires node runtime, not edge

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractFirstFrame } from '@/lib/video/ffmpeg-thumbnail'

/**
 * Download the HeyGen video, re-host it in Supabase Storage, extract a thumbnail,
 * and insert into media_items so it appears in the Creator's media library.
 *
 * HeyGen CDN URLs expire after ~1 week — without rehosting, any video we
 * "remember" would die shortly after being made. This is why nothing worked
 * before: HeyGen videos never made it into media_items.
 */
async function rehostHeyGenVideo(
  supabase: ReturnType<typeof createAdminClient>,
  outputRow: { id: string; user_id: string; brand_id: string },
  videoUrl: string,
  heygenJobId: string,
): Promise<void> {
  try {
    // 1. Download the video from HeyGen's CDN
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      console.error(`[heygen-webhook] Failed to fetch video: ${videoRes.status}`)
      return
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

    // 2. Upload the video to Supabase Storage
    const timestamp = Date.now()
    const videoPath = `${outputRow.user_id}/${outputRow.brand_id}/heygen_${heygenJobId}_${timestamp}.mp4`
    const { error: videoUploadError } = await supabase.storage
      .from('media')
      .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: false })

    if (videoUploadError) {
      console.error(`[heygen-webhook] Video storage upload failed:`, videoUploadError)
      return
    }

    const { data: videoUrlData } = supabase.storage.from('media').getPublicUrl(videoPath)

    // 3. Extract first frame as thumbnail (server-side ffmpeg)
    let thumbnailUrl: string | null = null
    try {
      const thumbBuffer = await extractFirstFrame(videoBuffer, `heygen_${heygenJobId}.mp4`)
      const thumbPath = `${outputRow.user_id}/${outputRow.brand_id}/heygen_${heygenJobId}_${timestamp}_thumb.jpg`
      const { error: thumbError } = await supabase.storage
        .from('media')
        .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: false })
      if (!thumbError) {
        const { data: thumbUrlData } = supabase.storage.from('media').getPublicUrl(thumbPath)
        thumbnailUrl = thumbUrlData.publicUrl
      }
    } catch (thumbErr) {
      console.error('[heygen-webhook] Thumbnail extraction failed (non-fatal):', thumbErr)
    }

    // 4. Insert into media_items so the video appears in Creator's library
    const { error: mediaInsertError } = await supabase.from('media_items').insert({
      user_id: outputRow.user_id,
      brand_id: outputRow.brand_id,
      file_url: videoUrlData.publicUrl,
      thumbnail_url: thumbnailUrl,
      file_name: `HeyGen video ${new Date().toLocaleDateString('en-AU')}.mp4`,
      file_type: 'video/mp4',
      file_size_bytes: videoBuffer.length,
      transcription_status: 'transcribed',
      metadata: {
        source: 'heygen',
        heygen_job_id: heygenJobId,
        outputs_id: outputRow.id,
        original_url: videoUrl,
      },
    })

    if (mediaInsertError) {
      console.error('[heygen-webhook] media_items insert failed:', mediaInsertError)
    }
  } catch (err) {
    console.error('[heygen-webhook] rehostHeyGenVideo failed:', err)
  }
}

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
        .select('id, user_id, brand_id')
        .eq('metadata->>job_id', videoId)
        .limit(1)

      if (outputs?.length) {
        const outputRow = outputs[0]
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
          .eq('id', outputRow.id)

        // NEW: rehost the video and register it in media_items so the Creator
        // can pick it up. HeyGen URLs expire; without this the video dies.
        if (videoUrl && outputRow.user_id && outputRow.brand_id) {
          await rehostHeyGenVideo(supabase, outputRow, videoUrl, videoId)
        }
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

  // Handle translation completion (also rehost into media_items)
  if (eventType === 'video_translate.success') {
    const translateId = eventData.video_translate_id
    const videoUrl = eventData.url

    if (translateId) {
      const { data: outputs } = await supabase
        .from('outputs')
        .select('id, user_id, brand_id')
        .eq('metadata->>job_id', translateId)
        .limit(1)

      if (outputs?.length) {
        const outputRow = outputs[0]
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
          .eq('id', outputRow.id)

        if (videoUrl && outputRow.user_id && outputRow.brand_id) {
          await rehostHeyGenVideo(supabase, outputRow, videoUrl, translateId)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
