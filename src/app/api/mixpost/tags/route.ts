import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostTags, createMixpostTag } from '@/lib/mixpost/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const tags = await fetchMixpostTags()

  if (!tags) {
    return NextResponse.json({ error: 'Mixpost not configured or unavailable' }, { status: 502 })
  }

  return NextResponse.json(tags)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { name, hex_color } = await request.json()

  if (!name || !hex_color) {
    return NextResponse.json({ error: 'name and hex_color are required' }, { status: 400 })
  }

  const tag = await createMixpostTag(name, hex_color)

  if (!tag) {
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }

  return NextResponse.json(tag)
}
