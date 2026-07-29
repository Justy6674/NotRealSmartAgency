import assert from 'node:assert/strict'
import test from 'node:test'
import { mapMixpostAccountsToBrands } from './brand-mapping.ts'
import type { MixpostAccount } from './client.ts'

function account(id: number, name: string, provider: string, username: string | null = null): MixpostAccount {
  return { id, name, username, provider, media_url: null }
}

const DOWNSCALE = { id: 'brand-downscale', name: 'Downscale Weight Loss', slug: 'downscale' }

test('an aliased account is not reassigned when its brand is retired', () => {
  // DownscaleDerm is deactivated, so only the weight loss clinic is active.
  // Its Instagram and Facebook page must belong to nobody rather than being
  // absorbed by the brand that happens to share a name prefix — publishing a
  // weight loss post to the skincare accounts is a cross-brand leak.
  const accounts = [
    account(1, 'downscale_weightloss', 'instagram'),
    account(2, 'downscalederm', 'instagram'),
    account(3, 'Downscale-Derm (Brisbane)', 'facebook_page'),
  ]

  const mapped = mapMixpostAccountsToBrands(accounts, [DOWNSCALE])
  const names = (mapped[DOWNSCALE.id] ?? []).map((m) => m.accountName)

  assert.deepEqual(names, ['downscale_weightloss'])
})

test('an aliased account still maps when its brand is active', () => {
  const derm = { id: 'brand-derm', name: 'DownscaleDerm', slug: 'downscalederm' }
  const accounts = [account(2, 'downscalederm', 'instagram')]

  const mapped = mapMixpostAccountsToBrands(accounts, [DOWNSCALE, derm])

  assert.equal(mapped[derm.id]?.[0]?.accountName, 'downscalederm')
  assert.equal(mapped[DOWNSCALE.id], undefined)
})

test('both Scent Sell handles map to the one project', () => {
  const scentSell = { id: 'brand-scentsell', name: 'Scent Sell', slug: 'scent-sell' }
  const accounts = [
    account(4, '_scentswap', 'instagram'),
    account(5, 'scentsellsocials', 'instagram'),
  ]

  const mapped = mapMixpostAccountsToBrands(accounts, [scentSell])

  assert.equal(mapped[scentSell.id]?.length, 2)
})

test('a personal account is never claimed by a brand', () => {
  const accounts = [account(6, 'Justin Black', 'linkedin')]

  const mapped = mapMixpostAccountsToBrands(accounts, [DOWNSCALE])

  assert.deepEqual(mapped, {})
})
