import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Every column a query asks for must exist.
 *
 * Two features shipped and never worked once, for the same reason:
 *
 *   - telegram-deliverables.ts asked for `file_size`; the column is
 *     `file_size_bytes`. Every carousel delivery failed with PostgREST 42703,
 *     the error was discarded, and it read as "nothing to send".
 *   - the forum-topics feature wrote a status the CHECK constraint forbade.
 *
 * Neither could be caught by the tests that existed, because those tests use a
 * fake Supabase client whose `.select()` returns the chain and ignores the
 * column list entirely. A test that cannot fail on a wrong column name is not
 * testing the query.
 *
 * This reads the real `.select('…')` strings out of the source and checks each
 * column against the row type in src/types/database.ts. It is static, so it
 * runs in CI with no database.
 */

const ROOT = process.cwd()

/** Tables whose row shape is declared in src/types/database.ts. */
const TABLE_TYPES: Record<string, string> = {
  media_items: 'MediaItem',
  scheduled_posts: 'ScheduledPost',
  brands: 'Brand',
  outputs: 'Output',
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(path) && !path.includes('.test.')) out.push(path)
  }
  return out
}

/** Pull `field: type` names out of an exported interface body. */
function fieldsOf(typeSource: string, name: string): Set<string> | null {
  const start = typeSource.indexOf(`export interface ${name} {`)
  if (start < 0) return null
  const open = typeSource.indexOf('{', start)

  let depth = 0
  let end = open
  for (let i = open; i < typeSource.length; i += 1) {
    if (typeSource[i] === '{') depth += 1
    if (typeSource[i] === '}') {
      depth -= 1
      if (depth === 0) { end = i; break }
    }
  }

  const body = typeSource.slice(open + 1, end)
  const fields = new Set<string>()
  for (const match of body.matchAll(/^\s*([a-z_][a-z0-9_]*)\??\s*:/gim)) {
    fields.add(match[1])
  }
  return fields
}

test('every column asked for in a .select() actually exists', () => {
  const types = readFileSync(resolve(ROOT, 'src/types/database.ts'), 'utf8')
  const problems: string[] = []

  for (const file of sourceFiles(resolve(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8')

    // .from('table') … .select('a, b, c') — the select may sit on a later line,
    // but it must belong to THIS from. Crossing another `.from(` is how
    // billing-pause.ts was reported as `scheduled_posts.social_urls` when the
    // select was on `brands` four lines later.
    for (const match of source.matchAll(
      /\.from\(\s*['"]([a-z_]+)['"]\s*\)(?:(?!\.from\()[\s\S]){0,400}?\.select\(\s*['"]([^'"]*)['"]/g,
    )) {
      const [, table, columns] = match
      const typeName = TABLE_TYPES[table]
      if (!typeName) continue

      const known = fieldsOf(types, typeName)
      if (!known) continue

      // Strip embedded resources entirely — the columns inside
      // `brands(id, name)` belong to brands, not to the outer table, and
      // reading them here reports a fault that is not there. A guard that
      // cries wolf is a guard that gets switched off.
      const outerOnly = columns.replace(/[a-z_]+(?:!inner|!left)?\([^)]*\)/g, '')

      for (const raw of outerOnly.split(',')) {
        const column = raw.trim()
        if (!column || column === '*') continue
        if (column.includes(':')) continue

        if (!known.has(column)) {
          problems.push(
            `${file.replace(ROOT + '/', '')}: ${table}.${column} is not a field of ${typeName}`,
          )
        }
      }
    }
  }

  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`)
})

test('the guard can actually fail — it is not vacuously passing', () => {
  // If the extraction above silently matched nothing, the test would pass no
  // matter how wrong the code was. Prove it finds the real queries.
  const types = readFileSync(resolve(ROOT, 'src/types/database.ts'), 'utf8')
  const known = fieldsOf(types, 'MediaItem')

  assert.ok(known, 'MediaItem must be found in database.ts')
  assert.ok(known.has('file_size_bytes'), 'the real column must be known')
  assert.ok(!known.has('file_size'), 'the wrong column must NOT be known')

  const deliverables = readFileSync(
    resolve(ROOT, 'src/lib/telegram/telegram-deliverables.ts'),
    'utf8',
  )
  assert.match(deliverables, /\.select\('id, file_url, file_type, file_size_bytes'\)/)

  // The pairing that used to cry wolf: two .from() calls close together, the
  // second table's select must not be attributed to the first.
  const pause = readFileSync(resolve(ROOT, 'src/lib/publishers/billing-pause.ts'), 'utf8')
  const pairs = [
    ...pause.matchAll(
      /\.from\(\s*['"]([a-z_]+)['"]\s*\)(?:(?!\.from\()[\s\S]){0,400}?\.select\(\s*['"]([^'"]*)['"]/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}`)
  assert.ok(
    pairs.some((p) => p.startsWith('brands:') && p.includes('social_urls')),
    'billing-pause still selects brands.social_urls — the pairing must still see it',
  )
  assert.ok(
    !pairs.some((p) => p.startsWith('scheduled_posts:') && p.includes('social_urls')),
    'scheduled_posts must not inherit brands.social_urls from a later select',
  )
})
