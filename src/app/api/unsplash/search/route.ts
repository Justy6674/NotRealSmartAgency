import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * The second stock photo source behind the media library's Stock tab.
 *
 * Same fault as the Pexels route: "not configured" was returned with HTTP 200,
 * so a caller checking `res.ok` treated a switched-off feature as an empty
 * search result. See that file for the full note. The message is written for
 * the owner and names neither the supplier nor a credential.
 */

const SIGN_IN_REQUIRED =
  'Please sign in again — your session has expired. Nothing has been changed.'

const NOT_SET_UP =
  'The stock photo library is not switched on for this desk yet, so nothing could be searched. ' +
  'Nothing has been changed — ask us to turn it on.'

const UNAVAILABLE =
  'The stock photo library could not be reached just now. Nothing has been changed. Try again in a moment.'

interface UnsplashPhoto {
  id: string
  urls: { regular: string; small: string }
  user: { name: string }
  alt_description: string | null
  width: number
  height: number
  links: { download_location: string }
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

  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) {
    return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const perPage = Math.min(Number(searchParams.get('per_page') ?? '20') || 20, 30)

  const endpoint = q
    ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perPage}`
    : `https://api.unsplash.com/photos?order_by=popular&per_page=${perPage}`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error('[unsplash/search] upstream rejected', res.status, res.statusText)
      return NextResponse.json(
        { error: res.status === 401 || res.status === 403 ? NOT_SET_UP : UNAVAILABLE },
        { status: 502 },
      )
    }

    const json = await res.json()

    // The search endpoint wraps in `{ results: [...] }`; the editorial feed
    // returns the array directly.
    const raw: UnsplashPhoto[] = q ? (json.results ?? []) : (json ?? [])

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
    console.error('[unsplash/search] request failed', err)
    return NextResponse.json({ error: UNAVAILABLE }, { status: 502 })
  }
}
