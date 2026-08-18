import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  campaignBelongsToBrand,
  fetchZernioAccounts,
  findOwnedZernioCampaign,
  listOwnedZernioCampaigns,
  normaliseAccount,
  normaliseAdCampaign,
  setZernioCampaignStatus,
} from './client.ts'

/**
 * Zernio does not scope accounts to a profile. We do.
 *
 * `listAccounts({ profileId })` accepts the argument and ignores it. Measured
 * against the live account on 2026-08-17: ten accounts returned with the filter,
 * the same ten without it. Zernio's multi-tenant guide states the rule directly —
 * validation is "against your whole team, not against a profile", and the
 * integrator must "only pass a customer their own account IDs".
 *
 * This was not theoretical. `fetchZernioAccounts(profileId)` carried a comment
 * asserting the filter worked, and callers used its result to answer "does this
 * account belong to this brand". Against an unfiltered list that answer is always
 * yes, so an ownership check built on it permitted every account in the team —
 * one customer reading another's. Separately, the same social accounts sit under
 * more than one profile, so a publisher matching on platform alone could match
 * twice and post identical content twice to one page.
 *
 * Asserted against the source because reproducing it needs live credentials and
 * a second populated profile, which a unit test has neither of.
 */

const source = readFileSync(
  join(process.cwd(), 'src/lib/zernio/client.ts'),
  'utf8',
)

/**
 * Comments in this file quote the very expressions under test — the doc comment
 * on normaliseAccount spells out `a.profileId === profileId` while explaining the
 * bug it exists to prevent. Searching raw text therefore finds prose before code
 * and reports a fault that is not there. Order is checked against code only.
 */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

test('accounts are filtered by profile in our code, not left to Zernio', () => {
  assert.match(
    source,
    /a\.profileId === profileId/,
    'fetchZernioAccounts must filter by each account\'s own profileId — Zernio ignores the argument',
  )
})

test('the filter is applied after normalisation', () => {
  // The raw field is sometimes a populated {_id, name} object rather than a
  // string. Comparing before normaliseAccount runs is the object-vs-string
  // mismatch that already made the publish cron never select Zernio at all.
  const filterAt = code.indexOf('a.profileId === profileId')
  const normaliseAt = code.indexOf('accounts.map(normaliseAccount)')
  assert.ok(filterAt > -1 && normaliseAt > -1, 'expected both the filter and the normalise step')
  assert.ok(
    filterAt > normaliseAt,
    'filtering before normalisation compares an object to a string and silently matches nothing',
  )
})

test('the discredited claim that Zernio filters is not restored', () => {
  assert.doesNotMatch(
    source,
    /The Zernio API accepts profileId as a filter/,
    'that comment was measured false — restoring it invites the ownership bug back',
  )
})

test('listPosts is filtered by our scoped account ids after normalisation', () => {
  // listPosts({ profileId }) is the same trap as listAccounts. Isolation is
  // the account-id set from fetchZernioAccounts, applied after normalisePost
  // because platforms[].accountId is sometimes a populated {_id} object.
  const filterAt = code.indexOf('post.accountIds.some')
  const normaliseAt = code.indexOf('rawPosts.map(normalisePost)')
  assert.ok(filterAt > -1 && normaliseAt > -1, 'expected fetchZernioPosts to normalise then filter by allowed account ids')
  assert.ok(
    filterAt > normaliseAt,
    'filtering posts before normalisation compares an object to a string and silently matches nothing',
  )
  assert.match(code, /fetchZernioAccounts\(profileId\)/)
})

/*
 * Behaviour, not only source text.
 *
 * Everything above reads client.ts as a string, because reproducing the
 * original outage needs live credentials and a second populated profile. That
 * has a cost, and it was paid on 2026-08-19: `normaliseAccount` read only `_id`
 * off a populated `profileId` while `zernioIdOf` reads `id ?? _id`, so an SDK
 * release populating the reference as `{id, name}` would have dropped the
 * profileId from every account, matched nothing in the filter, and returned no
 * accounts for any brand — a total silent publishing outage that every text
 * assertion above would have watched go past.
 *
 * The tests below therefore run the code. `@zernio/node` goes through the
 * global fetch, so one stub covers both the SDK and the raw ads calls.
 */

const realFetch = globalThis.fetch
const realKey = process.env.ZERNIO_API_KEY

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return String(input)
}

/** Route by path: accounts come from the SDK, campaigns from a raw fetch. */
function stubZernio(bodies: { accounts?: unknown[]; campaigns?: unknown[] }) {
  globalThis.fetch = (async (input: unknown) => {
    const url = urlOf(input)
    if (url.includes('/ads/campaigns')) return Response.json({ campaigns: bodies.campaigns ?? [] })
    return Response.json({ accounts: bodies.accounts ?? [] })
  }) as typeof fetch
}

beforeEach(() => {
  process.env.ZERNIO_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realKey === undefined) delete process.env.ZERNIO_API_KEY
  else process.env.ZERNIO_API_KEY = realKey
})

test('a populated profileId is read in both shapes, not just _id', () => {
  assert.equal(
    normaliseAccount({ _id: 'acc-1', platform: 'facebook', profileId: { _id: 'p-1', name: 'A' } }).profileId,
    'p-1',
  )
  assert.equal(
    normaliseAccount({ _id: 'acc-2', platform: 'facebook', profileId: { id: 'p-1', name: 'A' } }).profileId,
    'p-1',
    'reading only _id here empties every brand\'s account list the day the SDK populates `id`',
  )
  assert.equal(
    normaliseAccount({ _id: 'acc-3', platform: 'facebook', profileId: 'p-1' }).profileId,
    'p-1',
  )
})

test('fetchZernioAccounts returns this brand\'s accounts and no others', async () => {
  stubZernio({
    accounts: [
      { _id: 'acc-a', platform: 'facebook', profileId: { id: 'profile-a', name: 'Brand A' } },
      { _id: 'acc-b', platform: 'instagram', profileId: { _id: 'profile-b', name: 'Brand B' } },
      { _id: 'acc-none', platform: 'linkedin' },
    ],
  })

  const own = await fetchZernioAccounts('profile-a')

  assert.deepEqual(own.map((a) => a.id), ['acc-a'])
})

test('a campaign that names neither our account nor our profile is not ours', () => {
  const scope = { profileId: 'profile-a', accountIds: ['acc-a'] }

  assert.equal(
    campaignBelongsToBrand(normaliseAdCampaign({ platformCampaignId: 'c1', accountId: 'acc-a' }), scope),
    true,
  )
  assert.equal(
    campaignBelongsToBrand(normaliseAdCampaign({ platformCampaignId: 'c1', profileId: { id: 'profile-a' } }), scope),
    true,
    'a populated profile reference must be read the same way here as on an account',
  )
  assert.equal(
    campaignBelongsToBrand(normaliseAdCampaign({ platformCampaignId: 'c1', accountId: 'acc-b' }), scope),
    false,
  )
  assert.equal(
    campaignBelongsToBrand(normaliseAdCampaign({ platformCampaignId: 'c1' }), scope),
    false,
    'an unattributable row must be excluded, never kept',
  )
})

test('another tenant\'s campaign cannot be found through our brand', async () => {
  // The live failure this closes: tenant A posts their own brandId with tenant
  // B's platformCampaignId. Zernio hands back the whole team's campaigns, as it
  // always has. Our filter is what stops the pause.
  stubZernio({
    accounts: [{ _id: 'acc-a', platform: 'facebook', profileId: 'profile-a' }],
    campaigns: [
      { platformCampaignId: 'ours', platform: 'facebook', accountId: 'acc-a', profileId: 'profile-a' },
      { platformCampaignId: 'theirs', platform: 'facebook', accountId: 'acc-b', profileId: 'profile-b' },
      { platformCampaignId: 'orphan', platform: 'facebook' },
    ],
  })

  const listed = await listOwnedZernioCampaigns('profile-a')
  assert.equal(listed.ok, true)
  assert.deepEqual(
    listed.ok === true && listed.campaigns.map((c) => c.platformCampaignId),
    ['ours'],
  )
  assert.equal(listed.ok === true && listed.withheld, 2, 'withheld rows are counted, not hidden')

  const mine = await findOwnedZernioCampaign('profile-a', 'ours')
  assert.equal(mine.ok, true)

  const theirs = await findOwnedZernioCampaign('profile-a', 'theirs')
  assert.equal(theirs.ok, false)
  assert.equal(theirs.ok === false && theirs.reason, 'not_owned')

  const orphan = await findOwnedZernioCampaign('profile-a', 'orphan')
  assert.equal(orphan.ok === false && orphan.reason, 'not_owned')
})

test('a status change refuses a campaign outside the scope it is given', async () => {
  stubZernio({ campaigns: [] })
  const theirs = normaliseAdCampaign({ platformCampaignId: 'theirs', platform: 'facebook', accountId: 'acc-b' })

  await assert.rejects(
    () => setZernioCampaignStatus(theirs, 'paused', { profileId: 'profile-a', accountIds: ['acc-a'] }),
    /not this brand/,
    'the gate must sit at the exit, so a future route cannot skip it',
  )
})

test('nothing but its own test imports the unscoped campaign transport', () => {
  // `listZernioCampaigns` returns the whole team's campaigns; the profileId it
  // takes is a payload hint, not a boundary. It stays exported so campaigns.
  // test.ts can pin its error discrimination, and it must stay unreachable from
  // anything that shows or changes a campaign — that reachability was the leak.
  const roots = ['src/app', 'src/lib', 'src/components']
  const allowed = new Set(['src/lib/zernio/client.ts', 'src/lib/zernio/campaigns.test.ts'])
  const offenders: string[] = []

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        walk(rel)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || allowed.has(rel)) continue
      const text = readFileSync(join(process.cwd(), rel), 'utf8')
      if (/import\s*(?:type\s*)?\{[^}]*\blistZernioCampaigns\b[^}]*\}\s*from/.test(text)) offenders.push(rel)
    }
  }
  roots.forEach(walk)

  assert.deepEqual(
    offenders,
    [],
    'use listOwnedZernioCampaigns / findOwnedZernioCampaign — the unscoped list is not proof of ownership',
  )
})
