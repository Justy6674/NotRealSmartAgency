import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Start a Zernio sign-in handover for ONE brand the signed-in person owns.
 *
 * What this route used to be, plainly: it created a service-role client, read
 * `brandId` out of the query string, and asked nobody who was calling. The
 * service role bypasses Row Level Security completely, so anyone holding a
 * brand uuid could read that brand's name and its Zernio profile id, cause a
 * brand-new Zernio profile to be created and written into someone else's row,
 * and be handed a live OAuth sign-in URL pointed at that brand. The only
 * `Authorization` header in the file was ours, outbound, to Zernio — that
 * authenticates US to a third party and says nothing whatever about the caller.
 *
 * The shape here is copied from /api/zernio/ads, one directory over, which had
 * already been fixed: session client, `auth.getUser`, then a brand lookup
 * filtered by `user_id` so an unowned brand id simply returns nothing.
 *
 * The write no longer needs the service role either. RLS on `brands` allows the
 * owner to update their own row (`brands_update` → `can_write_for_owner`), so
 * the same session client that proved who is asking also does the saving. There
 * is no admin client in this file at all now, which is a stronger position than
 * having one behind a check.
 *
 * Two statuses, deliberately different: 401 means nobody is signed in, 403
 * means someone is and this brand is not theirs. 403 also covers "no such
 * brand", because telling those two apart would let a signed-in person
 * enumerate which brand ids exist.
 *
 * This route also sets the handshake cookie that /api/zernio/callback requires.
 * The callback is the address Zernio sends the person back to, and it used to
 * take the brand and the platform out of that returning URL and believe them.
 * The cookie is where they actually live now: httpOnly, ten minutes, path-bound
 * to the callback, and only ever written here — after this route has confirmed
 * who is asking and that the brand is theirs. The callback checks the returning
 * query against it and refuses a disagreement, so a link someone else composed
 * cannot finish a connection into this workspace.
 */

/** Named for the cookie's job, so a stale one in a browser is self-explaining. */
const HANDSHAKE_COOKIE = 'zernio_connect_handshake'

/** Upstream is a third party on someone else's network. Never hang the page. */
const TIMEOUT_MS = 9000

/** Zernio takes the platform as a URL path segment, so it cannot be free text. */
const PLATFORM = /^[a-z][a-z0-9_]{1,29}$/

const NOT_SIGNED_IN =
  'You are not signed in, so no connection was started. Sign in and try again.'

const NOT_YOURS =
  'That brand could not be opened under this sign-in, so no connection was started. If it belongs to someone else’s workspace, it has to be connected from their account.'

const NOT_SET_UP =
  'This site has no account connection configured, so a sign-in cannot be started for any brand. Nothing has been changed.'

const UNREACHABLE =
  'The account service did not answer, so the sign-in was not started and nothing has been changed here. Try again in a moment.'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const brandId = searchParams.get('brandId')

    if (!brandId || !platform) {
      return NextResponse.json(
        { error: 'Choose a brand and a platform first — a connection belongs to one brand.' },
        { status: 400 },
      )
    }

    if (!PLATFORM.test(platform)) {
      return NextResponse.json(
        { error: 'That is not a platform this site can connect, so nothing was started.' },
        { status: 400 },
      )
    }

    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
    }

    // Membership is decided in one place for every Zernio route, and it honours
    // an accepted team admin the same way /api/brands does. A brand from another
    // workspace is simply 'denied', with no way to tell that from "no such brand".
    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const brand = access.brand
    const zernioProfileId = brand.profileId

    // D28 / T13: connect only when this brand is already linked. An empty
    // account map is fine. Creating a new profile from an unlinked brand is not.
    if (!zernioProfileId) {
      return NextResponse.json(
        { error: 'This business isn’t set up to connect accounts yet.' },
        { status: 400 },
      )
    }

    // Where Zernio sends the person back. The platform and the brand still ride
    // in the URL so the destination page knows what just happened — but the
    // callback authorises on the cookie below, never on these, because anyone
    // can type a URL.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl =
      `${appUrl}/api/zernio/callback` +
      `?platform=${encodeURIComponent(platform)}&brandId=${encodeURIComponent(brand.brandId)}`

    const connectData = await requestConnectUrl(platform, zernioProfileId, redirectUrl)
    if (!connectData?.authUrl) {
      return NextResponse.json({ error: UNREACHABLE }, { status: 502 })
    }

    // Written only now, once everything above has held: signed in, brand theirs,
    // platform recognised, Zernio ready. `sameSite: 'lax'` is required rather
    // than incidental — the browser arrives back at the callback by a top-level
    // redirect from zernio.com, and 'strict' would withhold the cookie there and
    // break every connection.
    const cookieStore = await cookies()
    cookieStore.set(
      HANDSHAKE_COOKIE,
      JSON.stringify({
        brandId: brand.brandId,
        platform,
        csrf: randomBytes(16).toString('hex'),
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/zernio/callback',
        maxAge: 600,
      },
    )

    return NextResponse.json({
      authUrl: connectData.authUrl,
      state: connectData.state,
      brandId: brand.brandId,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/connect GET',
          err,
          'The sign-in could not be started just now. Nothing has been changed. Try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }
}

/** The platform sign-in URL Zernio wants this person sent to. */
async function requestConnectUrl(
  platform: string,
  profileId: string,
  redirectUrl: string,
): Promise<{ authUrl?: string; state?: string } | null> {
  try {
    const query = new URLSearchParams({ profileId, redirect_url: redirectUrl })
    const res = await fetch(
      `https://zernio.com/api/v1/connect/${encodeURIComponent(platform)}?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )

    if (!res.ok) {
      console.error(
        `[api/zernio/connect] connect url ${res.status}:`,
        await res.text().catch(() => ''),
      )
      return null
    }

    return await res.json()
  } catch (err) {
    console.error('[api/zernio/connect] connect url failed:', err)
    return null
  }
}
