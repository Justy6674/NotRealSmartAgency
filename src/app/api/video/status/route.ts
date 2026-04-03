import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'

const CheckStatusSchema = z.object({
  video_output_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = CheckStatusSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { video_output_id } = parsed.data

  const { data: output, error: outputError } = await supabase
    .from('outputs')
    .select('*')
    .eq('id', video_output_id)
    .single()

  if (outputError || !output) {
    return NextResponse.json({ error: 'Video output not found' }, { status: 404 })
  }

  const metadata = (output.metadata || {}) as Record<string, unknown>
  const jobId = metadata.job_id as string | undefined
  const provider = metadata.provider as string | undefined

  if (!jobId || metadata.status === 'completed') {
    return NextResponse.json({ status: metadata.status, output })
  }

  // Fetch provider API key for status check
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', user.id)
    .eq('provider', provider || 'heygen')
    .single()

  const apiKey = integration?.cached_data?.api_key as string | undefined

  let videoUrl: string | null = null
  let videoStatus: string = 'processing'

  // Real provider status polling
  if (provider === 'heygen' && apiKey && !jobId.startsWith('mock-')) {
    try {
      const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`, {
        headers: { 'X-Api-Key': apiKey },
      })
      if (res.ok) {
        const data = await res.json()
        const status = data.data?.status
        if (status === 'completed') {
          videoUrl = data.data?.video_url
          videoStatus = 'completed'
        } else if (status === 'failed') {
          videoStatus = 'failed'
        } else {
          // Still processing
          return NextResponse.json({ status: 'processing', output })
        }
      }
    } catch (err) {
      console.error('[video-status] HeyGen poll failed:', err)
      return NextResponse.json({ status: 'processing', output })
    }
  } else {
    // Mock jobs or missing API key — mark as failed with guidance
    videoStatus = 'failed'
  }

  const updatedMetadata = {
    ...metadata,
    status: videoStatus,
    ...(videoUrl && { video_url: videoUrl }),
  }

  const content = videoStatus === 'completed'
    ? `Video generated successfully via ${provider}. URL: ${videoUrl}`
    : videoStatus === 'failed'
    ? `Video generation failed. Check your ${provider} API key in Brand Settings → Video tab.`
    : `Video still processing via ${provider}...`

  const { data: updatedOutput, error: updateError } = await supabase
    .from('outputs')
    .update({ metadata: updatedMetadata, content })
    .eq('id', video_output_id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ status: videoStatus, output: updatedOutput })
}
