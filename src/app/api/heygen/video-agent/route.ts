import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, generateVideoAgent } from '@/lib/heygen/client'

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
      { error: 'HeyGen not configured' },
      { status: 400 }
    )

  const body = await request.json()
  const result = await generateVideoAgent(apiKey, body)
  if (!result)
    return NextResponse.json(
      { error: 'Video generation failed' },
      { status: 500 }
    )

  return NextResponse.json(result)
}
