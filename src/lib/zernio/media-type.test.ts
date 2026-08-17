import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaTypeFromUrl } from './client.ts'

test('a signed mp4 is video after the query string is stripped', () => {
  assert.equal(
    mediaTypeFromUrl('https://example.supabase.co/storage/v1/object/sign/clip.mp4?token=abc'),
    'video',
  )
})

test('a mov with a hash fragment is still video', () => {
  assert.equal(mediaTypeFromUrl('https://cdn.example.com/take.mov#t=1'), 'video')
})

test('a jpeg stays an image', () => {
  assert.equal(mediaTypeFromUrl('https://cdn.example.com/still.jpg'), 'image')
})

test('a gif is typed as gif, not image', () => {
  assert.equal(mediaTypeFromUrl('https://cdn.example.com/loop.gif?v=2'), 'gif')
})
