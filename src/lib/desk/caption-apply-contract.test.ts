import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '../..')

/**
 * Architectural contract: Director caption apply must wire store → PostCreator → editor sync.
 */
describe('caption apply contract', () => {
  it('MessageActions publishes desk actions and exposes Use on post', () => {
    const src = readFileSync(join(SRC, 'components/agency/MessageActions.tsx'), 'utf8')
    assert.match(src, /enqueueDeskActions/)
    assert.match(src, /captionDraftToDeskActions/)
    assert.match(src, /Use on post/)
    assert.match(src, /data-testid="use-on-post"/)
    assert.match(src, /extractCaptionDraftFromMessage/)
  })

  it('PostCreator consumes pendingDeskActions and bumps editor sync key', () => {
    const src = readFileSync(join(SRC, 'components/agency/studio/post/PostCreator.tsx'), 'utf8')
    assert.match(src, /pendingDeskActions/)
    assert.match(src, /applyDeskActionsToCompose/)
    assert.match(src, /captionEditorKey/)
    assert.match(src, /data-caption-editor/)
  })

  it('RichCaptionEditor desk mode uses brand paper tokens on ProseMirror', () => {
    const src = readFileSync(join(SRC, 'components/agency/studio/post/RichCaptionEditor.tsx'), 'utf8')
    assert.match(src, /data-caption-surface/)
    assert.match(src, /var\(--bg\)/)
    assert.match(src, /var\(--ink\)/)
  })

  it('DirectorRail passes rail variant to ChatMessage', () => {
    const src = readFileSync(join(SRC, 'components/agency/shell/DirectorRail.tsx'), 'utf8')
    assert.match(src, /variant="rail"/)
  })
})
