import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GIF search for the media library's GIFs tab.
 *
 * THE FAULT THIS CLOSES: this route used to fall back to the string
 * `dc6zaTOxFJmzC` when `GIPHY_API_KEY` was unset. That is Giphy's public beta
 * key, retired years ago. On a deployment with no key of our own the tab did
 * not say so — it silently borrowed a dead credential, and the owner saw an
 * empty grid reading "No GIFs found", which is a sentence about his search
 * terms, not about our configuration. He would have retyped the search forever.
 *
 * A missing key is now a plain answer with a real status code, so the picker
 * can say the one true thing: this is switched off, and it is not his fault.
 * The message never names the supplier or the words "API key" — he does not
 * have one and cannot get one; the person who can is us.
 */

const SIGN_IN_REQUIRED =
  'Please sign in again — your session has expired. Nothing has been changed.'

const NOT_SET_UP =
  'The GIF library is not switched on for this desk yet, so nothing could be searched. ' +
  'Nothing has been changed — ask us to turn it on.'

const UNAVAILABLE =
  'The GIF library could not be reached just now. Nothing has been changed. Try again in a moment.'

interface GiphyImage {
  url: string
  width: string
  height: string
}

interface GiphyGif {
  id: string
  title: string
  images: {
    original: GiphyImage
    fixed_width_small: { url: string }
  }
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

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '20') || 20, 50)

  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`

  try {
    const res = await fetch(endpoint, { next: { revalidate: 300 } })

    if (!res.ok) {
      // The upstream status is logged, never relayed — a 403 on our credential
      // is our problem to fix and means nothing to the person reading it.
      console.error('[giphy/search] upstream rejected', res.status, res.statusText)
      return NextResponse.json(
        { error: res.status === 401 || res.status === 403 ? NOT_SET_UP : UNAVAILABLE },
        { status: 502 },
      )
    }

    const json = (await res.json()) as { data?: GiphyGif[] }

    const gifs = (json.data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      url: g.images.original.url,
      preview: g.images.fixed_width_small.url,
      width: Number(g.images.original.width),
      height: Number(g.images.original.height),
    }))

    return NextResponse.json(gifs)
  } catch (err) {
    console.error('[giphy/search] request failed', err)
    return NextResponse.json({ error: UNAVAILABLE }, { status: 502 })
  }
}
