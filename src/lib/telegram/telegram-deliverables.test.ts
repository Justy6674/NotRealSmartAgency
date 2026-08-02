import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  describeDeliverables,
  findJobDeliverables,
  TELEGRAM_REMOTE_PHOTO_LIMIT_BYTES,
} from './telegram-deliverables'

/**
 * A tiny stand-in for the two queries this makes. Each builder resolves with
 * whatever the test hands it, so the ordering and filtering logic is what is
 * under test rather than PostgREST.
 */
function fakeSupabase({
  drafts = [],
  media = [],
  freshMedia = [],
}: {
  drafts?: unknown[]
  media?: unknown[]
  freshMedia?: unknown[]
}): SupabaseClient {
  const builder = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'gte', 'order', 'in']) {
      chain[method] = () => chain
    }
    chain.limit = () => Promise.resolve({ data: rows, error: null })
    // `.in()` terminates the media lookup, so it must also be awaitable.
    chain.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null })
    return chain
  }

  let mediaCall = 0
  return {
    from(table: string) {
      if (table === 'scheduled_posts') return builder(drafts)
      mediaCall += 1
      return builder(mediaCall === 1 && drafts.length > 0 ? media : freshMedia)
    },
  } as unknown as SupabaseClient
}

test('a draft hands its slides over in the order the carousel was built', async () => {
  const result = await findJobDeliverables({
    supabase: fakeSupabase({
      drafts: [{ id: 'post-1', platform: 'instagram', media_item_ids: ['c', 'a', 'b'], media_item_id: 'c' }],
      media: [
        { id: 'a', file_url: 'https://x/a.jpg', file_type: 'image/jpeg', file_size: 1000 },
        { id: 'b', file_url: 'https://x/b.jpg', file_type: 'image/jpeg', file_size: 1000 },
        { id: 'c', file_url: 'https://x/c.jpg', file_type: 'image/jpeg', file_size: 1000 },
      ],
    }),
    brandId: 'brand-1',
    since: '2026-08-02T00:00:00Z',
  })

  assert.ok(result)
  assert.deepEqual(result.media.map((m) => m.mediaItemId), ['c', 'a', 'b'])
  assert.equal(result.postId, 'post-1')
  assert.equal(result.skipped, 0)
})

test('a photo Telegram would refuse is left behind and counted', async () => {
  const result = await findJobDeliverables({
    supabase: fakeSupabase({
      drafts: [{ id: 'post-1', platform: 'instagram', media_item_ids: ['big', 'ok'], media_item_id: 'big' }],
      media: [
        { id: 'big', file_url: 'https://x/big.jpg', file_type: 'image/jpeg', file_size: TELEGRAM_REMOTE_PHOTO_LIMIT_BYTES + 1 },
        { id: 'ok', file_url: 'https://x/ok.jpg', file_type: 'image/jpeg', file_size: 500 },
      ],
    }),
    brandId: 'brand-1',
    since: '2026-08-02T00:00:00Z',
  })

  assert.ok(result)
  assert.deepEqual(result.media.map((m) => m.mediaItemId), ['ok'])
  assert.equal(result.skipped, 1)
})

test('a video is sent as a video, not a photo', async () => {
  const result = await findJobDeliverables({
    supabase: fakeSupabase({
      drafts: [{ id: 'post-1', platform: 'tiktok', media_item_ids: ['v'], media_item_id: 'v' }],
      media: [{ id: 'v', file_url: 'https://x/v.mp4', file_type: 'video/mp4', file_size: 5000 }],
    }),
    brandId: 'brand-1',
    since: '2026-08-02T00:00:00Z',
  })

  assert.ok(result)
  assert.equal(result.media[0].kind, 'video')
})

test('generated images still come back when no draft was made', async () => {
  const result = await findJobDeliverables({
    supabase: fakeSupabase({
      drafts: [],
      freshMedia: [
        { id: 'g1', file_url: 'https://x/g1.png', file_type: 'image/png', file_size: 900 },
        { id: 'g2', file_url: 'https://x/g2.png', file_type: 'image/png', file_size: 900 },
      ],
    }),
    brandId: 'brand-1',
    since: '2026-08-02T00:00:00Z',
  })

  assert.ok(result)
  assert.deepEqual(result.media.map((m) => m.mediaItemId), ['g1', 'g2'])
  assert.equal(result.postId, undefined)
})

test('a job that produced nothing sends nothing', async () => {
  const result = await findJobDeliverables({
    supabase: fakeSupabase({ drafts: [], freshMedia: [] }),
    brandId: 'brand-1',
    since: '2026-08-02T00:00:00Z',
  })
  assert.equal(result, null)
})

test('the caption says the draft is still the thing that publishes', () => {
  const text = describeDeliverables(
    { media: [{ mediaItemId: 'a', url: 'u', kind: 'photo' }], postId: 'p', skipped: 0 },
    'ScentSell',
  )
  assert.match(text, /ScentSell — 1 file/)
  assert.match(text, /Review/)
})

test('files left out of the album are named as left out', () => {
  const text = describeDeliverables(
    { media: [{ mediaItemId: 'a', url: 'u', kind: 'photo' }], skipped: 2 },
    'ScentSell',
  )
  assert.match(text, /2 files were too large/)
})
