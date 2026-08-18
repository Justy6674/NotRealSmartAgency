import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import {
  CONNECT_COOKIE_PATH,
  connectCookieOptions,
  fetchPendingOAuthData,
  listConnectChoices,
  mappedAccountIdsFor,
  parseUserProfile,
  recordZernioAccountMapping,
  SELECTION_COOKIE,
  selectionPlanFor,
  signConnectState,
  START_COOKIE,
  stepNeedsSelection,
  verifyConnectState,
  zernioConnectFailure,
  type ConnectSelectionContext,
  type ConnectStateClaims,
} from '@/lib/zernio/connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Where Zernio sends the person back in a headless connection.
 *
 * Three things are true here at once and each one shapes the code:
 *
 *   1. **This URL is public and anyone can compose it.** So nothing in the
 *      query string is believed. `nrs_state` is an HMAC we minted in `/start`,
 *      and the brandId, platform and profileId are read out of THAT, never out
 *      of the returning URL. A nonce cookie set at the same moment binds it to
 *      the browser that started it, so a state lifted from a server log cannot
 *      be completed somewhere else.
 *   2. **The browser arrives by a top-level redirect**, so the session cookie
 *      is present. Identity is established the ordinary way and the brand is
 *      resolved through the workspace rules — the same rule the desk and chat
 *      use, which honours an accepted team admin.
 *   3. **We are holding a platform token that is not ours.** The `tempToken`
 *      and the decoded `userProfile` go straight into an httpOnly cookie inside
 *      a signed continuation. They are never in the response body, never in a
 *      redirect URL, and never in a log line.
 *
 * The answer is JSON for a fetch and a redirect for a navigation, because both
 * happen: our own picker calls this with `Accept: application/json`, and a
 * person who lands here with the tab in the foreground must not be shown a wall
 * of JSON.
 */

const NO_HANDSHAKE =
  'That connection could not be finished, because it was not started here or too much time has passed. Open the accounts page and start it again.'

const NOT_YOURS =
  'That connection could not be finished under this sign-in. If the business belongs to someone else’s workspace, it has to be connected from their account.'

const ACCOUNTS_PAGE = '/agency/social/accounts'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const wantsJson = prefersJson(request)

  try {
    const cookieStore = await cookies()

    /*
     * The nonce is spent whatever happens next, so one start completes at most
     * one connection and a stale cookie cannot sit in the browser for ten
     * minutes waiting to be paired with a replayed link.
     */
    const startedNonce = cookieStore.get(START_COOKIE)?.value ?? null
    cookieStore.delete({ name: START_COOKIE, path: CONNECT_COOKIE_PATH })

    const claims = verifyConnectState(url.searchParams.get('nrs_state'))
    if (!claims) return refuse(request, wantsJson, 400, NO_HANDSHAKE)
    if (!startedNonce || startedNonce !== claims.nonce) {
      return refuse(request, wantsJson, 400, NO_HANDSHAKE)
    }

    const providerError = url.searchParams.get('error')
    if (providerError) {
      // Upstream's words are written for a developer and end up in an address
      // bar. The owner gets a sentence written for them instead.
      console.error('[api/zernio/connect/callback] provider returned an error:', providerError)
      return refuse(
        request,
        wantsJson,
        400,
        'The platform did not complete the connection, so nothing has been changed here.',
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const login = new URL('/login', request.url)
      login.searchParams.set('redirect', ACCOUNTS_PAGE)
      return wantsJson
        ? NextResponse.json({ error: 'You are not signed in.' }, { status: 401 })
        : NextResponse.redirect(login)
    }

    const access = await zernioProfileForBrand(supabase, user.id, claims.brandId)
    if (access.access === 'denied') return refuse(request, wantsJson, 403, NOT_YOURS)

    /*
     * The brand's profile must still be the one the flow started on. If it has
     * been relinked in the meantime, finishing would file this account under a
     * profile the brand no longer uses — invisible everywhere, and impossible
     * to explain later.
     */
    if (access.brand.profileId !== claims.profileId) {
      return refuse(request, wantsJson, 409, NO_HANDSHAKE)
    }

    const plan = selectionPlanFor(claims.platform)
    const step = url.searchParams.get('step')
    const accountIdFromRedirect = (url.searchParams.get('accountId') ?? '').trim()

    if (plan && accountIdFromRedirect === '' && stepNeedsSelection(step)) {
      return await offerSelection({
        request,
        wantsJson,
        url,
        claims,
        cookieStore,
      })
    }

    // No selection was needed: Zernio minted the account during the redirect.
    const mapped = await finaliseWithoutSelection({
      supabase,
      claims,
      accountId: accountIdFromRedirect,
      username: (url.searchParams.get('username') ?? '').trim() || null,
    })

    if (mapped.length === 0) {
      return refuse(
        request,
        wantsJson,
        502,
        'The platform finished signing in but did not hand back an account, so nothing was linked. Start the connection again from the accounts page.',
      )
    }

    if (wantsJson) {
      return NextResponse.json({
        step: 'connected',
        brandId: claims.brandId,
        platform: claims.platform,
        accounts: mapped,
      })
    }

    const done = new URL(ACCOUNTS_PAGE, request.url)
    done.searchParams.set('connected', claims.platform)
    done.searchParams.set('brandId', claims.brandId)
    return NextResponse.redirect(done)
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/callback', err)
    if (wantsJson) {
      return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
    }
    return refuse(request, false, failure.status, failure.body.error)
  }
}

/**
 * Build the continuation, stash it, and hand the UI a list of names.
 *
 * The continuation is signed rather than stored because there is no server-side
 * store for it and inventing one for a ten-minute value would be a table nobody
 * ever cleans up. Signing gives the same guarantee — we can tell our own value
 * from someone else's — without the housekeeping.
 */
async function offerSelection(input: {
  request: Request
  wantsJson: boolean
  url: URL
  claims: ConnectStateClaims
  cookieStore: Awaited<ReturnType<typeof cookies>>
}): Promise<NextResponse> {
  const { request, wantsJson, url, claims, cookieStore } = input

  const pendingDataToken = (url.searchParams.get('pendingDataToken') ?? '').trim()
  const connectToken = (url.searchParams.get('connect_token') ?? '').trim()
  let tempToken = (url.searchParams.get('tempToken') ?? '').trim()
  let userProfile = parseUserProfile(url.searchParams.get('userProfile'))
  let organizations: ConnectStateClaims['organizations']

  /*
   * LinkedIn is the one platform whose list cannot be re-fetched from what the
   * redirect carries: `/connect/linkedin/organizations` wants `orgIds`, which
   * only the one-time pending-data exchange knows. So it is spent here, once,
   * and everything it returns is carried forward in the continuation.
   */
  if (claims.platform === 'linkedin' && pendingDataToken) {
    const pending = await fetchPendingOAuthData(pendingDataToken)
    if (pending.tempToken) tempToken = pending.tempToken
    if (pending.userProfile) userProfile = pending.userProfile
    if (pending.organizations.length > 0) organizations = pending.organizations.slice(0, 50)
  }

  const continuation: ConnectSelectionContext & { nonce: string } = {
    brandId: claims.brandId,
    platform: claims.platform,
    profileId: claims.profileId,
    nonce: claims.nonce,
    ...(tempToken ? { tempToken } : {}),
    ...(userProfile ? { userProfile } : {}),
    ...(connectToken ? { connectToken } : {}),
    ...(pendingDataToken ? { pendingDataToken } : {}),
    ...(organizations ? { organizations } : {}),
  }

  const listing = await listConnectChoices(continuation)

  cookieStore.set(SELECTION_COOKIE, signConnectState(continuation), connectCookieOptions())

  if (wantsJson) {
    return NextResponse.json({
      step: 'select',
      brandId: claims.brandId,
      platform: claims.platform,
      kind: listing.plan.kind,
      label: listing.plan.label,
      choices: listing.choices,
      hasMore: listing.hasMore,
    })
  }

  const picker = new URL(ACCOUNTS_PAGE, request.url)
  picker.searchParams.set('connect', 'select')
  picker.searchParams.set('platform', claims.platform)
  picker.searchParams.set('brandId', claims.brandId)
  return NextResponse.redirect(picker)
}

/**
 * Write down whose account this is.
 *
 * When the redirect names the account, that is the answer. When it does not —
 * and several platforms simply say `connected=true` — the accounts are read
 * back through `fetchZernioAccounts(profileId)`, which applies OUR profile
 * filter in OUR code because `listAccounts({ profileId })` accepts the filter
 * and ignores it. Guessing from an unfiltered team-wide list would be how one
 * subscriber's page gets filed under another's business.
 */
async function finaliseWithoutSelection(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  claims: ConnectStateClaims
  accountId: string
  username: string | null
}): Promise<Array<{ accountId: string; platform: string; username: string | null }>> {
  const { supabase, claims } = input

  if (input.accountId !== '') {
    await recordZernioAccountMapping(supabase, {
      accountId: input.accountId,
      brandId: claims.brandId,
      profileId: claims.profileId,
      platform: claims.platform,
      username: input.username,
    })
    return [{ accountId: input.accountId, platform: claims.platform, username: input.username }]
  }

  const scoped = await fetchZernioAccounts(claims.profileId)

  /*
   * Only accounts we have never written down.
   *
   * A blanket re-map would set `disconnected_at: null` on every same-platform
   * row, silently reviving one the owner disconnected last month — an account
   * back in the publishing rotation because somebody connected a different one.
   */
  const alreadyMapped = await mappedAccountIdsFor(supabase, {
    brandId: claims.brandId,
    platform: claims.platform,
  })
  const matching = scoped.filter(
    (account) => account.platform === claims.platform && !alreadyMapped.has(account.id),
  )

  const written: Array<{ accountId: string; platform: string; username: string | null }> = []
  for (const account of matching) {
    await recordZernioAccountMapping(supabase, {
      accountId: account.id,
      brandId: claims.brandId,
      profileId: claims.profileId,
      platform: account.platform,
      username: account.username ?? null,
    })
    written.push({
      accountId: account.id,
      platform: account.platform,
      username: account.username ?? null,
    })
  }
  return written
}

/**
 * A fetch gets JSON, a person gets a page.
 *
 * `Sec-Fetch-Mode: navigate` is the reliable signal — Accept alone is not,
 * because a top-level navigation sends a wildcard Accept in some browsers, and
 * our own picker would then be handed a redirect it cannot follow.
 */
function prefersJson(request: Request): boolean {
  if (request.headers.get('sec-fetch-mode') === 'navigate') return false
  const accept = (request.headers.get('accept') ?? '').toLowerCase()
  if (accept.includes('application/json')) return true
  return !accept.includes('text/html')
}

function refuse(
  request: Request,
  wantsJson: boolean,
  status: number,
  message: string,
): NextResponse {
  if (wantsJson) return NextResponse.json({ error: message }, { status })
  const page = new URL(ACCOUNTS_PAGE, request.url)
  page.searchParams.set('error', message)
  return NextResponse.redirect(page)
}
