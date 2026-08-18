import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import {
  CONNECT_COOKIE_PATH,
  listConnectChoices,
  recordZernioAccountMapping,
  SELECTION_COOKIE,
  submitConnectChoice,
  verifyConnectState,
  zernioConnectFailure,
  type ConnectStateClaims,
} from '@/lib/zernio/connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The picker: list what the person can connect, then connect the one they chose.
 *
 * GET lists, POST commits. Both read the continuation out of the httpOnly
 * cookie `/callback` set, so the platform access token is never handled by the
 * browser and cannot be supplied by a caller — a request naming a `tempToken`
 * of its own is simply ignored, because nothing here reads one from the body.
 *
 * ── Why POST re-lists instead of trusting the body ─────────────────────
 *
 * The body carries an id and nothing else. The name, the LinkedIn URN, the
 * Google Business account that owns a location — all of it comes back out of a
 * fresh listing and is matched against the id. Accepting those from the client
 * would let a caller connect organisation A while displaying organisation B's
 * name to the person approving it, and the URN is what actually decides which
 * company gets posted to. An id that is not in our own listing is refused.
 */

const NO_HANDSHAKE =
  'That connection could not be finished, because it was not started here or too much time has passed. Open the accounts page and start it again.'

const NOT_YOURS =
  'That connection could not be finished under this sign-in. If the business belongs to someone else’s workspace, it has to be connected from their account.'

const NOT_SIGNED_IN = 'You are not signed in, so nothing was changed. Sign in and try again.'

interface Resolved {
  claims: ConnectStateClaims
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Who is asking, which brand, and is the continuation still ours.
 *
 * Read on both verbs. A cookie proves the flow started in this browser; it is
 * NOT an identity, and a route that treated it as one is exactly how
 * /api/oauth/meta/initiate ended up writing an attacker's tokens onto a project
 * they had chosen from a query string.
 */
async function resolve(): Promise<Resolved | { error: string; status: number }> {
  const cookieStore = await cookies()
  const claims = verifyConnectState(cookieStore.get(SELECTION_COOKIE)?.value)
  if (!claims) return { error: NO_HANDSHAKE, status: 400 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NOT_SIGNED_IN, status: 401 }

  const access = await zernioProfileForBrand(supabase, user.id, claims.brandId)
  if (access.access === 'denied') return { error: NOT_YOURS, status: 403 }
  if (access.brand.profileId !== claims.profileId) return { error: NO_HANDSHAKE, status: 409 }

  return { claims, supabase }
}

export async function GET() {
  try {
    const resolved = await resolve()
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const listing = await listConnectChoices(resolved.claims)
    return NextResponse.json({
      step: 'select',
      brandId: resolved.claims.brandId,
      platform: resolved.claims.platform,
      kind: listing.plan.kind,
      label: listing.plan.label,
      choices: listing.choices,
      hasMore: listing.hasMore,
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/select GET', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}

export async function POST(request: Request) {
  try {
    const resolved = await resolve()
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const { claims, supabase } = resolved

    const body = await request.json().catch(() => null) as
      | { choiceId?: unknown; accountType?: unknown }
      | null

    const choiceId = typeof body?.choiceId === 'string' ? body.choiceId.trim() : ''
    const accountType = body?.accountType === 'personal' ? 'personal' as const : 'organization' as const

    if (choiceId === '' && accountType !== 'personal') {
      return NextResponse.json(
        { error: 'Choose which account to connect first — nothing has been changed.' },
        { status: 400 },
      )
    }

    const listing = await listConnectChoices(claims)
    const choice = listing.choices.find((entry) => entry.id === choiceId)

    // A personal LinkedIn connection has nothing to pick, so an absent choice is
    // allowed there and nowhere else.
    const personalLinkedIn = claims.platform === 'linkedin' && accountType === 'personal'
    if (!choice && !personalLinkedIn) {
      return NextResponse.json(
        {
          error:
            'That is not one of the accounts this sign-in offered, so nothing was connected. Start the connection again from the accounts page.',
        },
        { status: 400 },
      )
    }

    const connected = await submitConnectChoice({
      claims,
      choice: choice ?? { id: '', name: '' },
      ...(claims.platform === 'linkedin' ? { accountType } : {}),
    })

    await recordZernioAccountMapping(supabase, {
      accountId: connected.accountId,
      brandId: claims.brandId,
      profileId: claims.profileId,
      // Zernio's own answer, not our request. The two agree today; if they ever
      // stop, the account row is the one the webhook handler will look up by.
      platform: connected.platform || claims.platform,
      username: connected.username,
    })

    /*
     * Spent, whatever happened next. The continuation is the only copy of a
     * token belonging to someone else's business, and it has no second use: a
     * second selection needs a second sign-in.
     */
    const cookieStore = await cookies()
    cookieStore.delete({ name: SELECTION_COOKIE, path: CONNECT_COOKIE_PATH })

    return NextResponse.json({
      step: 'connected',
      brandId: claims.brandId,
      platform: connected.platform || claims.platform,
      account: connected,
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/select POST', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}
