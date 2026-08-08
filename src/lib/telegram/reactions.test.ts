import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReaction, verdictFor, lessonFrom } from './reactions'

const update = (over: Record<string, unknown> = {}) => ({
  message_reaction: {
    chat: { id: 123 },
    user: { id: 456, is_bot: false },
    message_id: 99,
    new_reaction: [{ type: 'emoji', emoji: '👍' }],
    ...over,
  },
})

test('a thumbs up is read as approval, tied to the message it was on', () => {
  const event = parseReaction(update())!
  assert.equal(event.verdict, 'approved')
  assert.equal(event.messageId, 99, 'without the message id the thumb points at nothing')
  assert.equal(event.chatId, '123')
})

test('removing a reaction is not the opposite of adding one', () => {
  // An empty new_reaction means "I did not mean that", not "the opposite".
  // Recording it as a rejection would invent an opinion nobody expressed.
  assert.equal(parseReaction(update({ new_reaction: [] })), null)
})

test('an emoji with no clear meaning records nothing', () => {
  // 🤔 and 👀 are thinking, not judgement. Guessing at them fills the record
  // with opinions the owner never held — worse than an empty record, because
  // it is confidently wrong.
  for (const emoji of ['🤔', '👀', '🤷', '😐']) {
    assert.equal(verdictFor(emoji), null, `${emoji} must not be read as a verdict`)
    assert.equal(parseReaction(update({ new_reaction: [{ type: 'emoji', emoji }] })), null)
  }
})

test('the obvious verdicts are read correctly', () => {
  for (const emoji of ['👍', '❤️', '🔥', '💯', '👏']) {
    assert.equal(verdictFor(emoji), 'approved', emoji)
  }
  for (const emoji of ['👎', '💩', '🤮']) {
    assert.equal(verdictFor(emoji), 'rejected', emoji)
  }
})

test('a bot reacting to a bot is not feedback', () => {
  assert.equal(parseReaction(update({ user: { id: 1, is_bot: true } })), null)
})

test('a custom sticker reaction is ignored', () => {
  // Paid custom emoji mean whatever the buyer decided; there is nothing to read.
  assert.equal(parseReaction(update({ new_reaction: [{ type: 'custom_emoji', custom_emoji_id: 'x' }] })), null)
})

test('anything that is not a reaction update is passed over', () => {
  assert.equal(parseReaction({ message: { text: 'hello' } }), null)
  assert.equal(parseReaction(null), null)
  assert.equal(parseReaction('nonsense'), null)
  assert.equal(parseReaction(update({ message_id: 'not a number' })), null)
})

test('the lesson names what landed and quotes it back', () => {
  const good = lessonFrom(parseReaction(update())!, '  I wanted to smell   offensively clean.  ')
  assert.match(good, /it landed/)
  // Whitespace collapsed so the memory reads as one line, not as pasted copy.
  assert.match(good, /"I wanted to smell offensively clean\."/)

  const bad = lessonFrom(
    parseReaction(update({ new_reaction: [{ type: 'emoji', emoji: '👎' }] }))!,
    'Some copy that missed.',
  )
  assert.match(bad, /it missed/)
})

test('a long answer is truncated rather than filling the memory', () => {
  const lesson = lessonFrom(parseReaction(update())!, 'x'.repeat(2000))
  assert.ok(lesson.length < 400, `a whole caption would crowd out every other memory: ${lesson.length}`)
})
