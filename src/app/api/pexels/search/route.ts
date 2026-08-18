import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Stock photo search for the media library's Stock tab.
 *
 * THE FAULT THIS CLOSES: an unconfigured deployment answered
 * `{ error: 'Pexels API key not configured' }` with **HTTP 200**. Every caller
 * that checks `res.ok` — which is every sensible caller — read that as a
 * successful search returning a body it could not parse, and rendered an empty
 * grid. Two things were wrong at once: the status lied, and the sentence was
 * written for a developer reading a terminal.
 *
 * Now: a real status code, and a sentence for the person actually looking at
 * the screen. No supplier name, no "API key" — neither is his to fix.
 */

const SIGN_IN_REQUIRED =
  'Please sign in again — your session has expired. Nothing has been changed.'

const NOT_SET_UP =
  'The stock photo library is not switched on for this desk yet, so nothing could be searched. ' +
  'Nothing has been changed — ask us to turn it on.'

const UNAVAILABLE =
  'The stock photo library could not be reached just now. Nothing has been changed. Try again in a moment.'

interface PexelsPhoto {
  id: number
  src: { large: string; medium: string }
  photographer: string
  alt: string
  width: number
  height: number
}

export async function GET(request: Request) {
  // Signed-in only. These proxies spend OUR supplier credential on every call,
  // so an open one is a stranger's loop away from a burnt key and a dark tab
  // with no visible cause. Nothing here is per-tenant data, so the session is
  // the whole check — but it is not optional.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 })
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const perPage = Math.min(Number(searchParams.get('per_page') ?? '20') || 20, 80)

  const endpoint = q
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}`
    : `https://api.pexels.com/v1/curated?per_page=${perPage}`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: apiKey },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error('[pexels/search] upstream rejected', res.status, res.statusText)
      return NextResponse.json(
        { error: res.status === 401 || res.status === 403 ? NOT_SET_UP : UNAVAILABLE },
        { status: 502 },
      )
    }

    const json = (await res.json()) as { photos?: PexelsPhoto[] }

    const photos = (json.photos ?? []).map((p) => ({
      id: p.id,
      url: p.src.large,
      preview: p.src.medium,
      photographer: p.photographer,
      alt: p.alt,
      width: p.width,
      height: p.height,
    }))

    return NextResponse.json(photos)
  } catch (err) {
    console.error('[pexels/search] request failed', err)
    return NextResponse.json({ error: UNAVAILABLE }, { status: 502 })
  }
}
