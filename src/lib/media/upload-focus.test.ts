import assert from 'node:assert/strict'
import test from 'node:test'
import {
  messageRequestsMediaUploadFocus,
} from '@/lib/media/upload-focus'

test('chat upload phrases open the picker or focus the drop zone', () => {
  assert.equal(messageRequestsMediaUploadFocus('open media'), 'dropzone')
  assert.equal(messageRequestsMediaUploadFocus('upload a video'), 'picker')
  assert.equal(messageRequestsMediaUploadFocus('I want to upload media'), 'picker')
  assert.equal(messageRequestsMediaUploadFocus('write me a post'), null)
})
