import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

process.env.ZERNIO_API_KEY = 'test-key'
process.env.ZERNIO_CONNECT_STATE_SECRET = 'test-connect-state-secret'

import {
  connectCookieOptions,
  CONNECT_STATE_TTL_MS,
  listConnectChoices,
  liveMappingFor,
  mappedAccountIdsFor,
  parseUserProfile,
  retryAfterSeconds,
  selectionPlanFor,
  signConnectState,
  startHeadlessConnect,
  stepNeedsSelection,
  submitConnectChoice,
  verifyConnectState,
  zernioConnectFailure,
  zernioConnectRequest,
  ZernioBillingSuspendedError,
  ZernioRateLimitedError,
  type ConnectSelectionContext,
} from './connect.ts'
import { zernioProfileNameForBrand } from './brand-profile.ts'
import { ZernioError, ZernioHtmlResponseError } from './errors.ts'

// ── fetch stubbing ─────────────────────────────────────────────────────

const realFetch = globalThis.fetch
const calls: Array<{ url: string; init: RequestInit }> = []

interface StubbedResponse {
  status?: number
  contentType?: string | null
  body?: string
  headers?: Record<string, string>
}

function stubFetch(...queue: StubbedResponse[]): void {
  const remaining = [...queue]
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    const next = remaining.shift() ?? { status: 200, body: '{}' }
    const headers = new Headers(next.headers ?? {})
    if (next.contentType !== null) {
      headers.set('content-type', next.contentType ?? 'application/json')
    }
    return new Response(next.body ?? '{}', { status: next.status ?? 200, headers })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
  calls.length = 0
})

const BRAND = '941fd585-1f85-4646-a1d7-e000aa0ca00a'
const OTHER_BRAND = '00000000-1111-2222-3333-444444444444'

function context(overrides: Partial<ConnectSelectionContext> = {}): ConnectSelectionContext {
  return {
    brandId: BRAND,
    platform: 'facebook',
    profileId: 'profile-1',
    tempToken: 'temp-abc',
    userProfile: { id: 'u1', name: 'A Person' },
    ...overrides,
  }
}

// ── the signed state ───────────────────────────────────────────────────

test('a signed state round-trips and carries the brand it was minted for', () => {
  const token = signConnectState({ brandId: BRAND, platform: 'facebook', profileId: 'p1' })
  const claims = verifyConnectState(token)

  assert.ok(claims)
  assert.equal(claims.brandId, BRAND)
  assert.equal(claims.platform, 'facebook')
  assert.equal(claims.profileId, 'p1')
  assert.ok(claims.exp > Date.now())
  assert.ok(claims.exp <= Date.now() + CONNECT_STATE_TTL_MS)
})

test('a state re-pointed at another brand no longer verifies', () => {
  // The whole reason the state is signed. Zernio's own `state` proves the OAuth
  // round trip and says nothing about which of our brands asked, so without
  // this a person could start on a brand they own and finish onto one they do
  // not.
  const token = signConnectState({ brandId: BRAND, platform: 'facebook', profileId: 'p1' })
  const [payload, signature] = token.split('.')
  const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as Record<string, unknown>
  claims.brandId = OTHER_BRAND
  const forged = `${Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')}.${signature}`

  assert.equal(verifyConnectState(forged), null)
})

test('a tampered signature, a missing state and rubbish are all the same no', () => {
  const token = signConnectState({ brandId: BRAND, platform: 'facebook', profileId: 'p1' })
  assert.equal(verifyConnectState(`${token}x`), null)
  assert.equal(verifyConnectState(null), null)
  assert.equal(verifyConnectState(''), null)
  assert.equal(verifyConnectState('not-a-token'), null)
})

test('an expired state is refused even though its signature is perfect', () => {
  const token = signConnectState({
    brandId: BRAND,
    platform: 'facebook',
    profileId: 'p1',
    exp: Date.now() - 1,
  })
  assert.equal(verifyConnectState(token), null)
})

// ── Retry-After ────────────────────────────────────────────────────────

test('Retry-After is read as seconds or as an HTTP date, and never guessed', () => {
  assert.equal(retryAfterSeconds('120'), 120)
  assert.equal(retryAfterSeconds('  45 '), 45)
  assert.equal(retryAfterSeconds(null), null)
  assert.equal(retryAfterSeconds(''), null)
  assert.equal(retryAfterSeconds('soon'), null)

  const inTwoMinutes = new Date(Date.now() + 120_000).toUTCString()
  const seconds = retryAfterSeconds(inTwoMinutes)
  assert.ok(seconds !== null && seconds >= 110 && seconds <= 121, `got ${seconds}`)
})

// ── content type before status ─────────────────────────────────────────

test('a wrong path answering 200 with a web page is caught, not read as empty', async () => {
  // The failure this codebase keeps meeting: a wrong path under
  // zernio.com/api/v1 answers HTTP 200 with the publisher's site shell. `!res.ok`
  // cannot fire on it, and the body reads as successful-but-empty.
  stubFetch({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!DOCTYPE html>' })

  await assert.rejects(
    () => zernioConnectRequest('connect.getConnectUrl(facebook)', '/connect/facebook'),
    ZernioHtmlResponseError,
  )
})

test('an HTML body carrying 402 is a wrong path, not a billing suspension', async () => {
  // Reading the status first would page an operator about their bill because of
  // our own typo in a path.
  stubFetch({ status: 402, contentType: 'text/html', body: '<!DOCTYPE html>' })

  await assert.rejects(
    () => zernioConnectRequest('connect.getConnectUrl(facebook)', '/connect/facebook'),
    (err: unknown) => err instanceof ZernioHtmlResponseError
      && !(err instanceof ZernioBillingSuspendedError),
  )
})

// ── 402 and 429 ────────────────────────────────────────────────────────

test('402 is our team billing, and the subscriber is told nothing about money', async () => {
  stubFetch({
    status: 402,
    body: JSON.stringify({ error: 'Free tier exceeded', code: 'PAYMENT_REQUIRED', reason: 'free_tier_exceeded' }),
  })

  await assert.rejects(
    () => zernioConnectRequest('connect.getConnectUrl(facebook)', '/connect/facebook'),
    (err: unknown) => {
      assert.ok(err instanceof ZernioBillingSuspendedError)
      assert.equal(err.status, 402)
      assert.equal(err.reason, 'free_tier_exceeded')
      const shown = err.ownerMessage.toLowerCase()
      for (const leak of ['pay', 'billing', 'card', 'plan', 'zernio', '402', 'tier']) {
        assert.ok(!shown.includes(leak), `owner message leaks "${leak}": ${err.ownerMessage}`)
      }
      return true
    },
  )
})

test('429 carries the wait forward instead of inviting an immediate retry', async () => {
  stubFetch({
    status: 429,
    body: JSON.stringify({ error: 'Too many requests' }),
    headers: { 'retry-after': '30' },
  })

  await assert.rejects(
    () => zernioConnectRequest('connect.getConnectUrl(facebook)', '/connect/facebook'),
    (err: unknown) => {
      assert.ok(err instanceof ZernioRateLimitedError)
      assert.equal(err.retryAfterSeconds, 30)
      return true
    },
  )
})

test('the rate limit is relayed as 503 with Retry-After, never as 429', () => {
  // 429 passed through would tell the browser that IT was limited and invite a
  // client-side retry loop against a limit shared with every other tenant.
  const failure = zernioConnectFailure('test', new ZernioRateLimitedError('op', 30))
  assert.equal(failure.status, 503)
  assert.equal(failure.headers?.['Retry-After'], '30')
  assert.equal(failure.body.retryAfterSeconds, 30)
  assert.ok(!failure.body.error.includes('429'))
})

test('an ordinary upstream failure does not become a 500 or leak its detail', () => {
  const failure = zernioConnectFailure('test', new ZernioError('op', 'relation "brands" does not exist', { status: 500 }))
  assert.equal(failure.status, 502)
  assert.ok(!failure.body.error.includes('relation'))
})

// ── the redirect payload ───────────────────────────────────────────────

test('userProfile is decoded whether or not the router already unescaped it', () => {
  const profile = { id: '123', name: 'Bright & Co' }
  const json = JSON.stringify(profile)

  assert.deepEqual(parseUserProfile(encodeURIComponent(json)), profile)
  assert.deepEqual(parseUserProfile(json), profile)
})

test('a userProfile that is not an object is refused rather than half-trusted', () => {
  assert.equal(parseUserProfile('[]'), null)
  assert.equal(parseUserProfile('"just a string"'), null)
  assert.equal(parseUserProfile('not json at all'), null)
  assert.equal(parseUserProfile(null), null)
  assert.equal(parseUserProfile('  '), null)
})

test('only the platforms with a real selection step have a plan', () => {
  for (const platform of ['facebook', 'instagram', 'linkedin', 'pinterest', 'snapchat', 'googlebusiness'] as const) {
    assert.ok(selectionPlanFor(platform), `${platform} should have a selection plan`)
  }
  for (const platform of ['twitter', 'youtube', 'threads', 'bluesky', 'telegram'] as const) {
    assert.equal(selectionPlanFor(platform), null, `${platform} must not claim a selection step`)
  }
})

test('a step value we do not recognise means no selection, not a guessed one', () => {
  assert.equal(stepNeedsSelection('select_page'), true)
  assert.equal(stepNeedsSelection('select_organization'), true)
  assert.equal(stepNeedsSelection('something_new'), false)
  assert.equal(stepNeedsSelection(null), false)
  assert.equal(stepNeedsSelection(''), false)
})

// ── the picker ─────────────────────────────────────────────────────────

test('a Page access token never survives into a choice we could serialise', async () => {
  // Every Facebook and Instagram page row carries `access_token`. It is a
  // credential for someone else's business, and the only reliable way not to
  // leak it into a JSON response is for it never to be on the object.
  stubFetch({
    body: JSON.stringify({
      pages: [
        { id: 'page-1', name: 'Bright Dental', username: 'brightdental', access_token: 'EAAG-secret', category: 'Dentist' },
      ],
    }),
  })

  const listing = await listConnectChoices(context())
  assert.equal(listing.choices.length, 1)
  assert.equal(JSON.stringify(listing.choices).includes('EAAG-secret'), false)
  assert.equal(listing.choices[0]!.id, 'page-1')
  assert.equal(listing.choices[0]!.name, 'Bright Dental')
})

test('LinkedIn organisations come from the carried copy, because pending-data is one-time', async () => {
  // Calling /connect/pending-data twice returns nothing the second time. If the
  // list were re-fetched per screen the person would see an empty picker with
  // no explanation for why the first render worked.
  const listing = await listConnectChoices(context({
    platform: 'linkedin',
    organizations: [{ id: '99', name: 'Bright Dental', urn: 'urn:li:organization:99' }],
  }))

  assert.equal(calls.length, 0, 'no upstream call should be needed')
  assert.equal(listing.choices[0]!.urn, 'urn:li:organization:99')
})

test('the LinkedIn URN is carried through, never rebuilt from the id', async () => {
  stubFetch({ body: JSON.stringify({ account: { accountId: 'acc-9', platform: 'linkedin' } }) })

  await submitConnectChoice({
    claims: context({ platform: 'linkedin' }),
    choice: { id: '99', name: 'Bright Dental', urn: 'urn:li:company:99' },
    accountType: 'organization',
  })

  const body = JSON.parse(String(calls[0]!.init.body)) as {
    selectedOrganization?: { urn?: string }
  }
  assert.equal(body.selectedOrganization?.urn, 'urn:li:company:99')
})

test('the connect start asks for headless and hands over our own redirect', async () => {
  stubFetch({ body: JSON.stringify({ authUrl: 'https://facebook.com/oauth', state: 'zernio-state' }) })

  const started = await startHeadlessConnect({
    platform: 'facebook',
    profileId: 'profile-1',
    redirectUrl: 'https://app.example/api/zernio/connect/callback?nrs_state=abc',
  })

  assert.equal(started.authUrl, 'https://facebook.com/oauth')
  const asked = new URL(calls[0]!.url)
  assert.equal(asked.searchParams.get('headless'), 'true')
  assert.equal(asked.searchParams.get('profileId'), 'profile-1')
  assert.equal(
    asked.searchParams.get('redirect_url'),
    'https://app.example/api/zernio/connect/callback?nrs_state=abc',
  )
})

test('an authUrl the publisher did not send is a failure, not an empty string', async () => {
  stubFetch({ body: JSON.stringify({ state: 'zernio-state' }) })

  await assert.rejects(
    () => startHeadlessConnect({ platform: 'facebook', profileId: 'p1', redirectUrl: 'https://app.example/cb' }),
    ZernioError,
  )
})

// ── the profile name ───────────────────────────────────────────────────

test('a brand profile is named after the brand id, never after the business', () => {
  // Profile names are unique within a Zernio TEAM and our team holds every
  // subscriber's profiles. Two customers both trading as "Bright Dental" is not
  // hypothetical, and the second would get a 409 they could do nothing about.
  const name = zernioProfileNameForBrand(BRAND)
  assert.equal(name, `nrs-${BRAND}`)
  assert.notEqual(zernioProfileNameForBrand(BRAND), zernioProfileNameForBrand(OTHER_BRAND))
  assert.ok(!/\s/.test(name), 'a profile name with a space in it is a human label')
})

// ── cookies and the tenant map ─────────────────────────────────────────

test('both connect cookies are httpOnly, lax and scoped to the connect path', () => {
  // The path is load-bearing and has bitten this codebase before: a cookie set
  // at one path and deleted at another survives its own use. `lax` is required
  // because the browser comes back by a top-level redirect from zernio.com.
  const options = connectCookieOptions()
  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, 'lax')
  assert.equal(options.path, '/api/zernio/connect')
  assert.equal(options.maxAge, CONNECT_STATE_TTL_MS / 1000)
})

/** The smallest thing that answers like a PostgREST query builder. */
function stubSupabase(rows: Array<Record<string, unknown>>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  }
  return { from: () => builder } as never
}

test('a disconnected mapping is not a live one', async () => {
  // The gate every route that acts on an accountId passes through. Zernio
  // validates an account id against the whole TEAM, so this row is the only
  // thing that says whose account it is.
  const live = await liveMappingFor(
    stubSupabase([{ platform: 'facebook', profile_id: 'p1', disconnected_at: null }]),
    { brandId: BRAND, accountId: 'acc-1' },
  )
  assert.deepEqual(live, { platform: 'facebook', profileId: 'p1' })

  const removed = await liveMappingFor(
    stubSupabase([{ platform: 'facebook', profile_id: 'p1', disconnected_at: '2026-08-18T00:00:00Z' }]),
    { brandId: BRAND, accountId: 'acc-1' },
  )
  assert.equal(removed, null)

  const missing = await liveMappingFor(stubSupabase([]), { brandId: BRAND, accountId: 'acc-1' })
  assert.equal(missing, null)
})

test('an already-mapped account is reported even when it was disconnected', async () => {
  // Deliberate: the callback uses this to leave existing rows alone. A
  // disconnected row is exactly the one a blanket re-map must not revive.
  const mapped = await mappedAccountIdsFor(
    stubSupabase([{ account_id: 'acc-1' }, { account_id: 'acc-2' }]),
    { brandId: BRAND, platform: 'facebook' },
  )
  assert.deepEqual([...mapped].sort(), ['acc-1', 'acc-2'])
})
