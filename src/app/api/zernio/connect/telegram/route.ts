import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { ensureBrandZernioProfile } from '@/lib/zernio/brand-profile'
import {
  connectCookieOptions,
  CONNECT_COOKIE_PATH,
  CONNECT_STATE_TTL_MS,
  recordZernioAccountMapping,
  signConnectState,
  verifyConnectState,
  zernioConnectFailure,
} from '@/lib/zernio/connect'
import { checkTelegramConnect, startTelegramConnect } from '@/lib/zernio/connect-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Telegram, which is connected backwards.
 *
 * POST asks for a code. GET says whether it has been used yet. Both were
 * missing: the tile shipped, the dialog posted here and then polled every three
 * seconds for ten minutes, and every one of those requests hit a Next 404 whose
 * HTML body parsed to null. The owner saw a code that could never complete.
 *
 * ── Why the code rides in a signed cookie and not the query string ─────
 *
 * The poll is what decides which brand a channel belongs to. The code is short,
 * human-readable and printed on the owner's screen, so a code arriving in a
 * request is not proof of anything — a signed-in person could poll a code
 * generated for another tenant and have the channel it connects written onto a
 * brand of their choosing. So POST mints a signed, httpOnly continuation
 * holding the brand, the profile and the code, and GET spends that. The `code`
 * in the query is compared against it and never used in its place: it exists so
 * a screen left open from an earlier attempt is told it is stale rather than
 * silently polling a newer code.
 *
 * ── The clock the owner is shown is the clock we actually keep ─────────
 *
 * The publisher gives a code fifteen minutes; the signed continuation lives
 * ten. Passing the publisher's expiry to the screen would have it counting down
 * from fifteen while the last five could not possibly complete. So the window
 * is the earlier of the two, and that single instant is what is signed, what
 * the cookie expires at, and what the screen counts down to.
 */

/** Minted by POST, spent by GET. Never leaves the server in a readable form. */
const TELEGRAM_COOKIE = 'zernio_connect_telegram'

const NOT_SIGNED_IN = 'You are not signed in, so nothing was connected. Sign in and try again.'

const NOT_YOURS =
  'That business could not be opened under this sign-in, so nothing was connected. If it belongs to someone else’s workspace, it has to be connected from their account.'

const NO_HANDSHAKE =
  'This has been open too long, or it was not started in this browser. Nothing has been connected. Ask for a new code and start again.'

const STALE_SCREEN =
  'That code has been replaced by a newer one. Nothing has been connected. Use the code on screen now, or ask for another.'

const EXPIRED =
  'That code has expired, so nothing has been connected. Ask for a new one and send that instead.'

/**
 * Our own steps, used only when the publisher sends none.
 *
 * Written for someone who has never done this: the bot has to be an
 * administrator of the channel before the code will do anything, and the code
 * is sent together with the channel's @name. An earlier fallback said only
 * "send it the code", which is the half of the instruction that does not work.
 */
const FALLBACK_INSTRUCTIONS = [
  'In Telegram, open your channel, then Administrators, and add the bot below as an administrator.',
  'Open a private chat with that same bot.',
  'Send it the code followed by your channel’s @name — for example: CODE @yourchannel.',
  'Come back here. This screen updates itself the moment it lands.',
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = await request.json().catch(() => null) as { brandId?: unknown } | null
    const brandId = typeof body?.brandId === 'string' ? body.brandId.trim() : ''

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — a channel is connected to one business at a time.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const { profileId } = await ensureBrandZernioProfile(supabase, access.brand)

    const started = await startTelegramConnect(profileId)

    // The earlier of the publisher's expiry and our own signing window. One
    // instant, used three times below, so the countdown on screen cannot outlive
    // the thing that would have to complete it.
    const upstreamExpiry = started.expiresAt ? Date.parse(started.expiresAt) : Number.NaN
    const ourExpiry = Date.now() + CONNECT_STATE_TTL_MS
    const watchUntil = Number.isNaN(upstreamExpiry) ? ourExpiry : Math.min(upstreamExpiry, ourExpiry)

    const state = signConnectState({
      brandId: access.brand.brandId,
      platform: 'telegram',
      profileId,
      telegramCode: started.code,
      exp: watchUntil,
    })

    const cookieStore = await cookies()
    cookieStore.set(TELEGRAM_COOKIE, state, {
      ...connectCookieOptions(),
      maxAge: Math.max(1, Math.ceil((watchUntil - Date.now()) / 1000)),
    })

    return NextResponse.json({
      code: started.code,
      brandId: access.brand.brandId,
      expiresAt: new Date(watchUntil).toISOString(),
      ...(started.botUsername ? { botUsername: started.botUsername } : {}),
      instructions: started.instructions.length > 0 ? started.instructions : FALLBACK_INSTRUCTIONS,
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/telegram POST', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const claims = verifyConnectState(cookieStore.get(TELEGRAM_COOKIE)?.value)

    // Missing, tampered with, or past its window — all the same answer, and all
    // of them mean the same thing to the owner: start again.
    if (!claims || claims.platform !== 'telegram' || !claims.telegramCode) {
      return NextResponse.json({ connected: false, error: NO_HANDSHAKE }, { status: 400 })
    }

    /*
     * The cookie proves the flow started in this browser. It is NOT an identity
     * — the caller holds both halves — so who is asking is established again
     * here, and the brand is resolved through the workspace rules exactly as
     * the other connect routes do.
     */
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ connected: false, error: NOT_SIGNED_IN }, { status: 401 })

    const access = await zernioProfileForBrand(supabase, user.id, claims.brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ connected: false, error: NOT_YOURS }, { status: 403 })
    }
    // The brand's profile changing mid-flow means the continuation describes a
    // state of the world that no longer holds. Refuse rather than reconcile.
    if (access.brand.profileId !== claims.profileId) {
      return NextResponse.json({ connected: false, error: NO_HANDSHAKE }, { status: 409 })
    }

    const asked = new URL(request.url).searchParams.get('code')?.trim() ?? ''
    if (asked !== '' && asked !== claims.telegramCode) {
      return NextResponse.json({ connected: false, error: STALE_SCREEN }, { status: 409 })
    }

    const status = await checkTelegramConnect(claims.telegramCode)

    if (status.status === 'pending') {
      return NextResponse.json({
        connected: false,
        status: 'pending',
        // Still ours, not the publisher's: the window we can actually keep.
        expiresAt: new Date(claims.exp).toISOString(),
      })
    }

    if (status.status === 'expired') {
      cookieStore.delete({ name: TELEGRAM_COOKIE, path: CONNECT_COOKIE_PATH })
      return NextResponse.json({ connected: false, status: 'expired', error: EXPIRED }, { status: 410 })
    }

    await recordZernioAccountMapping(supabase, {
      accountId: status.account.accountId,
      brandId: claims.brandId,
      profileId: claims.profileId,
      platform: status.account.platform || 'telegram',
      username: status.account.username,
    })

    /*
     * Spent. A code has one use, and a continuation that outlived it would let a
     * second poll re-map an account the owner may have disconnected in between.
     * The path must be repeated on delete — a bare delete expires a cookie at
     * '/', which is a different cookie from this one.
     */
    cookieStore.delete({ name: TELEGRAM_COOKIE, path: CONNECT_COOKIE_PATH })

    return NextResponse.json({
      connected: true,
      status: 'connected',
      brandId: claims.brandId,
      platform: status.account.platform || 'telegram',
      account: {
        accountId: status.account.accountId,
        name: status.chatTitle ?? status.account.displayName ?? status.account.username ?? 'your channel',
        username: status.account.username,
      },
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/telegram GET', err)
    return NextResponse.json(
      { connected: false, ...failure.body },
      { status: failure.status, headers: failure.headers },
    )
  }
}
