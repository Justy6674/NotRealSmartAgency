import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVoiceover, SPEAKERS } from '@/lib/video-toolkit/client'
import { z } from 'zod/v3'

const VoiceoverSchema = z.object({
  text: z.string().min(1).max(5000),
  speaker: z.enum(SPEAKERS).default('Ryan'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = VoiceoverSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )

  try {
    const result = await generateVoiceover(parsed.data.text, parsed.data.speaker)
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Voiceover generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
