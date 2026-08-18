import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildComposeDeskIntent,
  composeDeskIsActive,
  composeDirectorIdleCopy,
  wrapComposeDirectorPrompt,
} from './compose-desk'

describe('compose-desk', () => {
  const snapshot = {
    screen: 'compose' as const,
    brandId: 'brand-1',
    contentType: 'short_video',
    mediaItemIds: ['media-1'],
    mediaLabels: ['Summer Hammer.mp4'],
    mediaTypes: ['video/mp4'],
    platforms: ['instagram', 'facebook'],
    updatedAt: Date.now(),
  }

  it('is active when media is attached', () => {
    assert.equal(composeDeskIsActive(snapshot), true)
  })

  it('builds intent with media and platforms', () => {
    const intent = buildComposeDeskIntent(snapshot)
    assert.match(intent, /Summer Hammer/)
    assert.match(intent, /instagram/)
  })

  it('wraps wand prompts with desk facts', () => {
    const wrapped = wrapComposeDirectorPrompt(snapshot, 'Write my caption')
    assert.match(wrapped, /media-1/)
    assert.match(wrapped, /Write my caption/)
  })

  it('idle copy asks about the clip when caption empty', () => {
    const { body } = composeDirectorIdleCopy(snapshot)
    assert.match(body, /Summer Hammer/)
    assert.match(body, /caption/i)
  })
})
