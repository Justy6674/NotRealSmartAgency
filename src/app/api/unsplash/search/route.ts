import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Unsplash API key not configured' })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const perPage = Math.min(Number(searchParams.get('per_page') ?? '20'), 30)

  const endpoint = q
    ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}`
    : `https://api.unsplash.com/photos?order_by=popular&per_page=${perPage}`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from Unsplash', details: res.statusText },
        { status: res.status }
      )
    }

    const json = await res.json()

    // Search endpoint wraps in { results: [...] }, editorial returns array directly
    const raw: Array<{
      id: string
      urls: { regular: string; small: string }
      user: { name: string }
      alt_description: string | null
      width: number
      height: number
      links: { download_location: string }
    }> = q ? json.results ?? [] : json ?? []

    const photos = raw.map((p) => ({
      id: p.id,
      url: p.urls.regular,
      preview: p.urls.small,
      photographer: p.user.name,
      alt: p.alt_description ?? '',
      width: p.width,
      height: p.height,
      download_url: p.links.download_location,
    }))

    return NextResponse.json(photos)
  } catch (err) {
    return NextResponse.json(
      { error: 'Unsplash request failed', details: String(err) },
      { status: 500 }
    )
  }
}
