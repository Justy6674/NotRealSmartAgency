import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SOCIAL_PLATFORM_CAPABILITIES } from './capabilities.ts'

test('every capability option key exists on the matching SDK *PlatformData type', () => {
  const sdk = readFileSync(resolve(process.cwd(), 'node_modules/@zernio/node/dist/index.d.ts'), 'utf8')
  const slices: Record<string, [string, string]> = {
    instagram: ['type InstagramPlatformData', 'type LinkedInPlatformData'],
    facebook: ['type FacebookPlatformData', 'type InstagramPlatformData'],
    tiktok: ['type TikTokPlatformData', 'type TwitterPlatformData'],
    youtube: ['type YouTubePlatformData', 'type YouTubeScopeMissingResponse'],
    linkedin: ['type LinkedInPlatformData', 'type TikTokPlatformData'],
    twitter: ['type TwitterPlatformData', 'type YouTubePlatformData'],
  }

  for (const [platform, capability] of Object.entries(SOCIAL_PLATFORM_CAPABILITIES)) {
    const [startNeedle, endNeedle] = slices[platform]!
    const start = sdk.indexOf(startNeedle)
    const end = sdk.indexOf(endNeedle)
    assert.ok(start >= 0 && end > start, `${platform} SDK type must be locatable`)
    const body = sdk.slice(start, end)
    for (const key of capability.optionKeys) {
      assert.match(body, new RegExp(`\\b${key}\\?:`), `${platform} capability ${key} must be an SDK field`)
    }
  }
})
