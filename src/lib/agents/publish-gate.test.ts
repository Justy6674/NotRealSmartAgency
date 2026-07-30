import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { checkPublishAllowed } from './publish-gate.ts'

const UNREGULATED = { ahpra: false, tga: false, tga_categories: [] }

test('an unregulated project publishes without a regulatory review', async () => {
  const gate = await checkPublishAllowed({
    content: 'A post about fragrance.',
    complianceFlags: UNREGULATED,
  })

  assert.equal(gate.allowed, true)
  assert.equal(gate.reason, null)
})

test('a missing compliance record is treated as unregulated, not as a block', async () => {
  // Every project row carries flags, so an absent value means the field was not
  // selected — blocking there would stop all publishing on a query change.
  const gate = await checkPublishAllowed({ content: 'A post.', complianceFlags: null })

  assert.equal(gate.allowed, true)
})

test('a regulated project is blocked when local brand rules already fail', async () => {
  // Reaches a verdict without the model: the local never-do check fires first.
  const gate = await checkPublishAllowed({
    content: 'Results are guaranteed.',
    complianceFlags: { ahpra: true, tga: false, tga_categories: [] },
    brandDNA: { never_do: ['guaranteed_outcomes'] },
  })

  assert.equal(gate.allowed, false)
  assert.match(gate.reason ?? '', /AHPRA/)
  assert.match(gate.reason ?? '', /guaranteed/i)
})

test('the block message names the regime that stopped it', async () => {
  const gate = await checkPublishAllowed({
    content: 'Results are guaranteed.',
    complianceFlags: { ahpra: false, tga: true, tga_categories: [] },
    brandDNA: { never_do: ['guaranteed_outcomes'] },
    label: 'scheduled post 42',
  })

  assert.equal(gate.allowed, false)
  assert.match(gate.reason ?? '', /TGA/)
  assert.match(gate.reason ?? '', /scheduled post 42/)
})

// Contract tests. Each pins a route that previously reached a live account with
// no regulatory review at all.

test('the scheduled publisher runs the gate before the platform call', () => {
  const source = readFileSync(
    new URL('../../app/api/cron/publish-posts/route.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /checkPublishAllowed/)
  // It has to select the flags it passes, or the gate always sees undefined.
  assert.match(source, /compliance_flags/)
  assert.match(source, /if \(!gate\.allowed\)/)
  // A blocked post is recorded, not silently skipped.
  assert.match(source, /status: 'failed', error: gate\.reason/)
})

test('the direct publisher dispatcher runs the gate before any platform call', () => {
  const source = readFileSync(
    new URL('../publishers/dispatcher.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /checkPublishAllowed/)
  // Must precede rate limiting and media validation, or a blocked post can
  // still consume quota and reach a platform.
  assert.ok(source.indexOf('checkPublishAllowed') < source.indexOf('canPublish'))
})

test('the Meta sign-in only files Pages belonging to the connecting project', () => {
  const source = readFileSync(
    new URL('../../app/api/oauth/meta/callback/route.ts', import.meta.url),
    'utf8',
  )

  // Without this filter, one sign-in put every Page the owner administers under
  // a single project, and a weight-loss post could publish to a men's health Page.
  assert.match(source, /pageBelongsToBrand/)
  assert.match(source, /skippedAccounts/)
})

test('the token store refuses to guess between several accounts', () => {
  const source = readFileSync(
    new URL('../publishers/token-store.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /data\.length > 1 && !accountId/)
  assert.doesNotMatch(source, /\.order\('updated_at', \{ ascending: false \}\)\s*\.limit\(1\)/)
})
