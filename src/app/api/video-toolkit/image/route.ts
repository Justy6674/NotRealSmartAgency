import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateImage } from '@/lib/video-toolkit/client'
import { z } from 'zod/v3'

const ImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  width: z.number().int().min(256).max(4096).default(1920),
  height: z.number().int().min(256).max(4096).default(1080),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = ImageSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )

  try {
    const result = await generateImage(
      parsed.data.prompt,
      parsed.data.width,
      parsed.data.height
    )
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Image generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
