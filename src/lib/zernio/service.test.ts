import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildZernioPostBody } from './client.ts'
import { listZernioPosts } from './posts.ts'
import { deleteZernioQueue } from './queue.ts'
import { toZernioMediaItem, zernioContentTypeOf } from './media.ts'
import { approvedByPublishGate } from './types.ts'

/**
 * The service layer's own guarantees, checked without a key and without a network.
 *
 * Everything asserted here is something that was WRONG in production and had no
 * test to catch it: per-platform words that were never sent, a post list that
 * silently hid a brand's whole history, a delete that could wipe every posting
 * schedule on a profile, and alt text that was captured and dropped.
 */

/* ── Per-platform words reach the wire ─────────────────────────────────── */

test('a per-platform customContent reaches the createPost body', () => {
  // THE HEADLINE GAP. NRS collected per-platform captions in the composer,
  // showed them back, resolved them at save time — and sent none of them.
  // `platforms` was built from `{platform, accountId}` and one shared options
  // bag. Per-platform variants only survived because we wrote one row per
  // platform; two accounts on the SAME network could never differ.
  const body = buildZernioPostBody({
    content: 'The long caption, written for Instagram.',
    accounts: [
      { platform: 'instagram', accountId: 'acc_ig' },
      { platform: 'twitter', accountId: 'acc_x', customContent: 'The short one.' },
    ],
  })

  const platforms = body.platforms as Record<string, unknown>[]
  assert.equal(platforms.length, 2)
  assert.equal(platforms[1]!.customContent, 'The short one.')
  assert.equal(
    'customContent' in platforms[0]!,
    false,
    'a target with no override must not be sent an empty one — that publishes an empty caption',
  )
  assert.equal(body.content, 'The long caption, written for Instagram.')
})

test('per-target media and times travel with their own target', () => {
  const body = buildZernioPostBody({
    content: 'One post, two networks, two schedules.',
    accounts: [
      { platform: 'facebook', accountId: 'acc_fb', scheduledFor: '2026-09-01T09:00:00Z' },
      {
        platform: 'instagram',
        accountId: 'acc_ig',
        customMedia: [{ url: 'https://cdn.example/square.jpg', type: 'image' }],
      },
    ],
    scheduledFor: '2026-09-01T08:00:00Z',
  })

  const platforms = body.platforms as Record<string, unknown>[]
  assert.equal(platforms[0]!.scheduledFor, '2026-09-01T09:00:00Z')
  assert.equal((platforms[1]!.customMedia as unknown[]).length, 1)
  assert.equal(body.scheduledFor, '2026-09-01T08:00:00Z')
})

test('platform options are per target, and a target with its own wins', () => {
  const body = buildZernioPostBody({
    content: 'x',
    accounts: [
      { platform: 'tiktok', accountId: 'a' },
      { platform: 'tiktok', accountId: 'b', platformSpecificData: { privacyLevel: 'SELF_ONLY' } },
    ],
    platformSpecificData: { privacyLevel: 'PUBLIC_TO_EVERYONE' },
  })
  const platforms = body.platforms as Record<string, unknown>[]
  assert.deepEqual(platforms[0]!.platformSpecificData, { privacyLevel: 'PUBLIC_TO_EVERYONE' })
  assert.deepEqual(platforms[1]!.platformSpecificData, { privacyLevel: 'SELF_ONLY' })
})

test('our own row id is stamped on the post for reconciliation', () => {
  const body = buildZernioPostBody({
    content: 'x',
    accounts: [{ platform: 'facebook', accountId: 'a' }],
    nrsScheduledPostId: 'row-123',
  })
  assert.deepEqual(body.metadata, { nrsScheduledPostId: 'row-123' })
})

test('a queued post does not also carry a fixed time', () => {
  // Passing both bypasses the queue's locking, which double-books a slot.
  const body = buildZernioPostBody({
    content: 'x',
    accounts: [{ platform: 'facebook', accountId: 'a' }],
    queuedFromProfile: 'prof_1',
    queueId: 'q_1',
  })
  assert.equal(body.queuedFromProfile, 'prof_1')
  assert.equal(body.queueId, 'q_1')
  assert.equal('scheduledFor' in body, false)
})

/* ── The post list will not guess ──────────────────────────────────────── */

test('listPosts without an explicit source is rejected by the wrapper', async () => {
  // The API defaults to source:'zernio', which returned ZERO posts on a live
  // brand whose analytics reported 210 published. A Posts page on that default
  // shows an empty screen and says nothing is wrong.
  const previousKey = process.env.ZERNIO_API_KEY
  delete process.env.ZERNIO_API_KEY
  try {
    await assert.rejects(
      // Deliberately cast: the compiler already refuses this, and the point is
      // that the runtime refuses it too rather than quietly returning nothing.
      () => listZernioPosts({ profileId: 'prof_1' } as never),
      /explicit source/i,
    )
    await assert.rejects(
      () => listZernioPosts({ source: 'all' } as never),
      /explicit source/i,
    )
  } finally {
    if (previousKey !== undefined) process.env.ZERNIO_API_KEY = previousKey
  }
})

test('the source check runs before anything else can fail', async () => {
  // If the key check came first, the guard would be invisible on any
  // deployment that happens to be configured — which is every real one.
  const previousKey = process.env.ZERNIO_API_KEY
  process.env.ZERNIO_API_KEY = 'test-key-not-used'
  try {
    await assert.rejects(() => listZernioPosts({} as never), /explicit source/i)
  } finally {
    if (previousKey === undefined) delete process.env.ZERNIO_API_KEY
    else process.env.ZERNIO_API_KEY = previousKey
  }
})

/* ── One click must not be able to wipe a posting schedule ─────────────── */

test('deleting a posting schedule requires naming which one', async () => {
  // Omitting queueId upstream deletes EVERY queue on the profile.
  await assert.rejects(
    () => deleteZernioQueue({ profileId: 'prof_1', queueId: '' }),
    /without naming which one/i,
  )
})

/* ── Media carries what the owner typed ────────────────────────────────── */

test('alt text and the video cover survive into the media item', () => {
  const item = toZernioMediaItem({
    url: 'https://example.supabase.co/storage/v1/object/sign/clip.mp4?token=abc',
    altText: 'A clinician talking to camera',
    thumbnail: 'https://cdn.example/poster.jpg',
  })
  assert.equal(item.altText, 'A clinician talking to camera')
  assert.equal(item.thumbnail, 'https://cdn.example/poster.jpg')
  // Typed from the PATH. On the whole string a signed URL ends in `…token=abc`
  // and every real video was typed as an image, then refused after the caption
  // had already been written.
  assert.equal(item.type, 'video')
})

test('an empty alt text is omitted rather than sent blank', () => {
  const item = toZernioMediaItem({ url: 'https://cdn.example/a.jpg', altText: '   ' })
  assert.equal('altText' in item, false)
})

test('the upload content type is the closed enum, or nothing', () => {
  assert.equal(zernioContentTypeOf({ mimeType: 'image/heic' }), null)
  assert.equal(zernioContentTypeOf({ mimeType: 'image/jpeg' }), 'image/jpeg')
  assert.equal(zernioContentTypeOf({ filename: 'clip.MOV' }), 'video/quicktime')
  assert.equal(zernioContentTypeOf({ filename: 'notes' }), null)
})

/* ── Outbound words carry proof of the review ──────────────────────────── */

test('a blocked review cannot become an approval', () => {
  assert.throws(
    () => approvedByPublishGate({ allowed: false, reason: 'Therapeutic claim.' }, 'reply'),
    /Therapeutic claim/,
  )
  assert.deepEqual(approvedByPublishGate({ allowed: true, reason: null }, 'reply to a review'), {
    checkedWith: 'publish-gate',
    allowed: true,
    label: 'reply to a review',
  })
})

/* ── The dispatcher's order is the product decision ────────────────────── */

test('the dispatcher still chooses Zernio, then native, then the fallback', () => {
  const source = readFileSync(join(process.cwd(), 'src/lib/publishers/dispatcher.ts'), 'utf8')
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  const gateAt = code.indexOf('checkPublishAllowed(')
  const zernioAt = code.indexOf("selection.backend === 'zernio'")
  const nativeAt = code.indexOf('useNative')
  const mixpostAt = code.indexOf('fetchMixpostAccounts()')

  assert.ok(gateAt > -1, 'every publish must still pass the regulatory review')
  assert.ok(zernioAt > -1 && nativeAt > -1 && mixpostAt > -1, 'all three backends must still exist')
  assert.ok(
    gateAt < zernioAt,
    'the review runs BEFORE the send on every backend — a gate after the call is decoration',
  )
  assert.ok(zernioAt < mixpostAt, 'Zernio is tried before the self-hosted fallback')
})

test('the media the dispatcher sends is built by the shared mapper', () => {
  const source = readFileSync(join(process.cwd(), 'src/lib/publishers/dispatcher.ts'), 'utf8')
  assert.match(
    source,
    /toZernioMediaItem\(/,
    'bare URLs drop alt text and the video cover — build the item through the mapper',
  )
  assert.match(source, /nrsScheduledPostId: req\.scheduled_post_id/)
})
