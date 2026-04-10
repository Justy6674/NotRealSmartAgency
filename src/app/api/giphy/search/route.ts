import { NextResponse } from 'next/server'

const GIPHY_PUBLIC_BETA_KEY = 'dc6zaTOxFJmzC'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)

  const apiKey = process.env.GIPHY_API_KEY || GIPHY_PUBLIC_BETA_KEY

  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`

  try {
    const res = await fetch(endpoint, { next: { revalidate: 300 } })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from Giphy', details: res.statusText },
        { status: res.status }
      )
    }

    const json = await res.json()

    const gifs = (json.data ?? []).map(
      (g: {
        id: string
        title: string
        images: {
          original: { url: string; width: string; height: string }
          fixed_width_small: { url: string }
        }
      }) => ({
        id: g.id,
        title: g.title,
        url: g.images.original.url,
        preview: g.images.fixed_width_small.url,
        width: Number(g.images.original.width),
        height: Number(g.images.original.height),
      })
    )

    return NextResponse.json(gifs)
  } catch (err) {
    return NextResponse.json(
      { error: 'Giphy request failed', details: String(err) },
      { status: 500 }
    )
  }
}
