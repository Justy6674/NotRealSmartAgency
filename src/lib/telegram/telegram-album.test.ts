import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMediaDirective } from './telegram-album'

/**
 * The Telegram path used to hand the Director "Write captions for what I just
 * sent." Nothing asked for a draft, so whether anything reached the review
 * queue depended on the Director choosing to create one. These assert the
 * instruction actually states the outcome that is wanted.
 */

test('a single video asks for real drafts, not just captions', () => {
  const directive = buildMediaDirective({
    kind: 'video',
    mediaItemIds: ['aaa'],
    transcript: 'hello there',
  })
  assert.match(directive, /CREATE THE DRAFTS/)
  assert.match(directive, /manage_posts with action=create_draft/)
  assert.match(directive, /\[aaa\]/)
  assert.match(directive, /hello there/)
})

test('an album is described as ONE carousel, not several posts', () => {
  const directive = buildMediaDirective({
    kind: 'photo',
    mediaItemIds: ['one', 'two', 'three'],
    description: 'brand slides',
  })
  assert.match(directive, /3 images together as one album/)
  assert.match(directive, /ONE carousel post/)
  assert.match(directive, /not as separate posts/)
  assert.match(directive, /\[one, two, three\]/)
})

test('the honest mixpost status is demanded, not assumed', () => {
  const directive = buildMediaDirective({ kind: 'photo', mediaItemIds: ['x'] })
  assert.match(directive, /synced, pending or failed/)
  assert.match(directive, /Never say a draft is ready to review unless it came back synced/)
})

test('drafts are never to be scheduled or published', () => {
  const directive = buildMediaDirective({ kind: 'video', mediaItemIds: ['x'] })
  assert.match(directive, /Do not schedule or publish/)
})

test('unreadable media tells the Director to ask rather than invent', () => {
  const directive = buildMediaDirective({ kind: 'document', mediaItemIds: ['x'] })
  assert.match(directive, /ask him what is in it rather than guessing/)
})

test('the caption is written from what is actually in the media', () => {
  const directive = buildMediaDirective({
    kind: 'video',
    mediaItemIds: ['x'],
    transcript: 'the real words',
  })
  assert.match(directive, /Never invent something that was not said or shown/)
})

/**
 * The same video produced "Ormonde Jayne Bijou Saffron" once and "Ormonde Jayne
 * Bijou Zafran" the next time — two confident inventions from one garbled
 * transcript, neither a real product. Having a verify_product tool available
 * was not enough; the instruction has to demand it.
 */
test('the directive demands product names be verified, not guessed', () => {
  const directive = buildMediaDirective({
    kind: 'video',
    mediaItemIds: ['x'],
    transcript: 'Ormond Janes, Bijous, Saffron, it is worth the hype',
  })
  assert.match(directive, /CHECK, DO NOT GUESS/)
  assert.match(directive, /verify_product/)
  assert.match(directive, /BEFORE writing/)
})

test('the directive asks for one batched check, not one call per name', () => {
  // A walkthrough names a dozen products. One call each ran the Director out
  // of steps before any copy was written, so the captions went out unverified.
  const directive = buildMediaDirective({
    kind: 'video',
    mediaItemIds: ['x'],
    transcript: 'Ta\'if, Fils de Dieu, Hermann, Ghost in the Shell, I Am Trash',
  })
  assert.match(directive, /ALL in ONE verify_product call/)
  assert.match(directive, /products` array/)
})

test('an unverified name must not be printed at all', () => {
  const directive = buildMediaDirective({ kind: 'video', mediaItemIds: ['x'] })
  assert.match(directive, /Only write a name whose verdict came back "exists"/)
  assert.match(directive, /do NOT print the name/)
})
