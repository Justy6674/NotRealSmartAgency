import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostTemplates, createMixpostTemplate } from '@/lib/mixpost/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const templates = await fetchMixpostTemplates()
  if (!templates) {
    return NextResponse.json({ error: 'Cannot reach Mixpost' }, { status: 502 })
  }

  return NextResponse.json({ templates, count: templates.length })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { name, content } = body as { name?: string; content?: string }

  if (!name || !content) {
    return NextResponse.json(
      { error: 'name and content are required' },
      { status: 400 }
    )
  }

  const template = await createMixpostTemplate(name, [{ body: content, media: [] }])
  if (!template) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 502 })
  }

  return NextResponse.json({ template }, { status: 201 })
}
