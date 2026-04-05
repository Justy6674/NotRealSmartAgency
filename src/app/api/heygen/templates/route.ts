import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchTemplates } from '@/lib/heygen/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json({ templates: [], configured: false })

  try {
    const templates = await fetchTemplates(apiKey)
    return NextResponse.json(
      { templates, configured: true },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch {
    return NextResponse.json({
      templates: [],
      configured: true,
      error: 'Failed to load templates',
    })
  }
}
