import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractCaptionDraftFromMessage } from './extract-caption-draft'

const SAMPLE = `**Caption:**
When it hits 35° and your colleagues ask what you're wearing — this is the answer.

Summer Hammer by Lorenzo Pazzaglia. Fresh, loud, unapologetically summer.

Shop: scentsell.com.au

**Hashtags:**
#scentsell #nichefragrance #lorenzopazzaglia #summerhammer #fragranceaustralia #secondhandfragrance #fragrancecommunity

**Platform:** TikTok
**Format:** Caption for existing 18s video
`

describe('extract-caption-draft', () => {
  it('extracts caption, hashtags and platform from structured Director reply', () => {
    const draft = extractCaptionDraftFromMessage(SAMPLE)
    assert.ok(draft)
    assert.match(draft.caption, /Summer Hammer/)
    assert.equal(draft.hashtags.length, 7)
    assert.equal(draft.hashtags[0], 'scentsell')
    assert.deepEqual(draft.platforms, ['tiktok'])
    assert.equal(draft.hashtagsAreSuggested, true)
  })

  it('extracts quoted caption before hashtag line (Compose desk reply shape)', () => {
    const text = `I checked the clip and here is a TikTok caption ready to paste.

"everyone's been talking about Lorenzo Pazzaglia's Summer Hammer — and it's sitting on Scent Sell right now, barely used, for way less than retail 👀 grab it before someone else does → scentsell.com.au"

#scentsell #nichefragrance #lorenzopazzaglia #summerhammer #fragranceaustralia #secondhandfragrance #fragrancecommunity

Platform: TikTok
`
    const draft = extractCaptionDraftFromMessage(text)
    assert.ok(draft)
    assert.match(draft.caption, /Summer Hammer/)
    assert.doesNotMatch(draft.caption, /I checked the clip/)
    assert.equal(draft.platforms[0], 'tiktok')
  })

  it('extracts from json:card post_preview', () => {
    const text = 'Here you go:\n```json:card\n{"__card":"post_preview","platform":"instagram","caption":"Hello world","hashtags":["scentsell","niche"]}\n```'
    const draft = extractCaptionDraftFromMessage(text)
    assert.ok(draft)
    assert.equal(draft.caption, 'Hello world')
    assert.deepEqual(draft.hashtags, ['scentsell', 'niche'])
    assert.deepEqual(draft.platforms, ['instagram'])
  })
})
