import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchAvatars } from '@/lib/heygen/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json({ avatars: [], configured: false })

  try {
    const avatars = await fetchAvatars(apiKey)
    return NextResponse.json(
      { avatars, configured: true },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch {
    return NextResponse.json({
      avatars: [],
      configured: true,
      error: 'Failed to load avatars',
    })
  }
}
