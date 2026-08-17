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
