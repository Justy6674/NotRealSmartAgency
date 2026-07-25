import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('Telegram jobs retain only explicit founder learning through the scoped memory store', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/mcp/director-job.ts'), 'utf8')

  assert.match(source, /extractExplicitFounderLearnings/)
  assert.match(source, /execution\.channel === 'telegram'/)
  assert.match(source, /memoryStoreV2\(fact, ns, userId, typedBrand\.id\)/)
})
