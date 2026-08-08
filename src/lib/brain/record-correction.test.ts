import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordCorrection, correctionsForPrompt } from './record-correction'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "ScentSell" was corrected repeatedly on 8 August 2026 and each correction
 * taught the system nothing — a warning to a platform log nobody reads, then
 * the identical mistake an hour later. A check that fires is the highest
 * quality signal available: not inferred from tone, a measured fact about a
 * specific failure. Throwing it away was the waste.
 */

function db(rows: Array<Record<string, unknown>> = []) {
  const inserted: Array<Record<string, unknown>> = []
  const updated: Array<Record<string, unknown>> = []
  const client = {
    from() {
      const chain: Record<string, unknown> = {}
      Object.assign(chain, {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: rows[0] ?? null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: rows }),
        insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null } },
        update: (row: Record<string, unknown>) => { updated.push(row); return { eq: async () => ({ error: null }) } },
      })
      return chain
    },
  } as unknown as SupabaseClient
  return { client, inserted, updated }
}

const who = { brandId: 'b1', brandSlug: 'scent-sell', userId: 'u1' }

test('a first correction is recorded with a count of one', async () => {
  const { client, inserted } = db()
  await recordCorrection(client, {
    ...who, kind: 'brand_name', detail: 'ScentSell',
    lesson: 'It is "Scent Sell" — never any other form.',
  })
  assert.equal(inserted.length, 1)
  const value = inserted[0].value as { count: number; examples: string[] }
  assert.equal(value.count, 1)
  assert.deepEqual(value.examples, ['ScentSell'])
  // A preference, not an observation — the prompt builder ranks it higher.
  assert.equal(inserted[0].memory_type, 'preference')
})

test('the count accumulates rather than starting over', async () => {
  const { client, updated } = db([{ id: 'm1', value: { kind: 'brand_name', count: 13, examples: ['ScentSell'], lesson: 'x', lastAt: '' } }])
  await recordCorrection(client, { ...who, kind: 'brand_name', detail: 'Scentsell', lesson: 'x' })
  const value = updated[0].value as { count: number; examples: string[] }
  assert.equal(value.count, 14, 'the number IS the lesson — resetting it loses the whole signal')
  assert.deepEqual(value.examples, ['Scentsell', 'ScentSell'])
})

test('the same wrong spelling twenty times is one example and a count of twenty', async () => {
  const { client, updated } = db([{ id: 'm1', value: { kind: 'brand_name', count: 19, examples: ['ScentSell'], lesson: 'x', lastAt: '' } }])
  await recordCorrection(client, { ...who, kind: 'brand_name', detail: 'ScentSell', lesson: 'x' })
  const value = updated[0].value as { count: number; examples: string[] }
  assert.equal(value.count, 20)
  assert.deepEqual(value.examples, ['ScentSell'], 'duplicates would crowd the prompt for no gain')
})

test('examples are capped so one mistake cannot fill the prompt', async () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const { client, updated } = db([{ id: 'm1', value: { kind: 'brand_name', count: 7, examples: many, lesson: 'x', lastAt: '' } }])
  await recordCorrection(client, { ...who, kind: 'brand_name', detail: 'new', lesson: 'x' })
  const value = updated[0].value as { examples: string[] }
  assert.ok(value.examples.length <= 5)
})

test('the prompt leads with the count, because a number carries weight', async () => {
  const { client } = db([
    { value: { kind: 'brand_name', count: 14, examples: ['ScentSell'], lesson: 'It is "Scent Sell".', lastAt: '' } },
  ])
  const prompt = await correctionsForPrompt(client, who)
  assert.ok(prompt)
  assert.match(prompt!, /14x/)
  assert.match(prompt!, /caught by a check/)
})

test('no corrections produces no prompt block', async () => {
  // An empty heading claims "you have made no mistakes", which is a claim.
  assert.equal(await correctionsForPrompt(db().client, who), null)
})

test('recording never throws, whatever the database does', async () => {
  const broken = { from() { throw new Error('down') } } as unknown as SupabaseClient
  // A lesson is worth having and never worth failing a reply for.
  await recordCorrection(broken, { ...who, kind: 'brand_name', detail: 'x', lesson: 'y' })
})
