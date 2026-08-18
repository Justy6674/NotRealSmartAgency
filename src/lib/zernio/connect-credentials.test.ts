import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

process.env.ZERNIO_API_KEY = 'test-key'
process.env.ZERNIO_CONNECT_STATE_SECRET = 'test-connect-state-secret'

import {
  blueskyConnectState,
  BlueskyCredentialsRejected,
  checkTelegramConnect,
  connectBlueskyAccount,
  currentZernioUserId,
  resetZernioUserIdCache,
  startTelegramConnect,
} from './connect-credentials.ts'
import { ZernioError, ZernioHtmlResponseError } from './errors.ts'

/**
 * What these tests are actually holding down.
 *
 * Not "the functions work" — the three things that, when they go wrong, go
 * wrong silently:
 *
 *   1. The paths. A wrong path under zernio.com/api/v1 answers HTTP 200 with an
 *      HTML page, so a typo does not fail, it succeeds and returns nothing.
 *      Every call below asserts the exact URL and verb it made.
 *   2. The app password. It must appear in exactly one place — the request body
 *      going to the publisher — and nowhere else: not in a URL, not in an error
 *      message, not in the value handed back.
 *   3. The three Telegram answers. A fourth kind of answer must be a fault, not
 *      a fourth kind of "not yet", or the screen polls a dead code in silence.
 */

// ── fetch stubbing ─────────────────────────────────────────────────────

const realFetch = globalThis.fetch
const calls: Array<{ url: string; init: RequestInit }> = []

interface StubbedResponse {
  status?: number
  contentType?: string | null
  body?: string
}

function stubFetch(...queue: StubbedResponse[]): void {
  const remaining = [...queue]
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    const next = remaining.shift() ?? { status: 200, body: '{}' }
    const headers = new Headers()
    if (next.contentType !== null) headers.set('content-type', next.contentType ?? 'application/json')
    return new Response(next.body ?? '{}', { status: next.status ?? 200, headers })
  }) as typeof fetch
}

beforeEach(() => {
  resetZernioUserIdCache()
})

afterEach(() => {
  globalThis.fetch = realFetch
  calls.length = 0
})

const USER_ID = '6507a1b2c3d4e5f6a7b8c9d0'
const PROFILE_ID = '6a828fcdad7b3b2362f28fdf'
const APP_PASSWORD = 'abcd-efgh-ijkl-mnop'

const USERS_OK = { body: JSON.stringify({ currentUserId: USER_ID }) }

// ── the state string ───────────────────────────────────────────────────

test('the connect state is {userId}-{profileId}, in that order', () => {
  assert.equal(blueskyConnectState(USER_ID, PROFILE_ID), `${USER_ID}-${PROFILE_ID}`)
})

test('a dash inside either half is refused rather than sent as a guess', () => {
  // The dash is the separator. A dash inside one half means the publisher
  // splits it somewhere we did not intend, and the account lands on a profile
  // that is not this brand's — which is the one failure that cannot be seen
  // from the screen that caused it.
  assert.throws(() => blueskyConnectState('6507-a1b2', PROFILE_ID), ZernioError)
  assert.throws(() => blueskyConnectState(USER_ID, 'profile-1'), ZernioError)
})

test('an empty half is refused', () => {
  assert.throws(() => blueskyConnectState('', PROFILE_ID), ZernioError)
  assert.throws(() => blueskyConnectState(USER_ID, '   '), ZernioError)
})

// ── who the key belongs to ─────────────────────────────────────────────

test('the workspace user id is read from /users and then not asked for again', async () => {
  stubFetch(USERS_OK)

  assert.equal(await currentZernioUserId(), USER_ID)
  assert.equal(await currentZernioUserId(), USER_ID)

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, 'https://zernio.com/api/v1/users')
})

test('a failed lookup is not remembered as an answer', async () => {
  stubFetch({ status: 200, body: JSON.stringify({}) }, USERS_OK)

  await assert.rejects(currentZernioUserId(), ZernioError)
  assert.equal(await currentZernioUserId(), USER_ID)
})

// ── Bluesky ────────────────────────────────────────────────────────────

test('connecting Bluesky posts to /connect/bluesky/credentials with the state', async () => {
  stubFetch(USERS_OK, {
    body: JSON.stringify({
      message: 'Bluesky connected successfully',
      account: {
        _id: 'acc-1',
        platform: 'bluesky',
        username: 'yourhandle.bsky.social',
        displayName: 'Your Name',
      },
    }),
  })

  const account = await connectBlueskyAccount({
    identifier: 'yourhandle.bsky.social',
    appPassword: APP_PASSWORD,
    profileId: PROFILE_ID,
  })

  assert.equal(account.accountId, 'acc-1')
  assert.equal(account.platform, 'bluesky')
  assert.equal(account.username, 'yourhandle.bsky.social')

  const connect = calls[1]
  assert.equal(connect?.url, 'https://zernio.com/api/v1/connect/bluesky/credentials')
  assert.equal(connect?.init.method, 'POST')

  const body = JSON.parse(String(connect?.init.body)) as Record<string, unknown>
  assert.equal(body.identifier, 'yourhandle.bsky.social')
  assert.equal(body.appPassword, APP_PASSWORD)
  assert.equal(body.state, `${USER_ID}-${PROFILE_ID}`)
})

test('the app password never leaves the request body', async () => {
  stubFetch(USERS_OK, {
    body: JSON.stringify({ account: { _id: 'acc-1', platform: 'bluesky', username: 'a.bsky.social' } }),
  })

  const account = await connectBlueskyAccount({
    identifier: 'a.bsky.social',
    appPassword: APP_PASSWORD,
    profileId: PROFILE_ID,
  })

  // Not in any URL — a credential in a query string is written to every proxy
  // log between here and the publisher.
  for (const call of calls) assert.ok(!call.url.includes(APP_PASSWORD))
  // Not in what we hand back to the route, which hands it to the browser.
  assert.ok(!JSON.stringify(account).includes(APP_PASSWORD))
})

test('a refused credential is its own answer, not "could not reach the service"', async () => {
  stubFetch(USERS_OK, { status: 400, body: JSON.stringify({ error: 'Invalid credentials' }) })

  await assert.rejects(
    connectBlueskyAccount({ identifier: 'a.bsky.social', appPassword: APP_PASSWORD, profileId: PROFILE_ID }),
    (err: unknown) => {
      assert.ok(err instanceof BlueskyCredentialsRejected)
      // The sentence the owner reads names the fix and no credential.
      assert.match(err.ownerMessage, /app password/i)
      assert.ok(!err.ownerMessage.includes(APP_PASSWORD))
      assert.ok(!err.message.includes(APP_PASSWORD))
      return true
    },
  )
})

test('an HTML body is our wrong path, never the owner’s password', async () => {
  // 200 with a web page is what a wrong path answers. Reported as a bad app
  // password it would send the owner to revoke and regenerate a credential that
  // was correct all along.
  stubFetch(USERS_OK, { status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' })

  await assert.rejects(
    connectBlueskyAccount({ identifier: 'a.bsky.social', appPassword: APP_PASSWORD, profileId: PROFILE_ID }),
    (err: unknown) => {
      assert.ok(err instanceof ZernioHtmlResponseError)
      assert.ok(!(err instanceof BlueskyCredentialsRejected))
      return true
    },
  )
})

test('an account with no id is a failure, not a connection', async () => {
  stubFetch(USERS_OK, { body: JSON.stringify({ message: 'ok', account: { platform: 'bluesky' } }) })

  await assert.rejects(
    connectBlueskyAccount({ identifier: 'a.bsky.social', appPassword: APP_PASSWORD, profileId: PROFILE_ID }),
    ZernioError,
  )
})

// ── Telegram ───────────────────────────────────────────────────────────

test('asking for a code hits /connect/telegram with the profile', async () => {
  stubFetch({
    body: JSON.stringify({
      code: 'ZRN-ABC123',
      expiresAt: '2026-08-19T12:30:00.000Z',
      expiresIn: 900,
      botUsername: '@LateScheduleBot',
      instructions: ['1. Add the bot', '', '2. Send the code'],
    }),
  })

  const started = await startTelegramConnect(PROFILE_ID)

  assert.equal(calls[0]?.url, `https://zernio.com/api/v1/connect/telegram?profileId=${PROFILE_ID}`)
  assert.equal(started.code, 'ZRN-ABC123')
  assert.equal(started.expiresAt, '2026-08-19T12:30:00.000Z')
  // The @ is stripped once, here, so the link built from it is not `t.me/@bot`.
  assert.equal(started.botUsername, 'LateScheduleBot')
  assert.deepEqual(started.instructions, ['1. Add the bot', '2. Send the code'])
})

test('no code back is a failure — there would be nothing for the owner to send', async () => {
  stubFetch({ body: JSON.stringify({ expiresIn: 900 }) })
  await assert.rejects(startTelegramConnect(PROFILE_ID), ZernioError)
})

test('checking a code is a PATCH carrying the code, and pending is pending', async () => {
  stubFetch({ body: JSON.stringify({ status: 'pending', expiresAt: '2026-08-19T12:30:00.000Z' }) })

  const status = await checkTelegramConnect('ZRN-ABC123')

  assert.equal(calls[0]?.init.method, 'PATCH')
  assert.equal(calls[0]?.url, 'https://zernio.com/api/v1/connect/telegram?code=ZRN-ABC123')
  assert.equal(status.status, 'pending')
})

test('connected carries the account we will write the brand mapping from', async () => {
  stubFetch({
    body: JSON.stringify({
      status: 'connected',
      chatId: '-1001234567890',
      chatTitle: 'My Channel',
      chatType: 'channel',
      account: { _id: 'acc-tg-1', platform: 'telegram', username: 'mychannel', displayName: 'My Channel' },
    }),
  })

  const status = await checkTelegramConnect('ZRN-ABC123')

  assert.equal(status.status, 'connected')
  if (status.status !== 'connected') return
  assert.equal(status.account.accountId, 'acc-tg-1')
  assert.equal(status.account.platform, 'telegram')
  assert.equal(status.chatTitle, 'My Channel')
})

test('expired, and a code the publisher has forgotten, are the same answer', async () => {
  stubFetch({ body: JSON.stringify({ status: 'expired', message: 'Access code has expired.' }) })
  assert.equal((await checkTelegramConnect('ZRN-ABC123')).status, 'expired')

  calls.length = 0
  stubFetch({ status: 404, body: JSON.stringify({ error: 'Not found' }) })
  assert.equal((await checkTelegramConnect('ZRN-ABC123')).status, 'expired')
})

test('an unrecognised status is a fault, not a fourth kind of "not yet"', async () => {
  // Treated as pending, this would spin the owner's screen on a code that will
  // never complete, for the whole give-up window, saying nothing.
  stubFetch({ body: JSON.stringify({ status: 'something-new' }) })
  await assert.rejects(checkTelegramConnect('ZRN-ABC123'), ZernioError)
})

test('a wrong path on the status check does not read as expired', async () => {
  stubFetch({ status: 200, contentType: 'text/html', body: '<!doctype html>' })
  await assert.rejects(checkTelegramConnect('ZRN-ABC123'), ZernioHtmlResponseError)
})
