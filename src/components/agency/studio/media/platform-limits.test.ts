import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLATFORM_SIZE_CEILINGS,
  formatBytes,
  mediaKindFor,
  nameList,
  platformsThatWillRefuse,
  refusalsFromLiveLimits,
  tooLargeSentence,
} from './platform-limits'

/** The owner's clip, the one the library called too large for ten platforms. */
const HIS_CLIP_BYTES = 23_300_000

/** Scent Sell posts from these four and nothing else. */
const SCENT_SELL = ['facebook', 'instagram', 'tiktok', 'youtube']

test('a file under every ceiling names nobody', () => {
  assert.deepEqual(platformsThatWillRefuse(500_000, { fileType: 'image/png' }), [])
  assert.equal(tooLargeSentence({ fileType: 'video/mp4', refusedBy: [] }), null)
})

test('his 23.3 MB clip is refused by nobody at all', () => {
  // The fault this file exists to keep closed. One table of PICTURE ceilings
  // applied to a video listed ten platforms; every one of them was wrong.
  assert.deepEqual(platformsThatWillRefuse(HIS_CLIP_BYTES, { fileType: 'video/mp4' }), [])
  assert.equal(
    tooLargeSentence({
      fileType: 'video/mp4',
      refusedBy: platformsThatWillRefuse(HIS_CLIP_BYTES, { fileType: 'video/mp4' }),
    }),
    null,
  )
})

test('Instagram, Facebook and TikTok all take a 23.3 MB video', () => {
  const refused = platformsThatWillRefuse(HIS_CLIP_BYTES, { fileType: 'video/mp4' })
  for (const platform of ['Instagram', 'Facebook', 'TikTok']) {
    assert.ok(!refused.includes(platform), `${platform} should accept a 23.3 MB video`)
  }
})

test('the same 23.3 MB as a picture is a different answer entirely', () => {
  // Not a contradiction — proof the two columns are separate. Ten platforms
  // refuse a picture this size, which is exactly what he was shown for a video.
  const refused = platformsThatWillRefuse(HIS_CLIP_BYTES, { fileType: 'image/jpeg' })
  assert.equal(refused.length, 10)
  assert.ok(refused.includes('Instagram'))
  assert.ok(refused.includes('Facebook'))
  assert.ok(!refused.includes('Discord'))
})

test('picture refusals read worst-first', () => {
  const refused = platformsThatWillRefuse(9_000_000, { fileType: 'image/png' })
  assert.equal(refused[0], 'Bluesky')
  assert.ok(refused.includes('Instagram'))
  assert.ok(!refused.includes('Pinterest'))
})

test('a video large enough to be refused still says so', () => {
  // 400 MB is past Instagram's 300 MB video ceiling and past Bluesky's 50 MB.
  const refused = platformsThatWillRefuse(400_000_000, { fileType: 'video/mp4' })
  assert.equal(refused[0], 'Discord')
  assert.ok(refused.includes('Instagram'))
  assert.ok(!refused.includes('Facebook'), 'Facebook takes video into the gigabytes')
})

test('only the accounts this business has are ever named', () => {
  const refused = platformsThatWillRefuse(HIS_CLIP_BYTES, {
    fileType: 'image/jpeg',
    connected: SCENT_SELL,
  })
  assert.deepEqual(refused, ['Instagram', 'Facebook', 'TikTok'])
  assert.ok(!refused.includes('Bluesky'), 'he does not post to Bluesky')
})

test('a business with nothing connected is told nothing', () => {
  assert.deepEqual(
    platformsThatWillRefuse(500_000_000, { fileType: 'image/jpeg', connected: [] }),
    [],
  )
})

test('account spellings are normalised before scoping', () => {
  // Mixpost says facebook_page, the publisher says FACEBOOK.
  const refused = platformsThatWillRefuse(HIS_CLIP_BYTES, {
    fileType: 'image/jpeg',
    connected: ['facebook_page', 'INSTAGRAM'],
  })
  assert.deepEqual(refused, ['Instagram', 'Facebook'])
})

test('a file we cannot identify is only flagged when it is certain', () => {
  assert.equal(mediaKindFor('application/octet-stream'), 'unknown')
  // 40 MB is past every picture ceiling but past only one video ceiling, so
  // the only platform named is the one whose answer is the same either way.
  assert.deepEqual(platformsThatWillRefuse(40_000_000, { fileType: undefined }), ['Discord'])
  // The same bytes, known to be a picture, is a twelve-platform answer.
  assert.equal(platformsThatWillRefuse(40_000_000, { fileType: 'image/jpeg' }).length, 12)
})

test('the video column is never smaller than the picture column', () => {
  // The whole fault in one assertion: picture numbers pasted into the video
  // column is how a 23.3 MB clip got refused by ten platforms.
  for (const platform of PLATFORM_SIZE_CEILINGS) {
    if (platform.picture === null || platform.video === null) continue
    assert.ok(
      platform.video >= platform.picture,
      `${platform.label}: video ${platform.video} < picture ${platform.picture}`,
    )
  }
})

test('every platform in the table has at least one known ceiling', () => {
  for (const platform of PLATFORM_SIZE_CEILINGS) {
    assert.ok(
      platform.picture !== null || platform.video !== null,
      `${platform.label} has no ceiling at all`,
    )
  }
})

test('X is never named — the owner does not use it', () => {
  assert.ok(!PLATFORM_SIZE_CEILINGS.some((p) => p.key === 'twitter' || p.label === 'X'))
  const live = refusalsFromLiveLimits({
    twitter: { limit: 5_000_000, limitFormatted: '5 MB', withinLimit: false },
    instagram: { limit: 8_000_000, limitFormatted: '8 MB', withinLimit: false },
  })
  assert.deepEqual(live, ['Instagram'])
})

test('the live answer keeps a platform we have never heard of', () => {
  const live = refusalsFromLiveLimits({
    kumospace: { limit: 2_000_000, limitFormatted: '2 MB', withinLimit: false },
  })
  assert.deepEqual(live, ['Kumospace'])
})

test('the live answer is scoped to his accounts too', () => {
  const live = refusalsFromLiveLimits(
    {
      bluesky: { limit: 52_428_800, limitFormatted: '50.0 MB', withinLimit: false },
      instagram: { limit: 314_572_800, limitFormatted: '300.0 MB', withinLimit: false },
      discord: { limit: 26_214_400, limitFormatted: '25.0 MB', withinLimit: false },
    },
    { connected: SCENT_SELL },
  )
  assert.deepEqual(live, ['Instagram'])
})

test('the sentence says what it is and what to do', () => {
  const bigVideo = platformsThatWillRefuse(400_000_000, {
    fileType: 'video/mp4',
    connected: ['instagram'],
  })
  assert.equal(
    tooLargeSentence({ fileType: 'video/mp4', refusedBy: bigVideo }),
    'This video is too large for Instagram — trim it or pick another.',
  )
  assert.equal(
    tooLargeSentence({ fileType: 'image/png', refusedBy: ['Bluesky', 'Instagram', 'Threads'] }),
    'This picture is too large for Bluesky, Instagram and Threads — trim it or pick another.',
  )
})

test('lists are joined the way a person reads them', () => {
  assert.equal(nameList([]), '')
  assert.equal(nameList(['Instagram']), 'Instagram')
  assert.equal(nameList(['Instagram', 'Threads']), 'Instagram and Threads')
})

test('sizes are rounded the way a person reads them', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(900), '900 B')
  assert.equal(formatBytes(2048), '2 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB')
  assert.equal(formatBytes(3 * 1024 * 1024 * 1024), '3.0 GB')
})
