import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  brandIsPublisherLinked,
  canonicalSocialPlatform,
  ownerFacingAccounts,
  ownerFacingPlatformLabel,
} from './social-read-source'
import { zernioProfileIdFromSocialUrls } from './overview-accounts'

test('a linked brand is recognised from social_urls', () => {
  assert.equal(brandIsPublisherLinked({ zernio_profile_id: 'prof_scent' }), true)
  assert.equal(brandIsPublisherLinked({ zernio_profile_id: '  ' }), false)
  assert.equal(brandIsPublisherLinked({}), false)
  assert.equal(zernioProfileIdFromSocialUrls({ zernio_profile_id: 'prof_scent' }), 'prof_scent')
})

test('Mixpost workspace accounts cannot leak onto a linked brand', () => {
  const mixpostWorkspace = [
    { id: 11, name: 'Downscale Weight Loss' },
    { id: 14, name: 'TeleScribe Australia' },
  ]
  const linked = [{ id: 'acc_ig', platform: 'instagram' }]

  const result = ownerFacingAccounts({
    linked: true,
    linkedAccounts: linked,
    mixpostBrandAccounts: mixpostWorkspace,
  })

  assert.deepEqual(result, linked)
})

test('an empty linked list still does not fall through to Mixpost', () => {
  const result = ownerFacingAccounts({
    linked: true,
    linkedAccounts: [],
    mixpostBrandAccounts: [{ id: 99, name: 'Someone else' }],
  })
  assert.deepEqual(result, [])
})

test('Mixpost-only brands keep the brand-mapped subset, not the workspace', () => {
  const mapped = [{ id: 3, name: 'Downscale Facebook' }]
  const result = ownerFacingAccounts({
    linked: false,
    linkedAccounts: [{ id: 'should-not-appear' }],
    mixpostBrandAccounts: mapped,
  })
  assert.deepEqual(result, mapped)
})

test('owner-facing platform labels never name a vendor', () => {
  assert.equal(ownerFacingPlatformLabel('instagram'), 'Instagram')
  assert.equal(ownerFacingPlatformLabel('facebook_page'), 'Facebook')
  assert.doesNotMatch(ownerFacingPlatformLabel('instagram'), /zernio|mixpost/i)
})

test('useSocialAccounts does not merge Mixpost onto a linked brand', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/hooks/useSocialAccounts.ts'),
    'utf8',
  )
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  assert.match(code, /\/api\/zernio\/accounts/, 'the hook must ask the session-scoped accounts route first')
  assert.match(code, /\.linked/, 'linked is the signal that Mixpost must not run')
  assert.doesNotMatch(
    code,
    /mergedAccounts/,
    'the old merge dumped the Mixpost workspace onto Scent Sell and EndorseMe',
  )
})

test('analytics/social asks the linked publisher when the brand has a profile', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/api/analytics/social/route.ts'),
    'utf8',
  )
  assert.match(source, /zernioProfileIdFromSocialUrls|brandIsPublisherLinked|profileId/)
  assert.match(source, /fetchZernioAnalytics/)
  assert.match(source, /fetchZernioAccounts/)
  assert.doesNotMatch(
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
    /['"]Zernio['"]|['"]Mixpost['"]/,
    'JSON the UI prints must not name a vendor',
  )
})

test('mixpost accounts route scopes by brandId and refuses linked brands', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/api/mixpost/accounts/route.ts'),
    'utf8',
  )
  assert.match(source, /brandId/)
  assert.match(source, /mapAccountsToBrandsRaw|brandIsPublisherLinked|zernioProfileIdFromSocialUrls/)
})

test('facebook_page and FACEBOOK both become facebook for the compose picker', () => {
  assert.equal(canonicalSocialPlatform('facebook_page'), 'facebook')
  assert.equal(canonicalSocialPlatform('FACEBOOK'), 'facebook')
  assert.equal(canonicalSocialPlatform('x'), 'twitter')
})
