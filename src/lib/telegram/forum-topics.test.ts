import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readThreadId, describeTopicSetup, routeByTopic, safeTelegramReason } from './forum-topics'

/**
 * A topic per project removes the picker: the thread says which brand is meant.
 * The risk it introduces is posting to the WRONG brand, so an unmapped thread
 * must fall back to asking rather than guessing.
 */

test('reads the forum thread id off a message', () => {
  assert.equal(readThreadId({ message_thread_id: 42 }), 42)
})

test('a message outside a topic has no thread', () => {
  assert.equal(readThreadId({}), null)
  assert.equal(readThreadId({ message_thread_id: 'nope' }), null)
})

test('setup reports what it made and what already existed', () => {
  const text = describeTopicSetup({
    created: ['ScentSell'],
    existing: ['NotRealSmart'],
    failed: [],
  })
  assert.match(text, /Made a topic for: ScentSell/)
  assert.match(text, /Already had one: NotRealSmart/)
  assert.match(text, /no need to pick one first/)
})

test('a failure names the project and the reason', () => {
  const text = describeTopicSetup({
    created: [],
    existing: [],
    failed: [{ name: 'ScentSell', reason: 'not enough rights' }],
  })
  assert.match(text, /ScentSell \(not enough rights\)/)
})

test('says so plainly when there is nothing to set up', () => {
  assert.match(describeTopicSetup({ created: [], existing: [], failed: [] }), /Nothing to set up/)
})

/**
 * A topic belongs to the group, not to whoever ran setup. With two people in
 * one group, keying the lookup on the account meant only the creator's
 * messages routed — everyone else was asked to pick a project, in a room where
 * the picker's buttons do not work.
 */
test('a topic is looked up by the chat it lives in, not by the person posting', async () => {
  const seen: Array<[string, unknown]> = []
  const supabase = {
    from() {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = (column: string, value: unknown) => { seen.push([column, value]); return chain }
      chain.maybeSingle = async () => ({
        data: { project_access_grant_id: 'grant-1', brand_id: 'brand-1' },
        error: null,
      })
      return chain
    },
  } as unknown as Parameters<typeof routeByTopic>[0]

  const route = await routeByTopic(supabase, '-1001234567890', 8)

  assert.deepEqual(route, { kind: 'brand', grantId: 'grant-1', projectId: 'brand-1' })
  assert.ok(seen.some(([c, v]) => c === 'telegram_chat_id' && v === '-1001234567890'))
  assert.ok(seen.some(([c, v]) => c === 'message_thread_id' && v === 8))
  assert.ok(!seen.some(([c]) => c === 'telegram_account_id'), 'must not key on the account')
})

test('a message outside any topic routes nowhere', async () => {
  const supabase = {} as unknown as Parameters<typeof routeByTopic>[0]
  assert.equal(await routeByTopic(supabase, '-100', null), null)
})

test('a group without Topics turned on is told where the switch is', () => {
  const text = describeTopicSetup({
    created: [],
    existing: [],
    failed: [{ name: 'ScentSell', reason: 'Bad Request: the chat is not a forum' }],
  })
  assert.match(text, /Topics turned on/)
  assert.match(text, /Edit → Topics/)
})

/**
 * Bec's first sight of this product was a raw Postgres error:
 *   new row for relation "telegram_project_sessions" violates check
 *   constraint "telegram_project_sessions_check"
 * posted into the group by the bot. Nothing from a database, a stack or an
 * internal identifier may ever reach a person.
 */
test('a database failure never reaches the person reading the chat', () => {
  const text = describeTopicSetup({
    created: [],
    existing: [],
    failed: [
      { name: 'Scent Sell', reason: 'could not be linked to the project' },
      { name: 'Do Today', reason: 'could not be linked to the project' },
    ],
  })

  assert.doesNotMatch(text, /violates|constraint|relation|null value|column|pg|postgres|SQLSTATE/i)
  assert.doesNotMatch(text, /telegram_project_sessions/)
  assert.match(text, /Scent Sell/)
  assert.match(text, /Do Today/)
})

test("Telegram's own refusals are translated, not repeated verbatim", () => {
  assert.equal(safeTelegramReason('Bad Request: the chat is not a forum'), 'Topics are not turned on here')
  assert.equal(
    safeTelegramReason('Bad Request: not enough rights to manage topics'),
    'I do not have the "Manage Topics" right',
  )
  // Anything unrecognised is replaced rather than echoed — an unknown string
  // from an API is exactly how internal detail leaks out.
  assert.equal(safeTelegramReason('Bad Request: PEER_ID_INVALID'), 'Telegram refused to create it')
  assert.equal(safeTelegramReason(undefined), 'Telegram refused to create it')
})

/**
 * A topic with no brand is the Director topic — the front door. Treating it as
 * "unmapped" sent it down the guessing path and landed it on whichever brand
 * was last selected, which is why the Director appeared to know only one
 * business no matter what it was asked.
 */
test('a topic with no brand is the front door, not a missing mapping', async () => {
  const supabase = {
    from() {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.maybeSingle = async () => ({
        data: { project_access_grant_id: null, brand_id: null },
        error: null,
      })
      return chain
    },
  } as unknown as Parameters<typeof routeByTopic>[0]

  assert.deepEqual(await routeByTopic(supabase, '-100', 1), { kind: 'director' })
})
