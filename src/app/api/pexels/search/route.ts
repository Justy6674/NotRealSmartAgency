import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Pexels API key not configured' })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const perPage = Math.min(Number(searchParams.get('per_page') ?? '20'), 80)

  const endpoint = q
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}`
    : `https://api.pexels.com/v1/curated?per_page=${perPage}`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: apiKey },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from Pexels', details: res.statusText },
        { status: res.status }
      )
    }

    const json = await res.json()

    const photos = (json.photos ?? []).map(
      (p: {
        id: number
        src: { large: string; medium: string }
        photographer: string
        alt: string
        width: number
        height: number
      }) => ({
        id: p.id,
        url: p.src.large,
        preview: p.src.medium,
        photographer: p.photographer,
        alt: p.alt,
        width: p.width,
        height: p.height,
      })
    )

    return NextResponse.json(photos)
  } catch (err) {
    return NextResponse.json(
      { error: 'Pexels request failed', details: String(err) },
      { status: 500 }
    )
  }
}
