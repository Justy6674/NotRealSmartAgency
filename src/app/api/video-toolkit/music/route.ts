import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMusic } from '@/lib/video-toolkit/client'
import { z } from 'zod/v3'

const MusicSchema = z.object({
  prompt: z.string().min(1).max(2000),
  duration: z.number().int().min(5).max(180).default(30),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = MusicSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )

  try {
    const result = await generateMusic(parsed.data.prompt, parsed.data.duration)
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Music generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
