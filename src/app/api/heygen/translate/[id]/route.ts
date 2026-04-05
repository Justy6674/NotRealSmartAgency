import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, getTranslationStatus } from '@/lib/heygen/client'

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
    const result = await getTranslationStatus(apiKey, id)

    if (!result) {
      return NextResponse.json(
        { error: 'Translation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to check translation status' },
      { status: 500 }
    )
  }
}
