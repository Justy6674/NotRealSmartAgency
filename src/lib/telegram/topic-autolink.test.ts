import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeTopicLink,
  linkForTopicName,
  parseTopicNamed,
  type LinkableProject,
} from './topic-autolink'

const PROJECTS: LinkableProject[] = [
  { grantId: 'g1', projectId: 'p1', projectName: 'Scent Sell' },
  { grantId: 'g2', projectId: 'p2', projectName: 'Downscale Weight Loss' },
  { grantId: 'g3', projectId: 'p3', projectName: 'Do Today' },
  { grantId: 'g4', projectId: 'p4', projectName: 'EndorseMe' },
  { grantId: 'g5', projectId: 'p5', projectName: 'TeleCheck' },
  { grantId: 'g6', projectId: 'p6', projectName: 'TeleCheck Clinic' },
]

test('creating a topic is recognised, with its name', () => {
  const parsed = parseTopicNamed({
    message: {
      chat: { id: -1001234567890, type: 'supergroup' },
      message_thread_id: 42,
      forum_topic_created: { name: 'Scent Sell', icon_color: 123 },
    },
  })
  assert.deepEqual(parsed, { chatId: '-1001234567890', threadId: 42, name: 'Scent Sell', renamed: false })
})

test('renaming a topic is recognised too, so a fix relinks it', () => {
  const parsed = parseTopicNamed({
    message: {
      chat: { id: -1, type: 'supergroup' },
      message_thread_id: 7,
      forum_topic_edited: { name: 'Downscale' },
    },
  })
  assert.equal(parsed?.name, 'Downscale')
  assert.equal(parsed?.renamed, true)
})

test('an icon-only edit carries no name and means nothing here', () => {
  assert.equal(
    parseTopicNamed({
      message: { chat: { id: -1 }, message_thread_id: 7, forum_topic_edited: { icon_custom_emoji_id: 'x' } },
    }),
    null,
  )
})

test('an ordinary message is not a topic event', () => {
  assert.equal(parseTopicNamed({ message: { chat: { id: -1 }, message_thread_id: 7, text: 'hello' } }), null)
  assert.equal(parseTopicNamed(null), null)
})

test('the names he actually types find the right brand', () => {
  assert.deepEqual(linkForTopicName('Scent Sell', PROJECTS), { kind: 'brand', project: PROJECTS[0] })
  // He writes "Downscale"; the record says "Downscale Weight Loss".
  assert.deepEqual(linkForTopicName('Downscale', PROJECTS), { kind: 'brand', project: PROJECTS[1] })
  // He writes "Endorse Me"; the record says "EndorseMe".
  assert.deepEqual(linkForTopicName('Endorse Me', PROJECTS), { kind: 'brand', project: PROJECTS[3] })
  assert.deepEqual(linkForTopicName('do today', PROJECTS), { kind: 'brand', project: PROJECTS[2] })
})

test('the front door is recognised by any of its likely names', () => {
  for (const name of ['Director', 'Director Chat', 'General', 'Agency']) {
    assert.equal(linkForTopicName(name, PROJECTS).kind, 'director', `${name} must be the front door`)
  }
})

test('a longer brand name is not stolen by a shorter one', () => {
  assert.deepEqual(linkForTopicName('TeleCheck Clinic', PROJECTS), { kind: 'brand', project: PROJECTS[5] })
  assert.deepEqual(linkForTopicName('TeleCheck', PROJECTS), { kind: 'brand', project: PROJECTS[4] })
})

test('a topic that is not a brand is left alone, not forced onto one', () => {
  // "Sell" must NOT claim Scent Sell — a stray word cannot capture a brand.
  assert.equal(linkForTopicName('Sell', PROJECTS).kind, 'none')
  assert.equal(linkForTopicName('Ideas', PROJECTS).kind, 'none')
  assert.equal(linkForTopicName('Random chat', PROJECTS).kind, 'none')
  assert.equal(linkForTopicName('', PROJECTS).kind, 'none')
})

test('a brand he cannot reach is not linked', () => {
  // Sniffopotamus is real but switched off in Telegram, so it is not in the
  // list. It must stay unlinked rather than resolve to something else.
  assert.equal(linkForTopicName('Sniffopotamus', PROJECTS).kind, 'none')
})

test('a linked topic says which project it is, once', () => {
  const text = describeTopicLink({ kind: 'brand', project: PROJECTS[0] }, 'Scent Sell')!
  assert.match(text, /now Scent Sell/)
  assert.match(describeTopicLink({ kind: 'director' }, 'Director')!, /front door/)
})

test('an unrecognised topic says nothing at all', () => {
  // He may want a topic that is not a brand. Commenting on it is noise.
  assert.equal(describeTopicLink({ kind: 'none' }, 'Ideas'), null)
})
