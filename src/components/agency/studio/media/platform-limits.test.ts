import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLATFORM_SIZE_CEILINGS,
  formatBytes,
  nameList,
  platformsThatWillRefuse,
  refusalsFromLiveLimits,
  tooLargeSentence,
} from './platform-limits'

test('a file under every ceiling names nobody', () => {
  assert.deepEqual(platformsThatWillRefuse(500_000), [])
  assert.equal(tooLargeSentence({ fileType: 'video/mp4', refusedBy: [] }), null)
})

test('refusals read worst-first', () => {
  const refused = platformsThatWillRefuse(9_000_000)
  assert.equal(refused[0], 'Bluesky')
  assert.ok(refused.includes('Instagram'))
  assert.ok(!refused.includes('Pinterest'))
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

test('the sentence says what it is and what to do', () => {
  assert.equal(
    tooLargeSentence({ fileType: 'video/mp4', refusedBy: ['Instagram'] }),
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
