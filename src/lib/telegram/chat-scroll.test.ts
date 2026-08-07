import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  anchorAfterPrepend,
  FOLLOW_THRESHOLD_PX,
  nextScrollTop,
  shouldFollow,
  shouldOfferJump,
} from './chat-scroll'

test('sitting at the bottom counts as following', () => {
  assert.equal(shouldFollow({ scrollHeight: 2000, scrollTop: 1400, clientHeight: 600 }), true)
})

test('a few pixels off the bottom still counts — thumbs are imprecise', () => {
  assert.equal(
    shouldFollow({ scrollHeight: 2000, scrollTop: 1400 - FOLLOW_THRESHOLD_PX + 1, clientHeight: 600 }),
    true,
  )
})

test('scrolled up to read is NOT following', () => {
  assert.equal(shouldFollow({ scrollHeight: 4000, scrollTop: 200, clientHeight: 600 }), false)
})

test('a new answer pins the view to the bottom when following', () => {
  const top = nextScrollTop({ following: true, scrollHeight: 3000, clientHeight: 600, currentTop: 2400 })
  assert.equal(top, 2400)
})

test('a new answer does NOT move the view when reading further up', () => {
  // The whole point: a background job finishing must not yank the page away
  // mid-sentence. Strict equality so the caller can skip the write entirely.
  const currentTop = 200
  const top = nextScrollTop({ following: false, scrollHeight: 9000, clientHeight: 600, currentTop })
  assert.equal(top, currentTop)
})

test('scroll position never goes negative on a short conversation', () => {
  assert.equal(nextScrollTop({ following: true, scrollHeight: 300, clientHeight: 600, currentTop: 0 }), 0)
})

test('loading older history keeps the same message under the eye', () => {
  // 1200px of history was prepended; the view must move down by exactly that.
  assert.equal(anchorAfterPrepend(3000, 4200, 500), 1700)
})

test('prepending nothing moves nothing', () => {
  assert.equal(anchorAfterPrepend(3000, 3000, 500), 500)
})

test('something new while reading up the page offers a jump instead of moving', () => {
  assert.equal(shouldOfferJump({ following: false, newestChanged: true }), true)
  assert.equal(shouldOfferJump({ following: false, newestChanged: false }), false)
  // Already at the bottom: it just arrives, no prompt needed.
  assert.equal(shouldOfferJump({ following: true, newestChanged: true }), false)
})
