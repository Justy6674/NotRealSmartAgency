import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { composerFieldStatus, toZernioPlatformData } from './zernio-platform-data.ts'

const sdk = readFileSync(resolve(process.cwd(), 'node_modules/@zernio/node/dist/index.d.ts'), 'utf8')

test('every shipped Zernio key exists on the matching SDK type', () => {
  const slices: Record<string, [number, number]> = {
    instagram: [sdk.indexOf('type InstagramPlatformData'), sdk.indexOf('type LinkedInPlatformData')],
    facebook: [sdk.indexOf('type FacebookPlatformData'), sdk.indexOf('type InstagramPlatformData')],
    tiktok: [sdk.indexOf('type TikTokPlatformData'), sdk.indexOf('type TwitterPlatformData')],
    youtube: [sdk.indexOf('type YouTubePlatformData'), sdk.indexOf('type YouTubeScopeMissingResponse')],
  }
  const shipped = [
    ['instagram', 'firstComment'],
    ['instagram', 'instagramThumbnail'],
    ['facebook', 'contentType'],
    ['tiktok', 'privacyLevel'],
    ['tiktok', 'allowComment'],
    ['tiktok', 'allowDuet'],
    ['tiktok', 'allowStitch'],
    ['tiktok', 'videoMadeWithAi'],
    ['youtube', 'title'],
    ['youtube', 'visibility'],
    ['youtube', 'madeForKids'],
    ['youtube', 'categoryId'],
  ] as const

  for (const [platform, key] of shipped) {
    const [start, end] = slices[platform] ?? [-1, -1]
    assert.ok(start >= 0 && end > start, `${platform} SDK type must be locatable`)
    const body = sdk.slice(start, end)
    assert.match(body, new RegExp(`\\b${key}\\?:`), `${platform} SDK type must declare ${key}`)
  }
})

test('composer first comment and cover become Instagram SDK names', () => {
  assert.deepEqual(
    toZernioPlatformData({
      platform: 'instagram',
      options: { first_comment: 'Save this', cover_image_url: 'https://cdn.example/cover.jpg' },
    }),
    { firstComment: 'Save this', instagramThumbnail: 'https://cdn.example/cover.jpg' },
  )
})

test('TikTok privacy and disclosure use the SDK names, not the composer names', () => {
  assert.deepEqual(
    toZernioPlatformData({
      platform: 'tiktok',
      options: {
        privacy: 'private',
        allow_comments: false,
        allow_duet: true,
        allow_stitch: false,
        ai_disclosure: true,
        title: 'ignored on video',
      },
      postType: 'video',
    }),
    {
      privacyLevel: 'SELF_ONLY',
      allowComment: false,
      allowDuet: true,
      allowStitch: false,
      videoMadeWithAi: true,
    },
  )
})

test('YouTube privacy is visibility, shorts are not sent', () => {
  const data = toZernioPlatformData({
    platform: 'youtube',
    options: {
      title: 'Hibiscus Mahajad wear',
      privacy: 'unlisted',
      made_for_kids: false,
      shorts: true,
      category: '22',
    },
  })
  assert.deepEqual(data, {
    title: 'Hibiscus Mahajad wear',
    visibility: 'unlisted',
    madeForKids: false,
    categoryId: '22',
  })
  assert.equal(composerFieldStatus('youtube', 'shorts')?.ships, false)
})

test('invented composer keys and Facebook link preview are dropped', () => {
  assert.equal(
    toZernioPlatformData({
      platform: 'facebook',
      options: { link_preview: false, trialReel: true, commercialContent: true },
    }),
    undefined,
  )
  assert.equal(composerFieldStatus('facebook', 'link_preview')?.ships, false)
})

test('Facebook reel post_type becomes contentType reel', () => {
  assert.deepEqual(
    toZernioPlatformData({ platform: 'facebook', postType: 'reel', options: {} }),
    { contentType: 'reel' },
  )
})
