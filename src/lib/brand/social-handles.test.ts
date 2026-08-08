import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleFromUrl, socialHandles, socialHandlesPrompt } from './social-handles'

/** Scent Sell's real record, including the cruft that was reaching the model. */
const SCENT_SELL = {
  youtube: 'https://www.youtube.com/@ScentSellAustralia',
  facebook: 'https://www.facebook.com/ScentSellAustralia',
  instagram: 'https://www.instagram.com/scentsellsocials',
  tiktok: 'https://www.tiktok.com/@scentsell',
  instagram_legacy: 'https://www.instagram.com/_scentswap',
  mixpost_account_ids: '[11,14,6,15]',
}

test('handles come out of URLs with or without an @ in the path', () => {
  assert.equal(handleFromUrl('https://www.instagram.com/scentsellsocials'), '@scentsellsocials')
  assert.equal(handleFromUrl('https://www.tiktok.com/@scentsell'), '@scentsell')
  assert.equal(handleFromUrl('https://www.youtube.com/@ScentSellAustralia'), '@ScentSellAustralia')
  assert.equal(handleFromUrl('https://www.facebook.com/ScentSellAustralia/'), '@ScentSellAustralia')
})

test('no handle at all beats an invented one', () => {
  // A wrong @ in a caption tags a stranger.
  assert.equal(handleFromUrl('https://www.youtube.com/channel/UCabc123'), null)
  assert.equal(handleFromUrl('https://www.linkedin.com/company'), null)
  assert.equal(handleFromUrl('https://www.facebook.com/profile.php'), null)
  assert.equal(handleFromUrl('not a url'), null)
  assert.equal(handleFromUrl('https://www.instagram.com/'), null)
})

test('internal bookkeeping never reaches the model', () => {
  const found = socialHandles(SCENT_SELL)
  assert.ok(!found.some((h) => h.platform === 'mixpost_account_ids'),
    'Mixpost account ids are not an account anyone can tag')
})

test('a retired account is kept on record but never offered as a tag', () => {
  const found = socialHandles(SCENT_SELL)
  assert.ok(!found.some((h) => h.handle === '@_scentswap'),
    'the old handle was one edit away from being tagged in a live caption')
})

test('every live Scent Sell account is present, per platform', () => {
  const byPlatform = Object.fromEntries(socialHandles(SCENT_SELL).map((h) => [h.platform, h.handle]))
  assert.deepEqual(byPlatform, {
    facebook: '@ScentSellAustralia',
    instagram: '@scentsellsocials',
    tiktok: '@scentsell',
    youtube: '@ScentSellAustralia',
  })
})

test('the prompt says outright that the handles differ', () => {
  const prompt = socialHandlesPrompt(SCENT_SELL)!
  assert.match(prompt, /@scentsellsocials/)
  assert.match(prompt, /@scentsell\b/)
  assert.match(prompt, /NOT the same across platforms/)
  assert.ok(!prompt.includes('scentswap'), 'the dead account must not appear')
  assert.ok(!prompt.includes('11,14'), 'Mixpost ids must not appear')
})

test('a brand whose handle IS the same everywhere is not warned about nothing', () => {
  const prompt = socialHandlesPrompt({
    instagram: 'https://www.instagram.com/downscale',
    facebook: 'https://www.facebook.com/downscale',
  })!
  assert.ok(!prompt.includes('NOT the same across platforms'))
  assert.match(prompt, /never invent one|never invent a handle/i)
})

test('a brand with no socials produces nothing, not an empty heading', () => {
  assert.equal(socialHandlesPrompt(null), null)
  assert.equal(socialHandlesPrompt({}), null)
  assert.equal(socialHandlesPrompt({ mixpost_account_ids: '[1,2]' }), null)
})

test('the order is stable, so the prompt does not churn between runs', () => {
  const a = socialHandles(SCENT_SELL).map((h) => h.platform)
  const b = socialHandles({ tiktok: SCENT_SELL.tiktok, youtube: SCENT_SELL.youtube, facebook: SCENT_SELL.facebook, instagram: SCENT_SELL.instagram }).map((h) => h.platform)
  assert.deepEqual(a, b)
})
