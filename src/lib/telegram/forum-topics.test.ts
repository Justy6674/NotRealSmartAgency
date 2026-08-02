import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readThreadId, describeTopicSetup, routeByTopic } from './forum-topics'

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

  assert.deepEqual(route, { grantId: 'grant-1', projectId: 'brand-1' })
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
