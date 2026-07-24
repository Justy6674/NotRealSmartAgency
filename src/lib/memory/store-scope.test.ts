import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('semantic memory deduplication passes the project filter to match_memories', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/memory/store.ts'), 'utf8')
  assert.match(source, /filter_namespace: namespace,[\s\S]*filter_user_id: userId,[\s\S]*filter_brand_id: brandId,/)
})
