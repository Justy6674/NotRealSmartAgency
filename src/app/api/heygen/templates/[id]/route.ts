import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchTemplate } from '@/lib/heygen/client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey)
    return NextResponse.json(
      { error: 'No HeyGen API key configured' },
      { status: 400 }
    )

  try {
    const { id } = await params
    const template = await fetchTemplate(apiKey, id)

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ template })
  } catch {
    return NextResponse.json(
      { error: 'Failed to load template details' },
      { status: 500 }
    )
  }
}
