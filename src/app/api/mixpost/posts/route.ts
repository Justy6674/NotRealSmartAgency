import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostPosts } from '@/lib/mixpost/client'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? undefined
  const date_from = searchParams.get('date_from') ?? undefined
  const date_to = searchParams.get('date_to') ?? undefined
  const tag_id = searchParams.get('tag_id') ? Number(searchParams.get('tag_id')) : undefined
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined

  const posts = await fetchMixpostPosts({ status, date_from, date_to, tag_id, page })

  if (!posts) {
    return NextResponse.json({ error: 'Mixpost not configured or unavailable' }, { status: 502 })
  }

  return NextResponse.json(posts)
}
