import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMcpDraftMediaAttachment } from './draft-post-tool'

test('draft_post rejects a requested media item that is not available in this project', () => {
  const result = resolveMcpDraftMediaAttachment('11111111-1111-1111-1111-111111111111', null)

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.error, /requested media/i)
    assert.match(result.error, /upload_media/i)
  }
})

test('draft_post keeps an authorised requested media item attached', () => {
  const media = {
    id: '11111111-1111-1111-1111-111111111111',
    file_url: 'https://example.com/video.mp4',
    file_type: 'video/mp4',
    thumbnail_url: null,
  }

  assert.deepEqual(resolveMcpDraftMediaAttachment(media.id, media), {
    ok: true,
    media,
  })
})
