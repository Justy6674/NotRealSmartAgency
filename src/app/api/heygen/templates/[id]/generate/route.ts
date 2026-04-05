import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, generateFromTemplate } from '@/lib/heygen/client'

export async function POST(
  request: Request,
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
    const { variables, title } = await request.json()

    if (!variables || typeof variables !== 'object') {
      return NextResponse.json(
        { error: 'variables object is required' },
        { status: 400 }
      )
    }

    const result = await generateFromTemplate(apiKey, id, variables, title)

    if (!result) {
      return NextResponse.json(
        { error: 'Template generation failed' },
        { status: 502 }
      )
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate video from template' },
      { status: 500 }
    )
  }
}
