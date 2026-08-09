import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCarouselProposalRecord } from './proposal'

test('builds a carousel proposal from the exact saved slides in their requested order', () => {
  const result = buildCarouselProposalRecord({
    title: 'Scent Sell seller pricing',
    caption: 'Price for today’s buyer.',
    hashtags: ['scentsell'],
    platform: 'instagram',
    mediaItemIds: ['slide-2', 'slide-1', 'slide-3'],
  }, [
    { id: 'slide-1', file_url: 'https://media.example/slide-1.png', file_name: 'slide-1.png', file_type: 'image/png' },
    { id: 'slide-2', file_url: 'https://media.example/slide-2.png', file_name: 'slide-2.png', file_type: 'image/png' },
    { id: 'slide-3', file_url: 'https://media.example/slide-3.png', file_name: 'slide-3.png', file_type: 'image/png' },
  ])

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.metadata.carousel_slides.map((slide) => slide.media_item_id), [
    'slide-2', 'slide-1', 'slide-3',
  ])
  assert.equal(result.metadata.post_type, 'carousel')
  assert.equal(result.metadata.stage, 'proposal')
})

test('refuses a carousel when even one requested slide is not a usable image receipt', () => {
  const result = buildCarouselProposalRecord({
    title: 'Incomplete carousel',
    caption: 'Do not claim this exists.',
    hashtags: [],
    platform: 'instagram',
    mediaItemIds: ['slide-1', 'slide-2'],
  }, [
    { id: 'slide-1', file_url: 'https://media.example/slide-1.png', file_name: 'slide-1.png', file_type: 'image/png' },
  ])

  assert.deepEqual(result, {
    ok: false,
    error: 'Slide 2 is missing from the saved media library. No carousel proposal was created.',
  })
})
