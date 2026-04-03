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

  // TODO: Replace with real provider status polling
  // e.g. fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`)
  // For MVP, mock-complete the video immediately
  const mockUrl = 'https://www.w3schools.com/html/mov_bbb.mp4'

  const updatedMetadata = {
    ...metadata,
    status: 'completed',
    video_url: mockUrl,
  }

  const { data: updatedOutput, error: updateError } = await supabase
    .from('outputs')
    .update({
      metadata: updatedMetadata,
      content: `Video generated successfully via ${provider}. URL: ${mockUrl}`,
    })
    .eq('id', video_output_id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ status: 'completed', output: updatedOutput })
}
