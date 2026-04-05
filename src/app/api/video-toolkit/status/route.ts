import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfiguredTools, isToolkitConfigured } from '@/lib/video-toolkit/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  return NextResponse.json({
    configured: isToolkitConfigured(),
    tools: getConfiguredTools(),
  })
}
