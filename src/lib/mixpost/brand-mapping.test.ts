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

const TELESCRIBE = { id: 'brand-scribe', name: 'TeleScribe', slug: 'telescribe' }

function lapsed(id: number, name: string): MixpostAccount {
  return { ...account(id, name, 'facebook_page'), authorized: false }
}

test('a lapsed connection survives the pinned-account shortcut', () => {
  // Pinned accounts skip fuzzy matching entirely. The state of the connection
  // has to survive that shortcut, or a project whose accounts are pinned can
  // stop publishing without the board ever saying so.
  const brands = [{ ...TELESCRIBE, social_urls: { mixpost_account_ids: '[3]' } }]

  const mapped = mapMixpostAccountsToBrands([lapsed(3, 'TeleScribe Page')], brands)

  assert.equal(mapped[TELESCRIBE.id]?.length, 1)
  assert.equal(mapped[TELESCRIBE.id][0].authorized, false)
})

test('a lapsed connection survives fuzzy matching', () => {
  const mapped = mapMixpostAccountsToBrands([lapsed(3, 'TeleScribe Australia')], [TELESCRIBE])

  assert.equal(mapped[TELESCRIBE.id][0].authorized, false)
})

test('an account that does not report its state is treated as working', () => {
  // Older responses omit the field. Reading absence as "broken" would put
  // every project on the board asking to reconnect something that is fine.
  const mapped = mapMixpostAccountsToBrands(
    [account(7, 'TeleScribe Australia', 'facebook_page')],
    [TELESCRIBE],
  )

  assert.equal(mapped[TELESCRIBE.id][0].authorized, true)
})
