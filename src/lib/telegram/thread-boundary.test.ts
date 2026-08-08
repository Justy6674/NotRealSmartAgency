import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boundaryKey, boundaryNamespace, readThreadStart, setThreadStart } from './thread-boundary'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Enough of Supabase to exercise the read and write paths honestly. */
function fakeDb(rows: Array<Record<string, unknown>>) {
  const inserted: Array<Record<string, unknown>> = []
  const updated: Array<Record<string, unknown>> = []
  const client = {
    from() {
      const q: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: rows[0] ?? null }),
        insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null } },
        update: (row: Record<string, unknown>) => { updated.push(row); return { eq: async () => ({ error: null }) } },
      }
      void q
      return chain
    },
  } as unknown as SupabaseClient
  return { client, inserted, updated }
}

const who = { brandId: 'b1', brandSlug: 'scent-sell', userId: 'u1' }

test('the key and namespace are scoped to the brand', () => {
  assert.equal(boundaryKey('scent-sell'), 'telegram-thread-start-scent-sell')
  assert.equal(boundaryNamespace('scent-sell'), 'nrs-scent-sell')
  assert.notEqual(boundaryKey('scent-sell'), boundaryKey('downscale'))
})

test('a brand that has never started fresh shows its whole history', () => {
  // Null must mean "no line drawn", not "show nothing" — otherwise turning
  // this on would blank every existing conversation.
  const { client } = fakeDb([])
  return readThreadStart(client, who).then((ms) => assert.equal(ms, null))
})

test('the line is read back as a timestamp', async () => {
  const { client } = fakeDb([{ value: { started_at: '2026-08-08T06:00:00.000Z' } }])
  assert.equal(await readThreadStart(client, who), Date.parse('2026-08-08T06:00:00.000Z'))
})

test('the line is read back when the row holds a STRING of JSON', async () => {
  // This is the shape production actually returns, and the reason Start fresh
  // appeared to do nothing: the boundary was written on every press and thrown
  // away on every read, so the timeline reloaded the entire argument. The test
  // above passed the whole time because it handed the reader an object the
  // database never gives it. Assert against the real row, verbatim.
  const { client } = fakeDb([{ value: '{"started_at":"2026-08-08T20:36:48.048Z"}' }])
  assert.equal(await readThreadStart(client, who), Date.parse('2026-08-08T20:36:48.048Z'))
})

test('a corrupt value shows everything rather than nothing', async () => {
  // A bad row must not empty the screen. Everything is preferable to a blank
  // conversation the owner cannot explain.
  for (const value of [
    { started_at: 'not a date' }, { started_at: 42 }, {}, null,
    // Malformed JSON must fail the same way — open, not blank.
    'not json at all', '{"started_at":', '{"started_at":42}',
  ]) {
    const { client } = fakeDb([{ value }])
    assert.equal(await readThreadStart(client, who), null)
  }
})

test('drawing a new line inserts a row tagged as a bookmark', async () => {
  const { client, inserted } = fakeDb([])
  const at = new Date('2026-08-08T08:00:00.000Z')
  assert.equal(await setThreadStart(client, { ...who, at }), true)
  assert.equal(inserted.length, 1)
  assert.deepEqual(inserted[0].value, { started_at: at.toISOString() })
  // It is a bookmark, not a fact about the brand — it must never be fed to
  // the Director as something it knows about marketing.
  assert.deepEqual(inserted[0].tags, ['thread-boundary'])
  assert.equal(inserted[0].memory_type, 'system')
})

test('an existing line is moved, not duplicated', async () => {
  const { client, inserted, updated } = fakeDb([{ id: 'm1' }])
  await setThreadStart(client, { ...who, at: new Date('2026-08-08T09:00:00.000Z') })
  assert.equal(inserted.length, 0, 'a second row would leave two lines and an ambiguous start')
  assert.equal(updated.length, 1)
})
