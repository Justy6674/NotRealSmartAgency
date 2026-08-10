import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMcpUploadContentType } from './upload-media'

test('MCP raw video uploads retain their declared video MIME type', () => {
  assert.deepEqual(resolveMcpUploadContentType('video/mp4; codecs="avc1"'), {
    ok: true,
    contentType: 'video/mp4',
    extension: 'mp4',
    isVideo: true,
  })
})

test('MCP upload_media rejects files outside supported image and video types', () => {
  const result = resolveMcpUploadContentType('application/pdf')

  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /image or video/i)
})
