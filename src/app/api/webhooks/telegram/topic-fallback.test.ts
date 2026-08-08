import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A private chat must never dead-end on an unlinked topic.
 *
 * Telegram's threaded DMs create topics by themselves, and clearing the chat
 * history deletes them — after which every message lands in a topic with no
 * link. Refusing to answer there made the bot reply to everything, including
 * "why did you remove topics", with the same refusal to guess. It read as
 * completely dead, and the second person on the account stopped using it.
 *
 * A shared GROUP is the opposite case: there the topic is how people tell
 * brands apart, and guessing could post one brand's copy to another's page.
 */
const route = readFileSync(
  resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
  'utf8',
)

test('an unlinked topic only blocks routing in a group', () => {
  assert.ok(
    route.includes('if (inATopic && inbound.fromGroup) return undefined'),
    'a private chat must fall through to the selected project, not refuse',
  )
  assert.ok(
    !/if \(inATopic\) return undefined/.test(route),
    'the unconditional refusal is what dead-ended every DM',
  )
})

test('the "not linked" reply is reserved for groups', () => {
  const guard = route.indexOf('if (inATopic && inbound.fromGroup) {')
  const message = route.indexOf('This topic is not linked to a project yet')
  assert.ok(guard > -1, 'the unlinked-topic branch is gone or renamed')
  assert.ok(message > guard, 'the message must sit inside the group-only branch')
})

test('an unlinked group topic offers buttons rather than demanding a rename', () => {
  // Telling someone to go and rename a topic to answer a question they already
  // asked is work the app should be doing.
  assert.ok(route.includes('buildTopicLinkKeyboard'), 'no way to link a topic by tapping')
  assert.ok(
    !route.includes('Rename it to one of these'),
    'the rename instruction should be gone',
  )
})
