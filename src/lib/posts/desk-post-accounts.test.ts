import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { accountsForDeskRow, type DeskConnectedAccount } from './desk-post-accounts.ts'

/**
 * A post has to say where it is going BEFORE it goes.
 *
 * The desk route used to build every row with `accounts: []`, so all 121 rows of
 * the live Scent Sell business fell through to the network-mark branch and the
 * owner could not see which page a draft was for. The account filter was built
 * from the same rows, so it could only ever offer accounts that appeared in
 * published history — a business with drafts and nothing published got an empty
 * dropdown.
 *
 * The rule below is deliberately the publisher's own rule
 * (`resolveDirectorAccountIds`): ticks win, otherwise the single account on that
 * network, otherwise nothing. Drawing an account the publisher would not choose
 * would be a worse lie than drawing a network mark.
 */

const FB: DeskConnectedAccount = {
  id: 'acct_fb',
  platform: 'facebook',
  name: 'Scent Sell',
  username: 'ScentSellAustralia',
}

const IG: DeskConnectedAccount = {
  id: 'acct_ig',
  platform: 'instagram',
  name: 'Scent Sell',
  username: 'scentsellsocials',
}

const IG_SECOND: DeskConnectedAccount = {
  id: 'acct_ig2',
  platform: 'instagram',
  name: 'Scent Sell Reviews',
  username: 'scentsellreviews',
}

const CONNECTED = [FB, IG]

test('a draft names the account it is going to, before it goes out', () => {
  const accounts = accountsForDeskRow({ platform: 'instagram', metadata: {} }, CONNECTED)
  assert.deepEqual(accounts, [
    { id: 'acct_ig', platform: 'instagram', name: 'Scent Sell', username: 'scentsellsocials' },
  ])
})

test('the handle travels with the account, because the name cannot tell them apart', () => {
  // Both live accounts are called "Scent Sell". Only the handle separates them,
  // so anywhere one is listed the handle has to be available to show.
  const facebook = accountsForDeskRow({ platform: 'facebook', metadata: {} }, CONNECTED)
  const instagram = accountsForDeskRow({ platform: 'instagram', metadata: {} }, CONNECTED)
  assert.equal(facebook[0]?.name, instagram[0]?.name)
  assert.notEqual(facebook[0]?.username, instagram[0]?.username)
  assert.equal(facebook[0]?.username, 'ScentSellAustralia')
})

test('ticked accounts win over the platform guess', () => {
  const accounts = accountsForDeskRow(
    { platform: 'instagram', metadata: { account_ids: ['acct_fb'] } },
    CONNECTED,
  )
  assert.deepEqual(accounts.map((a) => a.id), ['acct_fb'])
})

test('every ticked account is shown, not just the first', () => {
  const accounts = accountsForDeskRow(
    { platform: 'instagram', metadata: { account_ids: ['acct_ig', 'acct_ig2'] } },
    [...CONNECTED, IG_SECOND],
  )
  assert.deepEqual(accounts.map((a) => a.id), ['acct_ig', 'acct_ig2'])
})

test('a ticked account that is no longer connected is not drawn as connected', () => {
  const accounts = accountsForDeskRow(
    { platform: 'instagram', metadata: { account_ids: ['acct_gone'] } },
    CONNECTED,
  )
  assert.deepEqual(accounts, [], 'a disconnected page must not be shown as a destination')
})

test('two accounts on one network and no tick means we do not know which', () => {
  // Fail closed, exactly as the publisher does: the row genuinely does not say,
  // and naming one of them would name a page the post will never reach.
  const accounts = accountsForDeskRow(
    { platform: 'instagram', metadata: {} },
    [...CONNECTED, IG_SECOND],
  )
  assert.deepEqual(accounts, [])
})

test('a network with nothing connected shows no account', () => {
  assert.deepEqual(accountsForDeskRow({ platform: 'tiktok', metadata: {} }, CONNECTED), [])
  assert.deepEqual(accountsForDeskRow({ platform: 'instagram', metadata: {} }, []), [])
  assert.deepEqual(accountsForDeskRow({ platform: null, metadata: null }, CONNECTED), [])
})

test('the publisher stores facebook_page; the desk row stores facebook', () => {
  // Mixpost reports `facebook_page`, Zernio reports `facebook`. A row that
  // failed to match on that difference is how a connected page reads as none.
  const accounts = accountsForDeskRow({ platform: 'facebook', metadata: {} }, [
    { id: 'mx_7', platform: 'facebook_page', name: 'Downscale', username: 'downscaleau' },
  ])
  assert.deepEqual(accounts.map((a) => a.id), ['mx_7'])
})

/* ── The route must not go back to an empty array ─────────────────────────── */

const route = readFileSync(
  join(process.cwd(), 'src/app/api/scheduled-posts/route.ts'),
  'utf8',
)

test('the desk route resolves a row-s accounts rather than hard-coding none', () => {
  assert.match(route, /accountsForDeskRow/, 'desk rows must resolve their accounts')
  assert.ok(
    !/accounts:\s*\[\]/.test(route),
    'accounts: [] on every desk row is the bug this file exists for',
  )
})

test('the desk route lists the connected accounts once, not once per purpose', () => {
  assert.match(route, /connectedAccountsForBrand/)
  // History and the desk rows share one listing; asking the publisher twice for
  // the same answer on every page load is a round trip for nothing.
  assert.equal(
    (route.match(/await fetchZernioAccounts\(/g) ?? []).length,
    2,
    'one live listing plus the fallback inside readHistory',
  )
})
