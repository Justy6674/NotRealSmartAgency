import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchVoices } from '@/lib/heygen/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json({ voices: [], configured: false })

  try {
    const voices = await fetchVoices(apiKey)
    return NextResponse.json(
      { voices, configured: true },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch {
    return NextResponse.json({
      voices: [],
      configured: true,
      error: 'Failed to load voices',
    })
  }
}
