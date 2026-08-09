import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkClaims, enforceClaims, toolNamesFrom, WRITE_TOOLS } from './claimed-actions'

const steps = (...names: string[]) => [{ toolCalls: names.map((toolName) => ({ toolName })) }]

test('the exact failure: says the drafts were updated, no tool ran', () => {
  // The Director's own words afterwards: "I spoke as if the draft had been
  // updated before I'd properly confirmed it. That's a trust error."
  const reply = "Done. I've updated the Instagram draft with the corrected caption and removed the"
    + ' TikTok-style hashtag.'
  const result = enforceClaims(reply, steps('query_media'))
  assert.equal(result.corrected, true)
  assert.match(result.response, /only in this chat/)
  // The copy itself is kept — throwing away good work would be its own waste.
  assert.ok(result.response.startsWith(reply))
})

test('a standalone fabricated output save is corrected', () => {
  const reply = 'Saved as “TikTok description — custom fragrance lists”.'
  const result = enforceClaims(reply, steps('query_media'))
  assert.equal(result.corrected, true)
  assert.match(result.response, /No output, Canva design, Mixpost draft or post has been saved/)
})

test('the same claim passes untouched when a write tool actually ran', () => {
  const reply = "I've updated the Instagram draft with the corrected caption."
  const result = enforceClaims(reply, steps('manage_posts'))
  assert.equal(result.corrected, false)
  assert.equal(result.response, reply)
})

test('a promise is not a claim', () => {
  // "I'll update it" is fine. "I've updated it" is a statement about a
  // database row. The tense is the whole distinction.
  for (const reply of [
    "I'll update the draft next.",
    'Want me to update the draft?',
    'I can update the draft now if you like.',
    'Next step is updating the draft.',
  ]) {
    assert.equal(checkClaims(reply, []).claimed, false, `wrongly flagged: ${reply}`)
  }
})

test('ordinary chat work is never flagged', () => {
  // Rewriting copy in the chat IS the job. Only assertions about stored things
  // are checked — flagging discussion would make the Director useless.
  for (const reply of [
    "Here's a cleaner version for Instagram and Facebook.",
    "I've written three options — pick one and I'll file it.",
    'I removed that paragraph from the version below.',
  ]) {
    assert.equal(checkClaims(reply, []).claimed, false, `wrongly flagged: ${reply}`)
  }
})

test('the phrasings that actually appeared are all caught', () => {
  for (const reply of [
    "I've updated both drafts.",
    'The drafts have been updated.',
    "I've now amended the Instagram post.",
    "I've scheduled it.",
    "I've pushed it to Mixpost.",
    "I have corrected the caption on your draft.",
  ]) {
    assert.equal(checkClaims(reply, ['query_media']).claimed, true, `missed: ${reply}`)
  }
})

test('tool names are read out of the step record', () => {
  assert.deepEqual(toolNamesFrom(steps('a', 'b')), ['a', 'b'])
  // A malformed or absent step record must not throw mid-reply.
  assert.deepEqual(toolNamesFrom(undefined), [])
  assert.deepEqual(toolNamesFrom([{}]), [])
  assert.deepEqual(toolNamesFrom('nonsense'), [])
})

test('the write list covers the tools that change stored things', () => {
  for (const name of ['draft_post', 'publish_to_social', 'manage_posts', 'caption_video']) {
    assert.ok(WRITE_TOOLS.has(name), `${name} changes something and must count as backing a claim`)
  }
  // Read-only tools must NOT back a claim, or the check is decorative.
  for (const name of ['query_media', 'query_analytics', 'verify_product', 'browse_page']) {
    assert.ok(!WRITE_TOOLS.has(name), `${name} changes nothing and must not back a claim`)
  }
})
