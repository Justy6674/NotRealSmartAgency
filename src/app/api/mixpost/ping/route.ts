import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pingMixpost } from '@/lib/mixpost/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const ok = await pingMixpost()

  return NextResponse.json({ status: ok ? 'ok' : 'unreachable' })
}
