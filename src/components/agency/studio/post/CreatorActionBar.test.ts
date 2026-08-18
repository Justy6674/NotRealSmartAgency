import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const bar = readFileSync(
  resolve(process.cwd(), 'src/components/agency/studio/post/CreatorActionBar.tsx'),
  'utf8',
)
const creator = readFileSync(
  resolve(process.cwd(), 'src/components/agency/studio/post/PostCreator.tsx'),
  'utf8',
)

test('the composer has Post now, choose a time, and Save draft as buttons she clicks', () => {
  assert.match(bar, /Post now/)
  assert.match(bar, /Choose a time/)
  assert.match(bar, /Save draft|Save Draft/)
})

test('Post now does not hand publishing to the Director', () => {
  // THE FAULT: handleSave('now') used to sendToDirector and return, so the
  // button that should beat Mixpost was a chat prompt. The human drives.
  assert.match(creator, /\/api\/scheduled-posts\/publish-now/)
  assert.doesNotMatch(creator, /sendToDirector\(`Review and publish/)
})

test('composer copy never names the plumbing', () => {
  const blob = `${bar}\n${creator}`.toLowerCase()
  // Comments may mention Mixpost as incident history; the owner-facing strings must not.
  const ownerStrings = [...bar.matchAll(/['"`]([^'"`]{8,})['"`]/g)].map((m) => m[1].toLowerCase())
  for (const text of ownerStrings) {
    for (const word of ['mixpost', 'zernio', 'oauth']) {
      assert.ok(!text.includes(word), `owner-facing string leaked "${word}": ${text}`)
    }
  }
  void blob
})

/**
 * The second way out of the composer used to be a dead button.
 *
 * It took a bare time, could not see what was already scheduled, and when no
 * posting times were set at all it simply greyed itself out behind a tooltip.
 * These pin the three things that made it real: the time is ON the button, an
 * unset week becomes the way to go and set one, and a time typed by hand is
 * read in the BUSINESS's zone rather than the laptop's.
 */
test('the next free time is named on the button, not hidden in a tooltip', () => {
  assert.match(bar, /Add to next free time/)
  assert.match(bar, /\{nextLabel\}/)
})

test('no posting times offers a way to set some, never a dead button', () => {
  assert.match(bar, /Set your posting times/)
  assert.match(bar, /setTimesHref/)
})

test('a time picked by hand is read in the business zone and refuses the past', () => {
  assert.match(bar, /zonedDateTimeToUtc/)
  assert.match(bar, /has already gone by/)
  assert.match(bar, /disabled=\{disabled \|\| !chosen \|\| chosenIsPast\}/)
})

test('a post given a posting time carries it back to the row', () => {
  // The row owns the time it was given, so the next post is offered the one
  // after it — `queue_slot_id` was permanently null before this.
  assert.match(bar, /slotIdByPlatform: nextFree\.slotIdByPlatform/)
  assert.match(creator, /queue_slot_id/)
  assert.match(creator, /next-free-time/)
})
