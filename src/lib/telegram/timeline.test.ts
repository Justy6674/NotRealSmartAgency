import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTelegramTimeline,
  compareTimelineEvents,
  mergeTimeline,
  takeNewestGroups,
  toUtcMs,
  type TimelineSourceEvent,
} from './timeline'

/**
 * The fixture is the owner's REAL Scent Sell traffic from 2026-08-07, in the
 * order the three tables actually hold it. The old screen rendered this as:
 * chat messages first, then a spinner, then media newest-first — so his 00:22
 * clip appeared below a 06:12 message and above his 06:04 clip. He said it was
 * unusable and he was right.
 */
const ms = (iso: string) => toUtcMs(iso)!

function ask(id: string, at: string, text: string, clientEventId?: string): TimelineSourceEvent {
  return {
    id: `ask:${id}`,
    kind: 'user_message',
    groupParentId: null,
    occurredAtMs: ms(at),
    side: 'owner',
    brandId: 'scent-sell',
    ...(clientEventId ? { clientEventId } : {}),
    payload: { kind: 'user_message', text, mediaIds: [], status: 'sent' },
  }
}

function reply(id: string, completedAt: string, text: string): TimelineSourceEvent {
  return {
    id: `answer:${id}`,
    kind: 'director_reply',
    groupParentId: `ask:${id}`,
    occurredAtMs: ms(completedAt),
    side: 'director',
    brandId: 'scent-sell',
    payload: { kind: 'director_reply', jobId: id, text, withheld: false },
  }
}

function clip(id: string, at: string, fileName: string): TimelineSourceEvent {
  return {
    id: `clip:${id}`,
    kind: 'media_upload',
    groupParentId: null,
    occurredAtMs: ms(at),
    side: 'owner',
    brandId: 'scent-sell',
    payload: {
      kind: 'media_upload',
      mediaItemId: id,
      fileName,
      fileType: 'video/quicktime',
      thumbnailUrl: null,
      stage: 'ready',
      transcriptionStatus: 'transcribed',
      uploadPercent: 100,
      containedByEventId: null,
    },
  }
}

function proposal(id: string, at: string, aboutClip: string, hook: string): TimelineSourceEvent {
  return {
    id: `output:${id}`,
    kind: 'proposal',
    groupParentId: `clip:${aboutClip}`,
    occurredAtMs: ms(at),
    side: 'director',
    brandId: 'scent-sell',
    payload: {
      kind: 'proposal',
      outputId: id,
      mediaItemIds: [aboutClip],
      aboutFileName: null,
      opener: '',
      hook,
      caption: '',
      hashtags: [],
      postType: 'single',
      platform: 'instagram',
      approved: false,
      mixpost: null,
      withheld: false,
    },
  }
}

/** Deliberately shuffled, the way three separate queries actually arrive. */
const REAL_DAY: TimelineSourceEvent[] = [
  ask('j6', '2026-08-07T06:12:06.507Z', 'I dont understand this thread progression none of it makes sense'),
  clip('m2', '2026-08-07T06:04:50.732Z', 'IMG_2276.mov'),
  proposal('o1', '2026-08-07T00:27:20.295Z', 'm1', "Facebook Marketplace fragrance deals shouldn't feel like a gamble."),
  ask('j1', '2026-08-07T06:06:14.339Z', 'You cant even spell my business properly.'),
  reply('j1', '2026-08-07T06:06:41.000Z', 'Understood — correcting that now.'),
  clip('m1', '2026-08-07T00:22:12.162Z', '07-08-2026_10-09-28_A.mov'),
  proposal('o2', '2026-08-07T06:05:44.942Z', 'm2', 'What actually happens when you sell fragrance on Scent Sell?'),
  ask('j2', '2026-08-07T06:07:08.944Z', 'Show me a caption'),
  reply('j6', '2026-08-07T06:12:40.000Z', 'Here is what changed.'),
  reply('j2', '2026-08-07T06:07:44.000Z', 'Here is a caption.'),
]

test('the real day comes out in true chronological order, oldest first', () => {
  const { events, dropped } = buildTelegramTimeline({ events: REAL_DAY })
  assert.equal(dropped, 0)

  assert.deepEqual(events.map((event) => event.id), [
    'clip:m1',      // 00:22 — the oldest thing that happened
    'output:o1',    // 00:27 — written about it, so it sits with it
    'clip:m2',      // 06:04
    'output:o2',    // 06:05 — with ITS clip, not with the other proposal
    'ask:j1',       // 06:06
    'answer:j1',
    'ask:j2',       // 06:07
    'answer:j2',
    'ask:j6',       // 06:12 — newest at the bottom
    'answer:j6',
  ])
})

test('the fault the owner reported: newest no longer sorts to the top', () => {
  const { events } = buildTelegramTimeline({ events: REAL_DAY })
  const clips = events.filter((event) => event.kind === 'media_upload')
  // The old /media route ordered these DESC, so IMG_2276 (06:04) rendered
  // above 07-08-2026 (00:22). Oldest must now come first.
  assert.deepEqual(clips.map((c) => (c.payload as { fileName: string }).fileName), [
    '07-08-2026_10-09-28_A.mov',
    'IMG_2276.mov',
  ])
})

test('a proposal sits with the clip it was written about, not at the end', () => {
  const { events } = buildTelegramTimeline({ events: REAL_DAY })
  const clipIndex = events.findIndex((event) => event.id === 'clip:m1')
  assert.equal(events[clipIndex + 1].id, 'output:o1')
  assert.equal(events[clipIndex].groupId, events[clipIndex + 1].groupId)
})

test('the input order does not matter — the output is identical', () => {
  const forwards = buildTelegramTimeline({ events: REAL_DAY }).events.map((e) => e.id)
  const backwards = buildTelegramTimeline({ events: [...REAL_DAY].reverse() }).events.map((e) => e.id)
  assert.deepEqual(backwards, forwards)
})

/**
 * The objection every correctness judge raised against the first design: if a
 * reply sorts on when it FINISHED, anything landing while the Director thinks
 * shoves the answer down the screen as it is being read.
 */
test('an answer stays put no matter what arrives while it is being written', () => {
  const slowAsk = ask('slow', '2026-08-07T06:00:00.000Z', 'Write me a campaign')
  const pending: TimelineSourceEvent = {
    id: 'answer:slow',
    kind: 'director_pending',
    groupParentId: 'ask:slow',
    occurredAtMs: ms('2026-08-07T06:00:00.000Z'),
    side: 'director',
    brandId: 'scent-sell',
    payload: { kind: 'director_pending', jobId: 'slow', label: 'Working…', waitingSinceMs: ms('2026-08-07T06:00:00.000Z') },
  }
  const noise = [
    clip('n1', '2026-08-07T06:01:00.000Z', 'a.mov'),
    clip('n2', '2026-08-07T06:02:00.000Z', 'b.mov'),
    clip('n3', '2026-08-07T06:03:00.000Z', 'c.mov'),
  ]

  const before = buildTelegramTimeline({ events: [slowAsk, pending, ...noise] }).events
  const pendingIndex = before.findIndex((event) => event.id === 'answer:slow')

  // The job finishes SIX MINUTES after the question, well after all the noise.
  const done = reply('slow', '2026-08-07T06:06:00.000Z', 'Here is the campaign.')
  const after = buildTelegramTimeline({ events: [slowAsk, done, ...noise] }).events
  const replyIndex = after.findIndex((event) => event.id === 'answer:slow')

  assert.equal(replyIndex, pendingIndex, 'the answer must replace the spinner in place')
  assert.equal(after.length, before.length)
  assert.deepEqual(
    after.slice(0, replyIndex).map((e) => e.id),
    before.slice(0, pendingIndex).map((e) => e.id),
    'nothing above it may change either',
  )
  assert.equal(after[replyIndex - 1].id, 'ask:slow', 'the answer sits directly under its question')
})

test('an error takes the same slot as the answer it replaces', () => {
  const failedAsk = ask('bad', '2026-08-07T07:00:00.000Z', 'do a thing')
  const failure: TimelineSourceEvent = {
    id: 'answer:bad',
    kind: 'director_error',
    groupParentId: 'ask:bad',
    occurredAtMs: ms('2026-08-07T07:01:00.000Z'),
    side: 'director',
    brandId: 'scent-sell',
    payload: { kind: 'director_error', jobId: 'bad', text: 'That did not complete.', retryText: 'do a thing', retryClientEventId: 'bad' },
  }
  const { events } = buildTelegramTimeline({ events: [failedAsk, failure, ...REAL_DAY] })
  const index = events.findIndex((event) => event.id === 'answer:bad')
  assert.equal(events[index - 1].id, 'ask:bad')
  // An error must not destroy the history around it.
  assert.equal(events.length, REAL_DAY.length + 2)
})

test('paging keeps whole groups, so a reply never appears without its question', () => {
  const { events } = buildTelegramTimeline({ events: REAL_DAY })
  for (let groups = 1; groups <= 5; groups += 1) {
    const page = takeNewestGroups(events, groups)
    const ids = new Set(page.events.map((event) => event.id))
    for (const event of page.events) {
      if (event.groupParentId) {
        assert.ok(ids.has(event.groupParentId), `group split at size ${groups}: ${event.id} lost its parent`)
      }
    }
    assert.equal(new Set(page.events.map((e) => e.groupId)).size, groups)
  }
})

test('a page is still in order, and reports whether there is more', () => {
  const { events } = buildTelegramTimeline({ events: REAL_DAY })
  const page = takeNewestGroups(events, 2)
  assert.equal(page.hasMore, true)
  assert.deepEqual(page.events.map((e) => e.id), ['ask:j2', 'answer:j2', 'ask:j6', 'answer:j6'])
  assert.equal(takeNewestGroups(events, 99).hasMore, false)
})

test('a child whose parent fell off the page still shows, standing alone', () => {
  const orphan = proposal('o9', '2026-08-07T09:00:00.000Z', 'not-in-window', 'Orphan')
  const { events, dropped } = buildTelegramTimeline({ events: [orphan] })
  assert.equal(dropped, 0)
  assert.equal(events.length, 1)
  assert.equal(events[0].groupId, 'output:output:o9')
})

test('a cycle in the data cannot hang the request', () => {
  const a: TimelineSourceEvent = { ...ask('a', '2026-08-07T05:00:00.000Z', 'a'), groupParentId: 'ask:b' }
  const b: TimelineSourceEvent = { ...ask('b', '2026-08-07T05:00:01.000Z', 'b'), groupParentId: 'ask:a' }
  const { events } = buildTelegramTimeline({ events: [a, b] })
  assert.equal(events.length, 2)
})

test('an event with no usable time is dropped and counted, never rendered at NaN', () => {
  const broken: TimelineSourceEvent = { ...ask('x', '2026-08-07T05:00:00.000Z', 'x'), occurredAtMs: null }
  const { events, dropped } = buildTelegramTimeline({ events: [broken, ...REAL_DAY] })
  assert.equal(dropped, 1)
  assert.equal(events.length, REAL_DAY.length)
  assert.ok(events.every((event) => Number.isFinite(event.groupAnchorMs)))
})

test('the comparator is a total order — equal only when it is the same event', () => {
  const { events } = buildTelegramTimeline({ events: REAL_DAY })
  for (const a of events) {
    for (const b of events) {
      const forward = compareTimelineEvents(a, b)
      const backward = compareTimelineEvents(b, a)
      if (a.id === b.id) assert.equal(forward, 0)
      else assert.ok(forward !== 0 && Math.sign(forward) === -Math.sign(backward))
    }
  }
})

test('a just-sent local message is replaced by the server copy, not duplicated', () => {
  const server = buildTelegramTimeline({ events: REAL_DAY }).events
  const local = buildTelegramTimeline({
    events: [ask('local-abc', '2026-08-07T06:13:00.000Z', 'typed just now', 'abc')],
  }).events

  // Still optimistic: the server has not caught up, so it stays on screen.
  const pendingMerge = mergeTimeline(local, server)
  assert.equal(pendingMerge.length, server.length + 1)
  assert.equal(pendingMerge[pendingMerge.length - 1].id, 'ask:local-abc')

  // Server now echoes the same client id back — the local copy must go.
  const echoed = buildTelegramTimeline({
    events: [...REAL_DAY, ask('j7', '2026-08-07T06:13:00.000Z', 'typed just now', 'abc')],
  }).events
  const settled = mergeTimeline(local, echoed)
  const texts = settled.filter((e) => (e.payload as { text?: string }).text === 'typed just now')
  assert.equal(texts.length, 1, 'the message must appear exactly once')
})

test('an empty conversation is empty, not broken', () => {
  const { events, dropped } = buildTelegramTimeline({ events: [] })
  assert.deepEqual(events, [])
  assert.equal(dropped, 0)
  assert.equal(takeNewestGroups([], 20).hasMore, false)
})
