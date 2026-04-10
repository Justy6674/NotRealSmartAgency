import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const token = process.env.BITLY_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({
      error: 'Bitly not configured. Add BITLY_ACCESS_TOKEN in Settings.',
    })
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const longUrl = body.url?.trim()
  if (!longUrl) {
    return NextResponse.json({ error: 'Missing url field' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ long_url: longUrl }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: 'Bitly API error',
          details: (err as Record<string, unknown>).message ?? res.statusText,
        },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json({
      short_url: data.link,
      long_url: data.long_url,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Bitly request failed', details: String(err) },
      { status: 500 }
    )
  }
}
