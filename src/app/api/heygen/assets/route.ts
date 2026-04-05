import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHeyGenApiKey, fetchAssets } from '@/lib/heygen/client'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No HeyGen API key configured. Add it in Brand Settings.' },
      { status: 400 }
    )
  }

  try {
    const assets = await fetchAssets(apiKey)
    return NextResponse.json({ assets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch HeyGen assets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = await getHeyGenApiKey(supabase, user.id)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No HeyGen API key configured. Add it in Brand Settings.' },
      { status: 400 }
    )
  }

  const body = await request.json()
  const fileUrl = body?.file_url as string | undefined

  if (!fileUrl) {
    return NextResponse.json(
      { error: 'file_url is required' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch('https://api.heygen.com/assets', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: fileUrl }),
    })

    if (!res.ok) {
      const data = await res.json()
      return NextResponse.json(
        { error: data.message || 'Failed to upload asset to HeyGen' },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json({ success: true, asset: data.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload asset to HeyGen'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
