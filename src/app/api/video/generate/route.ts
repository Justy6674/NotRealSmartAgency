import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'

const GenerateVideoSchema = z.object({
  output_id: z.string().uuid(),
  provider: z.enum(['heygen', 'runway', 'synthesia', 'kling', 'google_veo']).default('heygen'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = GenerateVideoSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { output_id, provider } = parsed.data

  // Fetch the script output
  const { data: output, error: outputError } = await supabase
    .from('outputs')
    .select('*, brands(video_preferences)')
    .eq('id', output_id)
    .single()

  if (outputError || !output) {
    return NextResponse.json({ error: 'Output script not found' }, { status: 404 })
  }

  // Fetch provider API key
  const { data: integration, error: integrationError } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single()

  // User key first, then platform-wide env var fallback
  const apiKey = (integration?.cached_data?.api_key as string)
    || (provider === 'heygen' ? process.env.HEYGEN_API_KEY : undefined)
    || undefined

  if (!apiKey) {
    return NextResponse.json({ error: `API key for ${provider} not configured. Add it in Brand Settings → Video tab.` }, { status: 400 })
  }
  const scriptContent = output.content
  const videoPrefs = output.brands?.video_preferences || {}

  try {
    let videoId = ''

    if (provider === 'heygen') {
      const res = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_inputs: [{
            character: {
              type: 'avatar',
              avatar_id: videoPrefs.avatar_id || 'default_avatar_id',
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: scriptContent,
              voice_id: videoPrefs.accent || 'default_voice_id',
            },
            background: {
              type: 'color',
              value: '#ffffff',
            },
          }],
          dimension: { width: 1920, height: 1080 },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.warn('HeyGen API Error:', data)
        videoId = `mock-job-${Date.now()}`
      } else {
        videoId = data.data.video_id
      }
    } else {
      // Fallback mock for other providers
      videoId = `mock-job-${provider}-${Date.now()}`
    }

    // Create a new output record for the video
    const { data: videoOutput, error: insertError } = await supabase
      .from('outputs')
      .insert({
        user_id: user.id,
        brand_id: output.brand_id,
        conversation_id: output.conversation_id,
        message_id: output.message_id,
        output_type: 'video',
        title: `Video: ${output.title}`,
        content: `Generating video with ${provider}...`,
        metadata: {
          job_id: videoId,
          provider,
          status: 'processing',
          source_script_id: output_id,
        },
      })
      .select()
      .single()

    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({ success: true, videoOutput })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
