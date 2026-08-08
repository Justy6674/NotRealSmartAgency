import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMediaDirective, stripMediaDirective } from './telegram-album'
import { parseTelegramJobTurn, buildTelegramModelMessages } from './telegram-thread'

/**
 * The blurry-card day, in one test file.
 *
 * NRS concatenated its own instruction — "passing media_item_ids [853c7b19…]"
 * — onto the owner's message and stored it as HIS words. Every later turn
 * replayed it as a standing, owner-voiced order naming one specific UUID. He
 * uploaded a sharp PNG twice and said "do a post on this"; that arrived as a
 * bare sentence sitting underneath an explicit instruction that named the old
 * 48 KB file. Fourteen drafts later it was still blurry.
 */

const OLD = '853c7b19-74a9-4b24-a936-cc12fb174c47'

const directive = buildMediaDirective({
  kind: 'photo',
  mediaItemIds: [OLD],
  transcript: '',
  description: 'A curated Clean Top 10 fragrance shelf.',
})

test('the directive really does name a specific id (else nothing below matters)', () => {
  assert.ok(directive.includes(OLD), 'the directive must embed the id for this to be a real test')
})

test('the owner\'s own words survive the strip', () => {
  const stored = 'Have a look at this.' + directive
  assert.equal(stripMediaDirective(stored), 'Have a look at this.')
})

test('THE FIX: a past turn stops replaying its UUID as a present order', () => {
  const turn = parseTelegramJobTurn({
    id: 'j1',
    input: { message: 'Have a look at this.' + directive },
    result: { response: 'Drafts created.' },
    completed_at: '2026-08-08T09:58:00Z',
    status: 'done',
  })!
  const messages = buildTelegramModelMessages([turn], 'do a post on this')

  const replayed = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n')
  assert.ok(!replayed.includes(OLD), 'the stale id must not reach the model as an instruction')
  assert.ok(replayed.includes('Have a look at this.'), 'his actual words must survive')
  assert.equal(messages[messages.length - 1].content, 'do a post on this')
})

test('no id at all leaves an ordinary message untouched', () => {
  for (const plain of ['do a post on this', 'make it shorter', 'approve']) {
    assert.equal(stripMediaDirective(plain), plain)
  }
})

test('an album directive is stripped too, not just a single photo', () => {
  const album = buildMediaDirective({
    kind: 'photo',
    mediaItemIds: [OLD, '11c3daa5-b674-4b27-98f8-e307e14fe30a'],
    transcript: '',
    description: 'three cards',
  })
  const stored = 'Carousel please.' + album
  const cleaned = stripMediaDirective(stored)
  assert.equal(cleaned, 'Carousel please.')
  assert.ok(!cleaned.includes(OLD))
})
