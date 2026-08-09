import assert from 'node:assert/strict'
import test from 'node:test'
import { directorJobSource, proposalSource } from './timeline-sources'

test('a completed Director job replaces Working with its stored response', () => {
  const events = directorJobSource.map([{
    id: 'job-1',
    status: 'done',
    input: { message: 'Create the carousel.' },
    result: { response: 'The work did not create a Canva design, so it is not complete.' },
    error: null,
    created_at: '2026-08-09T02:21:49.530Z',
    completed_at: '2026-08-09T02:23:52.018Z',
  }], { brandId: 'brand-1', nowMs: Date.parse('2026-08-09T02:24:00.000Z') })

  assert.deepEqual(events.map((event) => event.payload.kind), ['user_message', 'director_reply'])
  assert.equal(events.some((event) => event.payload.kind === 'director_pending'), false)
})

test('a completed carousel job exposes its actual saved slides for Mini App review', () => {
  const events = directorJobSource.map([{
    id: 'job-carousel',
    status: 'done',
    input: { message: 'Create the three-slide seller-pricing carousel.' },
    result: {
      response: 'The carousel is ready to review.',
      carousel_delivery: {
        title: 'Scent Sell seller pricing',
        output_id: 'proposal-1',
        platform: 'instagram',
        caption: 'Price for today’s buyer.',
        hashtags: ['scentsell'],
        media: [
          { media_item_id: 'slide-1', file_url: 'https://media.example/slide-1.png', file_name: 'slide-1.png' },
          { media_item_id: 'slide-2', file_url: 'https://media.example/slide-2.png', file_name: 'slide-2.png' },
          { media_item_id: 'slide-3', file_url: 'https://media.example/slide-3.png', file_name: 'slide-3.png' },
        ],
      },
    },
    error: null,
    created_at: '2026-08-09T02:21:49.530Z',
    completed_at: '2026-08-09T02:23:52.018Z',
  }], { brandId: 'brand-1', nowMs: Date.parse('2026-08-09T02:24:00.000Z') })

  assert.deepEqual(events.map((event) => event.payload.kind), [
    'user_message',
    'director_reply',
    'carousel_delivery',
  ])
})

test('a stored carousel proposal becomes a visual review event, not a text-only proposal', () => {
  const events = proposalSource.map([{
    id: 'carousel-proposal-1',
    title: 'Scent Sell seller pricing',
    content: 'Price for today’s buyer.',
    is_approved: false,
    created_at: '2026-08-09T02:23:52.018Z',
    metadata: {
      stage: 'proposal',
      post_type: 'carousel',
      platform: 'instagram',
      hashtags: ['scentsell'],
      carousel_slides: [
        { media_item_id: 'slide-1', file_url: 'https://media.example/slide-1.png', file_name: 'slide-1.png' },
        { media_item_id: 'slide-2', file_url: 'https://media.example/slide-2.png', file_name: 'slide-2.png' },
        { media_item_id: 'slide-3', file_url: 'https://media.example/slide-3.png', file_name: 'slide-3.png' },
      ],
    },
  }], { brandId: 'brand-1', nowMs: Date.parse('2026-08-09T02:24:00.000Z') })

  assert.equal(events.length, 1)
  assert.equal(events[0]?.payload.kind, 'carousel_delivery')
  if (events[0]?.payload.kind !== 'carousel_delivery') return
  assert.equal(events[0].payload.outputId, 'carousel-proposal-1')
  assert.equal(events[0].payload.slides.length, 3)
})
