import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDeskContext,
  buildDeskDirectorContext,
  createDeskConversationMetadata,
  readDeskContext,
} from './context.ts'

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]

test('Desk context preserves exact media order and records who acted', () => {
  const context = buildDeskContext({
    actorUserId: 'bec-1',
    mediaItemIds: ids,
    intent: 'Create a TikTok description',
    platforms: ['tiktok'],
  })

  assert.deepEqual(context.media_item_ids, ids)
  assert.equal(context.actor_user_id, 'bec-1')
  assert.equal(context.source, 'nrs_desk')
  assert.equal(context.schema_version, 1)
})

test('Desk context rejects duplicate, invalid and oversized media selections', () => {
  assert.throws(() => buildDeskContext({ actorUserId: 'bec-1', mediaItemIds: [ids[0], ids[0]] }))
  assert.throws(() => buildDeskContext({ actorUserId: 'bec-1', mediaItemIds: ['latest'] }))
  assert.throws(() => buildDeskContext({ actorUserId: 'bec-1', mediaItemIds: Array.from({ length: 11 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`) }))
})

test('the Director receives explicit IDs and never a newest-upload instruction', () => {
  const context = buildDeskContext({ actorUserId: 'bec-1', mediaItemIds: ids, platforms: ['tiktok'] })
  const directive = buildDeskDirectorContext(context)

  assert.match(directive, new RegExp(ids[0]))
  assert.match(directive, new RegExp(ids[1]))
  assert.match(directive, /tiktok/i)
  assert.doesNotMatch(directive, /newest|latest/i)
})

test('conversation metadata round-trips a valid Desk context and fails closed on legacy junk', () => {
  const context = buildDeskContext({ actorUserId: 'owner-1', mediaItemIds: ids })
  assert.deepEqual(readDeskContext(createDeskConversationMetadata(context)), context)
  assert.equal(readDeskContext({ source: 'nrs_desk', desk_context: { media_item_ids: ['wrong'] } }), null)
  assert.equal(readDeskContext({}), null)
})
