import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeGroupStatus, parseMyChatMember } from './group-join'

const event = (chat: Record<string, unknown>, member: Record<string, unknown>) => ({
  my_chat_member: { chat: { id: -1001234567890, ...chat }, new_chat_member: member },
})

test('being added to a group is recognised', () => {
  const parsed = parseMyChatMember(event({ type: 'supergroup', is_forum: false }, { status: 'member' }))
  assert.deepEqual(parsed, {
    chatId: '-1001234567890',
    chatType: 'supergroup',
    isForum: false,
    status: 'member',
    canManageTopics: false,
  })
})

test('a private chat block/unblock is not something to answer', () => {
  assert.equal(parseMyChatMember(event({ type: 'private' }, { status: 'member' })), null)
})

test('an ordinary message is not a membership change', () => {
  assert.equal(parseMyChatMember({ message: { text: 'hello' } }), null)
  assert.equal(parseMyChatMember(null), null)
  assert.equal(parseMyChatMember({ my_chat_member: {} }), null)
})

test('just added, no topics: both remaining steps are named', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: false, status: 'member', canManageTopics: false,
  })!
  assert.match(text, /I'm in/)
  assert.match(text, /Manage Topics/)
  assert.match(text, /Edit → Topics/)
})

test('just added but topics already on: that step is ticked off, not repeated', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: true, status: 'member', canManageTopics: false,
  })!
  assert.match(text, /Topics are already on/)
  assert.doesNotMatch(text, /Turn Topics on/)
})

test('admin without the right names only that right', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: true, status: 'administrator', canManageTopics: false,
  })!
  assert.match(text, /switch ON "Manage Topics"/)
  assert.doesNotMatch(text, /Edit → Topics/)
})

test('admin with the right, but topics off, names only the topics switch', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: false, status: 'administrator', canManageTopics: true,
  })!
  assert.match(text, /Edit → Topics/)
  assert.doesNotMatch(text, /Manage Topics" *\./)
})

test('everything in place says so and gives the command', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: true, status: 'administrator', canManageTopics: true,
  })!
  assert.match(text, /All set/)
  assert.match(text, /set up topics/)
})

test('the group creator needs no explicit right', () => {
  const text = describeGroupStatus({
    chatId: '-1', chatType: 'supergroup', isForum: true, status: 'creator', canManageTopics: false,
  })!
  assert.match(text, /All set/)
})

test('being removed says nothing — a parting comment is noise', () => {
  for (const status of ['left', 'kicked']) {
    assert.equal(
      describeGroupStatus({ chatId: '-1', chatType: 'supergroup', isForum: true, status, canManageTopics: false }),
      null,
    )
  }
})

test('nothing said here could leak project data', () => {
  // This fires BEFORE anyone has been checked against a pairing, so whatever
  // it says is said to whoever added the bot.
  const messages = [
    describeGroupStatus({ chatId: '-1', chatType: 'supergroup', isForum: false, status: 'member', canManageTopics: false }),
    describeGroupStatus({ chatId: '-1', chatType: 'supergroup', isForum: true, status: 'administrator', canManageTopics: true }),
  ]
  for (const text of messages) {
    assert.ok(text)
    assert.doesNotMatch(text, /Scent Sell|Downscale|TeleScribe|brand_id|[0-9a-f]{8}-[0-9a-f]{4}/i)
  }
})
