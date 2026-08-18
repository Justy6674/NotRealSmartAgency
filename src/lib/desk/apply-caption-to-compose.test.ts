import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyCaptionPayloadToCompose } from './apply-caption-to-compose'

describe('apply-caption-to-compose', () => {
  const payload = {
    brandId: '00000000-0000-4000-8000-000000000001',
    caption: 'Summer Hammer is live on Scent Sell.',
    hashtags: ['scentsell', 'nichefragrance'],
    platforms: ['tiktok' as const],
    hashtagsAreSuggested: true,
  }

  it('selects TikTok and fills master when no platforms chosen', () => {
    const result = applyCaptionPayloadToCompose(payload, {
      selectedPlatforms: [],
      versions: {},
      caption: '',
      hashtags: [],
    })
    assert.equal(result.caption, payload.caption)
    assert.deepEqual(result.selectedPlatforms, ['tiktok'])
    assert.equal(result.versions.tiktok?.caption, payload.caption)
    assert.equal(result.successLabel, 'Added to caption')
  })

  it('overrides TikTok only when multiple platforms already selected', () => {
    const result = applyCaptionPayloadToCompose(payload, {
      selectedPlatforms: ['instagram', 'tiktok'],
      versions: {
        instagram: { caption: 'ig', hashtags: [], isCustomised: false },
        tiktok: { caption: 'old', hashtags: [], isCustomised: false },
      },
      caption: 'master',
      hashtags: [],
    })
    assert.equal(result.appliedAsPlatformOverride, true)
    assert.equal(result.versions.tiktok?.caption, payload.caption)
    assert.equal(result.versions.tiktok?.isCustomised, true)
    assert.equal(result.versions.instagram?.caption, 'ig')
    assert.match(result.successLabel, /TikTok caption/i)
    assert.equal(result.showPerPlatformVersions, true)
  })
})
