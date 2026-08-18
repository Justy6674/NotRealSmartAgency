import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readStockCapability } from './capability'

export const runtime = 'nodejs'

/**
 * The Stock and GIF tabs, behind the sign-in.
 *
 * THE FAULT THIS CLOSES: the three search proxies were open to the world. They
 * take no session, spend OUR search quota on every caller, and sit on public
 * URLs that anybody who has ever loaded the marketing site could hit in a loop
 * until the day's allowance was gone — at which point the tabs go dark for the
 * owner and the cause is invisible from inside the app. The keys are ours to
 * burn, so the door is the fix, not a rate limit on top of an open door.
 *
 * One route for all three suppliers rather than three: the tabs ask the same
 * question, the shapes coming back differ only in where the fields live, and
 * three copies of "is anyone signed in" is three chances to forget one.
 *
 * Attribution is not decoration. Unsplash's terms require the photographer's
 * name to travel with the picture AND a download to be registered when one is
 * used — that second half is a server call carrying our credential, so it lives
 * here (POST below) rather than in the browser, where it silently 401'd.
 *
 * Owner-facing copy names no supplier and no credential. He does not have one
 * and cannot get one; the person who can is us.
 */

const GIF_NOT_SET_UP =
  'The GIF library is not switched on for this desk yet, so nothing could be searched. ' +
  'Nothing has been changed — ask us to turn it on.'
const GIF_UNAVAILABLE =
  'The GIF library could not be reached just now. Nothing has been changed. Try again in a moment.'
const PHOTO_NOT_SET_UP =
  'The stock photo library is not switched on for this desk yet, so nothing could be searched. ' +
  'Nothing has been changed — ask us to turn it on.'
const PHOTO_UNAVAILABLE =
  'The stock photo library could not be reached just now. Nothing has been changed. Try again in a moment.'

interface GiphyGif {
  id: string
  title: string
  images: { original: { url: string; width: string; height: string }; fixed_width_small: { url: string } }
}

interface PexelsPhoto {
  id: number
  src: { large: string; medium: string }
  photographer: string
  photographer_url?: string
  alt: string
  width: number
  height: number
}

interface UnsplashPhoto {
  id: string
  urls: { regular: string; small: string }
  user: { name: string; links?: { html?: string } }
  alt_description: string | null
  width: number
  height: number
  links: { download_location: string }
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once and sign in again.' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const source = (searchParams.get('source') ?? 'pexels').toLowerCase()
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '24') || 24, 1), 50)

  if (source === 'giphy') {
    // The same read the desk uses to decide whether to offer the tab at all,
    // so the two can never disagree about what is switched on.
    if (!readStockCapability().gifs) {
      return NextResponse.json({ error: GIF_NOT_SET_UP }, { status: 503 })
    }
    const apiKey = process.env.GIPHY_API_KEY as string

    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`

    try {
      const res = await fetch(endpoint, { next: { revalidate: 300 } })
      if (!res.ok) {
        // The upstream status is logged, never relayed — a 403 on our own
        // credential is our problem and means nothing to the person reading it.
        console.error('[media/stock:giphy] upstream rejected', res.status, res.statusText)
        return NextResponse.json(
          { error: res.status === 401 || res.status === 403 ? GIF_NOT_SET_UP : GIF_UNAVAILABLE },
          { status: 502 },
        )
      }
      const json = (await res.json()) as { data?: GiphyGif[] }
      return NextResponse.json(
        (json.data ?? []).map((g) => ({
          id: g.id,
          title: g.title,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
          width: Number(g.images.original.width),
          height: Number(g.images.original.height),
          attribution: 'GIPHY',
        })),
      )
    } catch (err) {
      console.error('[media/stock:giphy] request failed', err)
      return NextResponse.json({ error: GIF_UNAVAILABLE }, { status: 502 })
    }
  }

  if (source === 'unsplash') {
    if (!readStockCapability().photoSources.includes('unsplash')) {
      return NextResponse.json({ error: PHOTO_NOT_SET_UP }, { status: 503 })
    }
    const apiKey = process.env.UNSPLASH_ACCESS_KEY as string

    const endpoint = q
      ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${Math.min(limit, 30)}`
      : `https://api.unsplash.com/photos?order_by=popular&per_page=${Math.min(limit, 30)}`

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Client-ID ${apiKey}` },
        next: { revalidate: 300 },
      })
      if (!res.ok) {
        console.error('[media/stock:unsplash] upstream rejected', res.status, res.statusText)
        return NextResponse.json(
          { error: res.status === 401 || res.status === 403 ? PHOTO_NOT_SET_UP : PHOTO_UNAVAILABLE },
          { status: 502 },
        )
      }
      const json = await res.json()
      // The search endpoint wraps in `{ results: [...] }`; the editorial feed
      // returns the array directly.
      const raw: UnsplashPhoto[] = q ? (json.results ?? []) : (json ?? [])
      return NextResponse.json(
        raw.map((p) => ({
          id: p.id,
          url: p.urls.regular,
          preview: p.urls.small,
          photographer: p.user.name,
          photographer_url: p.user.links?.html ?? null,
          alt: p.alt_description ?? '',
          width: p.width,
          height: p.height,
          download_url: p.links.download_location,
          attribution: `Photo by ${p.user.name} on Unsplash`,
        })),
      )
    } catch (err) {
      console.error('[media/stock:unsplash] request failed', err)
      return NextResponse.json({ error: PHOTO_UNAVAILABLE }, { status: 502 })
    }
  }

  if (!readStockCapability().photoSources.includes('pexels')) {
    return NextResponse.json({ error: PHOTO_NOT_SET_UP }, { status: 503 })
  }
  const apiKey = process.env.PEXELS_API_KEY as string

  const endpoint = q
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${limit}`
    : `https://api.pexels.com/v1/curated?per_page=${limit}`

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: apiKey },
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      console.error('[media/stock:pexels] upstream rejected', res.status, res.statusText)
      return NextResponse.json(
        { error: res.status === 401 || res.status === 403 ? PHOTO_NOT_SET_UP : PHOTO_UNAVAILABLE },
        { status: 502 },
      )
    }
    const json = (await res.json()) as { photos?: PexelsPhoto[] }
    return NextResponse.json(
      (json.photos ?? []).map((p) => ({
        id: p.id,
        url: p.src.large,
        preview: p.src.medium,
        photographer: p.photographer,
        photographer_url: p.photographer_url ?? null,
        alt: p.alt,
        width: p.width,
        height: p.height,
        attribution: `Photo by ${p.photographer} on Pexels`,
      })),
    )
  } catch (err) {
    console.error('[media/stock:pexels] request failed', err)
    return NextResponse.json({ error: PHOTO_UNAVAILABLE }, { status: 502 })
  }
}

/**
 * Register that a picture was used.
 *
 * Unsplash requires this call whenever a photo is actually taken — not on every
 * search result rendered — and it must carry our credential. The browser used
 * to fire it directly with `mode: 'no-cors'`, which cannot attach the header:
 * it 401'd every time, invisibly, and left us out of compliance while looking
 * like the box was ticked. The URL is checked against Unsplash's own host so
 * this cannot be used as a general-purpose fetcher.
 */
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once and sign in again.' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as { download_url?: unknown } | null
  const downloadUrl = typeof body?.download_url === 'string' ? body.download_url : ''

  let host = ''
  try {
    host = new URL(downloadUrl).host
  } catch {
    host = ''
  }
  if (host !== 'api.unsplash.com') {
    return NextResponse.json({ error: 'That is not a picture NRS can register.' }, { status: 400 })
  }

  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) return NextResponse.json({ registered: false })

  try {
    await fetch(downloadUrl, { headers: { Authorization: `Client-ID ${apiKey}` } })
  } catch (err) {
    // Never surfaced: the picture is already in the library and the owner has
    // nothing to do about a failed bookkeeping call.
    console.error('[media/stock] download registration failed', err)
    return NextResponse.json({ registered: false })
  }
  return NextResponse.json({ registered: true })
}
