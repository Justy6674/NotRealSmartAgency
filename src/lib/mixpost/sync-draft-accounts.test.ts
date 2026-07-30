import assert from 'node:assert/strict'
import test from 'node:test'
import { mapAccountsToBrandsRaw } from './brand-mapping.ts'
import { resolveAccountIdsForPlatform } from './client.ts'
import type { MixpostAccount } from './client.ts'

/**
 * The cross-brand leak, held shut.
 *
 * Every account in the workspace was passed to the resolver, which filters
 * only by platform. A draft therefore went to every account on that platform
 * across every project — an Underground Parfums post was queued to publish on
 * the Downscale weight loss clinic's Instagram. One approval would have put
 * fragrance copy on a regulated health account.
 */

function account(id: number, name: string, provider: string): MixpostAccount {
  return { id, name, username: null, provider, media_url: null }
}

const ACCOUNTS = [
  account(1, 'undergroundparfums', 'instagram'),
  account(2, 'Scent Sell', 'instagram'),
  account(3, 'Downscale Weight Loss Clinic', 'instagram'),
  account(4, 'TeleScribe', 'instagram'),
  account(5, 'Underground Parfums', 'facebook_page'),
]

const BRANDS = [
  { id: 'b-ug', name: 'Underground Parfums', slug: 'underground-parfums' },
  { id: 'b-ss', name: 'Scent Sell', slug: 'scent-sell' },
  { id: 'b-ds', name: 'Downscale Weight Loss', slug: 'downscale' },
]

test('a draft reaches only its own project accounts', () => {
  const byBrand = mapAccountsToBrandsRaw(ACCOUNTS, BRANDS)
  const mine = byBrand.get('b-ug') ?? []
  const ids = resolveAccountIdsForPlatform('instagram', mine)

  assert.deepEqual(ids, [1], 'only Underground Parfums own Instagram may receive it')
})

test('resolving against every workspace account is the bug, and it is visible', () => {
  // The old call site passed all accounts. Kept as a test so the difference
  // is explicit: same resolver, wrong input, four wrong destinations.
  const wrong = resolveAccountIdsForPlatform('instagram', ACCOUNTS)
  assert.equal(wrong.length, 4, 'unfiltered input reaches every Instagram account')
  assert.ok(wrong.includes(3), 'including the regulated health clinic')
})

test('a project with no account of that platform resolves to nothing, not to everything', () => {
  const byBrand = mapAccountsToBrandsRaw(ACCOUNTS, BRANDS)
  const scentSell = byBrand.get('b-ss') ?? []
  assert.deepEqual(resolveAccountIdsForPlatform('facebook_page', scentSell), [])
})

test('a regulated project never receives another project content', () => {
  const byBrand = mapAccountsToBrandsRaw(ACCOUNTS, BRANDS)
  const downscale = (byBrand.get('b-ds') ?? []).map((a) => a.id)
  assert.deepEqual(downscale, [3])
  for (const other of ['b-ug', 'b-ss']) {
    const ids = (byBrand.get(other) ?? []).map((a) => a.id)
    assert.ok(!ids.includes(3), `${other} must not reach the clinic account`)
  }
})
