import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchCredits } from '@/lib/heygen/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json({ credits: -1, configured: false })

  try {
    const credits = await fetchCredits(apiKey)
    return NextResponse.json(
      { credits, configured: true },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    )
  } catch {
    return NextResponse.json({
      credits: -1,
      configured: true,
      error: 'Failed to load credits',
    })
  }
}
