import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

/**
 * These read the route as text, matching the other scope tests in this folder.
 * The handler cannot be imported without a Next request context, and what is
 * being protected here is structural: which chats are let in, and what decides
 * the project.
 */
const route = () =>
  readFileSync(resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'), 'utf8')

test('an ordinary group is accepted, not only a forum', () => {
  const source = route()
  assert.match(source, /chat\?\.type === 'group' \|\| chat\?\.type === 'supergroup'/)
  assert.match(source, /if \(!isPrivate && !isForum && !isGroup\) return null/)
})

test('group membership alone still grants nothing', () => {
  const source = route()
  // The account lookup is by Telegram user, and the grants come from that
  // account. Nothing keys off the group's chat id.
  assert.match(source, /\.eq\('telegram_user_id', inbound\.telegramUserId\)/)
  assert.doesNotMatch(source, /\.eq\('telegram_chat_id', inbound\.chatId\)\s*\n\s*\.eq\('channel', 'telegram'\)/)
})

test('a Telegram account can be fenced to a subset of its projects', () => {
  const source = route()
  assert.match(source, /allowed_brand_ids/)
  // The fence itself lives in project-fence.ts, shared with the Mini App, so
  // that the two surfaces cannot drift apart. See mini-app-parity.test.ts.
  assert.match(source, /applyBrandFence\(all, account\.allowed_brand_ids\)/)
})

test('someone with one project is never asked which project', () => {
  const source = route()
  assert.match(source, /if \(grants\.length === 1\) return grants\[0\]/)
})

/**
 * The "why does it keep reverting to Scent Sell" fault: a message posted in a
 * topic that was linked to nothing fell through to a selection made somewhere
 * else entirely. Posting in a topic states which project is meant, and a stale
 * selection must never override it.
 */
test('an unlinked topic asks rather than falling back to the last selection', () => {
  const source = route()
  assert.match(source, /if \(inATopic\) return undefined/)
  assert.match(source, /status: 'topic_unlinked'/)
  // The fallback must come AFTER the refusal, so it cannot be reached from a topic.
  const refusal = source.indexOf('if (inATopic) return undefined')
  const fallback = source.indexOf('const session = await getActiveSession(admin, account.id)', refusal)
  assert.ok(refusal > -1 && fallback > refusal, 'the stale-selection fallback must sit after the topic refusal')
})

test('a group with no topic is told what to do instead of being sent dead buttons', () => {
  const source = route()
  const groupBranch = source.indexOf('if (inbound.fromGroup) {')
  assert.ok(groupBranch > -1, 'the group case must be handled explicitly')
  const picker = source.indexOf('await sendProjectPicker', groupBranch)
  const reply = source.indexOf('await reply(', groupBranch)
  assert.ok(reply < picker, 'the group branch must reply with text before any picker')
})

test('a topic naming a project the sender cannot access says so', () => {
  const source = route()
  assert.match(source, /status: 'topic_not_permitted'/)
})

test('callback buttons are still refused outside the private chat', () => {
  const source = route()
  assert.match(source, /if \(chat\?\.type !== 'private' \|\| from\?\.is_bot === true/)
})

/**
 * Telegram RETRIES any update the webhook answers with a 5xx, so an unhandled
 * throw is a loop, not a one-off. Seen live: a send to a chat that no longer
 * exists returned 400, the throw escaped, and the webhook 500'd — which would
 * have had Telegram redeliver the same update indefinitely.
 */
test('an accepted update is always answered 200, whatever goes wrong', () => {
  const source = route()
  assert.match(source, /try \{\s*return await handleTelegramUpdate\(request\)/)
  assert.match(source, /status: 'error_swallowed'/)
  // The 401 for a forged secret must still be a real rejection, not swallowed.
  assert.match(source, /status: 'invalid_webhook_secret' \}, \{ status: 401 \}/)
})

test('a reply that cannot be delivered does not abandon the work', () => {
  const source = route()
  assert.match(source, /const reply = async \(text: string/)
  assert.match(source, /\[telegram\] reply failed:/)
})
