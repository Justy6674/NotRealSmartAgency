import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostMedia } from '@/lib/mixpost/client'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined

  const media = await fetchMixpostMedia(page)

  if (!media) {
    return NextResponse.json({ error: 'Mixpost not configured or unavailable' }, { status: 502 })
  }

  return NextResponse.json(media)
}
