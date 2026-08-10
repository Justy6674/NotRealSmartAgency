import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveMcpDraftMediaAttachment,
  resolveMcpDraftMediaAttachments,
} from './draft-post-tool'

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

test('draft_post keeps authorised carousel slides in the caller requested order', () => {
  const firstSlide = {
    id: '11111111-1111-1111-1111-111111111111',
    file_url: 'https://example.com/slide-one.png',
    file_type: 'image/png',
    thumbnail_url: null,
  }
  const secondSlide = {
    id: '22222222-2222-2222-2222-222222222222',
    file_url: 'https://example.com/slide-two.jpg',
    file_type: 'image/jpeg',
    thumbnail_url: null,
  }

  assert.deepEqual(
    resolveMcpDraftMediaAttachments([secondSlide.id, firstSlide.id], [firstSlide, secondSlide]),
    { ok: true, media: [secondSlide, firstSlide] },
  )
})

test('draft_post rejects a carousel when even one requested slide is unavailable', () => {
  const firstSlide = {
    id: '11111111-1111-1111-1111-111111111111',
    file_url: 'https://example.com/slide-one.png',
    file_type: 'image/png',
    thumbnail_url: null,
  }

  const result = resolveMcpDraftMediaAttachments(
    [firstSlide.id, '22222222-2222-2222-2222-222222222222'],
    [firstSlide],
  )

  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /requested media/i)
})

test('draft_post rejects a carousel that repeats a slide', () => {
  const slide = {
    id: '11111111-1111-1111-1111-111111111111',
    file_url: 'https://example.com/slide-one.png',
    file_type: 'image/png',
    thumbnail_url: null,
  }

  const result = resolveMcpDraftMediaAttachments([slide.id, slide.id], [slide])

  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /unique/i)
})
