import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mapZernioAccountsForOverview,
  zernioProfileIdFromSocialUrls,
} from './overview-accounts'

test('a Zernio-linked brand is recognised from social_urls', () => {
  assert.equal(
    zernioProfileIdFromSocialUrls({ zernio_profile_id: 'prof_123' }),
    'prof_123',
  )
  assert.equal(zernioProfileIdFromSocialUrls({ zernio_profile_id: '  ' }), null)
  assert.equal(zernioProfileIdFromSocialUrls({}), null)
  assert.equal(zernioProfileIdFromSocialUrls(null), null)
})

test('Zernio accounts map to the overview shape without Mixpost fields', () => {
  const mapped = mapZernioAccountsForOverview([
    { id: 'a1', platform: 'instagram', displayName: 'Scent Sell', username: 'scentsell' },
    { id: 'a2', platform: 'facebook' },
  ])
  assert.deepEqual(mapped, [
    { platform: 'instagram', accountName: 'Scent Sell', provider: 'zernio' },
    { platform: 'facebook', accountName: 'facebook', provider: 'zernio' },
  ])
})

test('studio overview asks Zernio when the brand is linked', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/api/studio/overview/route.ts'),
    'utf8',
  )
  assert.match(
    source,
    /fetchZernioAccounts/,
    'overview must load Zernio accounts for a linked brand — Mixpost-only is how the dashboard lied after publish moved',
  )
  assert.match(source, /zernioProfileIdFromSocialUrls/)
})
