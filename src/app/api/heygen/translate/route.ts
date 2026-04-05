import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, translateVideo } from '@/lib/heygen/client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json(
      { error: 'No HeyGen API key configured' },
      { status: 400 }
    )

  try {
    const { video_url, target_language, title } = await request.json()

    if (!video_url || !target_language) {
      return NextResponse.json(
        { error: 'video_url and target_language are required' },
        { status: 400 }
      )
    }

    const result = await translateVideo(apiKey, video_url, target_language, title)

    if (!result) {
      return NextResponse.json(
        { error: 'Translation request failed' },
        { status: 502 }
      )
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to start video translation' },
      { status: 500 }
    )
  }
}
