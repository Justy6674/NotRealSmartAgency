import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { accountHandle, accountIdentityLine } from './account-identity.ts'

/**
 * Two of this owner's accounts are both called "Scent Sell".
 *
 * A Facebook page (@ScentSellAustralia) and an Instagram account
 * (@scentsellsocials) carry the same display name at the publisher, so anywhere
 * the product lists an account by name it is asking the owner to choose between
 * two identical rows. The handle is the only thing that separates them, so the
 * handle is shown wherever an account appears — the filter, the row, the
 * preview — and never left to a hover tooltip.
 */

const FB = { id: 'a', platform: 'facebook', name: 'Scent Sell', username: 'ScentSellAustralia' }
const IG = { id: 'b', platform: 'instagram', name: 'Scent Sell', username: 'scentsellsocials' }

test('two accounts sharing a name are told apart by their handle', () => {
  assert.equal(FB.name, IG.name)
  assert.notEqual(accountHandle(FB), accountHandle(IG))
  assert.equal(accountHandle(FB), '@ScentSellAustralia')
  assert.equal(accountHandle(IG), '@scentsellsocials')
  assert.notEqual(accountIdentityLine(FB), accountIdentityLine(IG))
})

test('a handle is written once, never twice', () => {
  assert.equal(accountHandle({ id: 'c', platform: 'instagram', name: 'X', username: '@already' }), '@already')
})

test('no handle falls back to the network, and never invents one', () => {
  const account = { id: 'd', platform: 'linkedin', name: 'Downscale' }
  assert.equal(accountHandle(account), 'LinkedIn')
  assert.equal(accountIdentityLine(account), 'Downscale · LinkedIn')
  assert.equal(accountHandle({ id: 'e', platform: 'tiktok', name: 'X', username: '  ' }), 'TikTok')
})

test('the owner is never shown a vendor name', () => {
  const line = accountIdentityLine(IG)
  assert.doesNotMatch(line, /zernio|mixpost|oauth|api/i)
})

/* ── Every surface that lists an account uses it ─────────────────────────── */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const DIR = 'src/components/agency/studio/posts'

test('the filter, the row and the preview all show the handle', () => {
  assert.match(read(`${DIR}/PostsFilters.tsx`), /accountHandle\(account\)/)
  assert.match(read(`${DIR}/PostsTable.tsx`), /accountHandle\(account\)/)
  assert.match(read(`${DIR}/PostPreviewModal.tsx`), /accountHandle\(account\)/)
})

test('the row shows the handle on the glass, not only in a title attribute', () => {
  const table = read(`${DIR}/PostsTable.tsx`)
  assert.match(table, /handleLine/, 'the handle must be rendered as text in the accounts cell')
})
