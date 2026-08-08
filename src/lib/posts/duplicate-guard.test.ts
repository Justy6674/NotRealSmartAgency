import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeMixpostOutcome } from './create-draft'

/**
 * One request produced six drafts.
 *
 * Three identical Instagram/Facebook pairs from a single ask. The owner even
 * said "you did them already" and received two more — nothing checked, and a
 * Director that has just written a caption has no way to know it wrote the
 * same one four minutes ago.
 */
const source = readFileSync(resolve(process.cwd(), 'src/lib/posts/create-draft.ts'), 'utf8')

test('a draft is checked against recent ones before another is made', () => {
  assert.match(source, /duplicate suppressed/, 'nothing stops a repeat')
  const check = source.indexOf('const duplicate = ')
  const insert = source.indexOf('const insertData')
  assert.ok(check > -1 && check < insert, 'the check must run before the row is built')
})

test('a match is judged on media AND the opening of the caption', () => {
  // Media alone would block a genuinely different post about the same photo.
  // The whole caption would let a one-word change through as "new".
  assert.match(source, /sameOpening && sameMedia/)
})

test('the window allows a deliberate repost later', () => {
  assert.match(source, /DUPLICATE_WINDOW_MS = 30 \* 60 \* 1000/,
    'blocking forever would stop the owner reposting something next week')
})

test('a suppressed duplicate is said out loud, not passed off as new', () => {
  const said = describeMixpostOutcome({
    id: 'x', postType: 'single', mediaItemIds: [], mixpost: 'duplicate',
  })
  assert.match(said, /already drafted/)
  assert.match(said, /have not made a second copy/)
})

test('every outcome has words, so none can fall through silently', () => {
  for (const outcome of ['synced', 'pending', 'failed', 'skipped', 'duplicate'] as const) {
    const said = describeMixpostOutcome({
      id: 'x', postType: 'single', mediaItemIds: [], mixpost: outcome,
    })
    assert.ok(said && said.length > 10, `${outcome} has no honest description`)
  }
})
