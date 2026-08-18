import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Finish a Zernio sign-in — the address Zernio actually sends the person back to.
 *
 * This route was the one that mattered and the one that was missed. The hardening
 * went to /api/zernio/complete, which had no callers anywhere in the codebase,
 * while /api/zernio/connect builds its redirect straight to here. So the claim
 * "a stranger can no longer spend this workspace's Zernio key" was not true:
 * they simply used this URL instead. /api/zernio/complete has been deleted —
 * two routes doing one job, one of them secured and unreachable, is how that
 * happened in the first place.
 *
 * What was wrong here, plainly:
 *
 *   - No caller check of any kind. No session, no key, nothing. Anyone could
 *     POST our ZERNIO_API_KEY at Zernio by loading a URL.
 *   - `platform` went RAW into the upstream URL path:
 *     `https://zernio.com/api/v1/connect/${platform}`. `?platform=..%2F..%2Fprofiles`
 *     decodes to `../../profiles`, which fetch normalises away, so a stranger
 *     picked the upstream endpoint AND the body while we supplied the bearer
 *     credential. The same injection was fixed in connect and complete and left
 *     here.
 *   - No timeout on a third-party call, so a hanging upstream hung the page.
 *
 * All three are closed the way the rest of the Zernio routes close them, and the
 * brand and platform are now read from the handshake cookie /api/zernio/connect
 * set — not from the returning query string, which anyone can compose. The query
 * values still have to agree with the cookie, so a mismatched or replayed link
 * stops here rather than completing into the wrong brand.
 *
 * One limit stated plainly, because it would be dishonest to imply otherwise:
 * these checks gate WHO may finish a connection, not WHICH Zernio profile the
 * account lands on. Zernio decides that from the `state` it issued, which this
 * site does not store. What they buy is that the flow must have been started
 * here, minutes ago, by a signed-in person entitled to that brand.
 */

/** Zernio takes the platform as a URL path segment, so it cannot be free text. */
const PLATFORM = /^[a-z][a-z0-9_]{1,29}$/

/** Upstream is a third party on someone else's network. Never hang the page. */
const TIMEOUT_MS = 9000

const HANDSHAKE_COOKIE = 'zernio_connect_handshake'

/** One sentence for a missing, stale, mismatched or replayed handshake alike. */
const NO_HANDSHAKE =
  'That connection could not be finished, because it was not started here or too much time has passed. Open the accounts page and start the connection again.'

const NOT_YOURS =
  'That connection could not be finished under this sign-in. If the brand belongs to someone else’s workspace, it has to be connected from their account.'

const UNREACHABLE =
  'Zernio did not answer, so the connection was not finished and nothing has been changed here. Try again in a moment.'

interface Handshake {
  brandId: string
  platform: string
}

export async function GET(request: Request) {
  const accountsPage = new URL('/agency/social/accounts', request.url)

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    // The handshake is consumed whatever happens next, so a link cannot be
    // replayed and a stale cookie cannot sit in the browser for ten minutes.
    const handshake = await takeHandshake()

    if (errorParam) {
      // Upstream's words, not ours, and they end up in the address bar — so the
      // owner gets a sentence written for them instead.
      console.error('[api/zernio/callback] provider returned an error:', errorParam)
      return fail(accountsPage, 'The platform did not complete the connection, so nothing has been changed here.')
    }

    if (!code || !state) {
      return fail(accountsPage, 'That connection could not be finished, because the platform did not send back everything needed. Start the connection again from the accounts page.')
    }

    if (!handshake) return fail(accountsPage, NO_HANDSHAKE)

    // The returning URL may still carry these. They are not trusted for
    // anything — they only have to agree with what we stored.
    const queryBrandId = searchParams.get('brandId')
    const queryPlatform = searchParams.get('platform')
    if (
      (queryBrandId && queryBrandId !== handshake.brandId) ||
      (queryPlatform && queryPlatform !== handshake.platform)
    ) {
      return fail(accountsPage, NO_HANDSHAKE)
    }

    if (!PLATFORM.test(handshake.platform)) return fail(accountsPage, NO_HANDSHAKE)

    if (!process.env.ZERNIO_API_KEY) {
      return fail(accountsPage, 'This site has no Zernio connection configured, so nothing could be finished. Nothing has been changed.')
    }

    // Who is asking. A browser redirect carries the session cookie, so this is
    // available here in a way it would not be for a server-to-server webhook.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const login = new URL('/login', request.url)
      login.searchParams.set('redirect', '/agency/social/accounts')
      return NextResponse.redirect(login)
    }

    const access = await zernioProfileForBrand(supabase, user.id, handshake.brandId)
    if (access.access === 'denied') return fail(accountsPage, NOT_YOURS)
    if (access.brand.profileId === null) {
      return fail(accountsPage, 'This brand is not linked to Zernio yet, so there was no connection to finish. Start the connection again from the accounts page.')
    }

    const res = await fetch(
      `https://zernio.com/api/v1/connect/${encodeURIComponent(handshake.platform)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )

    if (!res.ok) {
      // Upstream's body echoes request detail back and is written for a
      // developer. It goes to the log; the owner gets a sentence to act on.
      console.error(
        `[api/zernio/callback] connect ${res.status}:`,
        await res.text().catch(() => ''),
      )
      return fail(accountsPage, UNREACHABLE)
    }

    const data = await res.json().catch(() => null)
    const accountId = data?.account?.id ?? data?.account?._id ?? null

    accountsPage.searchParams.set('success', 'true')
    if (typeof accountId === 'string') {
      accountsPage.searchParams.set('zernio_account', accountId)
    }
    return NextResponse.redirect(accountsPage)
  } catch (err) {
    return fail(
      accountsPage,
      userSafeError(
        'api/zernio/callback GET',
        err,
        'That connection could not be finished just now. Nothing has been changed. Start it again from the accounts page.',
      ),
    )
  }
}

/**
 * Read the handshake /api/zernio/connect set, and spend it.
 *
 * Deleted on the way out whether or not it parses, so one cookie completes at
 * most one connection.
 */
async function takeHandshake(): Promise<Handshake | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(HANDSHAKE_COOKIE)?.value

  // The path MUST be repeated. A bare delete(name) expires a cookie at path '/',
  // which is a different cookie from the one /api/zernio/connect set at
  // '/api/zernio/callback' — the handshake would survive its own use and stay
  // replayable for the full ten minutes.
  cookieStore.delete({ name: HANDSHAKE_COOKIE, path: '/api/zernio/callback' })

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { brandId?: unknown; platform?: unknown }
    if (typeof parsed.brandId !== 'string' || typeof parsed.platform !== 'string') return null
    return { brandId: parsed.brandId, platform: parsed.platform }
  } catch {
    return null
  }
}

/** Back to the accounts page carrying a sentence written for the owner. */
function fail(accountsPage: URL, message: string): NextResponse {
  const url = new URL(accountsPage)
  url.search = ''
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}
