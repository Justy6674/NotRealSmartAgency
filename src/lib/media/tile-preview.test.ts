import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaTileUrl } from './tile-preview.ts'

test('a video with a still uses the still, never the movie', () => {
  assert.equal(
    mediaTileUrl({
      file_type: 'video/quicktime',
      file_url: 'https://example.test/clip.mov',
      thumbnail_url: 'https://example.test/clip_thumb.jpg',
    }),
    'https://example.test/clip_thumb.jpg',
  )
})

test('a video without a still has no tile URL', () => {
  assert.equal(
    mediaTileUrl({
      file_type: 'video/mp4',
      file_url: 'https://example.test/clip.mp4',
      thumbnail_url: null,
    }),
    null,
  )
})

test('an image prefers the still, then the file', () => {
  assert.equal(
    mediaTileUrl({
      file_type: 'image/png',
      file_url: 'https://example.test/probe.png',
      thumbnail_url: 'https://example.test/probe_thumb.jpg',
    }),
    'https://example.test/probe_thumb.jpg',
  )
  assert.equal(
    mediaTileUrl({
      file_type: 'image/png',
      file_url: 'https://example.test/photo.png',
      thumbnail_url: null,
    }),
    'https://example.test/photo.png',
  )
})
