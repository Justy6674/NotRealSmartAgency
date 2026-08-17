import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * D7: one publishToPlatform call per ticked account id.
 * First-match on platform posts twice to Instagram 1.
 */
const dispatcher = readFileSync(join(process.cwd(), 'src/lib/publishers/dispatcher.ts'), 'utf8')
const types = readFileSync(join(process.cwd(), 'src/lib/publishers/types.ts'), 'utf8')
const transport = readFileSync(join(process.cwd(), 'src/lib/publishers/transport.ts'), 'utf8')
const code = dispatcher
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

test('PublishRequest requires account_id', () => {
  assert.match(types, /account_id:\s*string/)
})

test('selectPublisherBackend matches the requested account id, not the first platform', () => {
  assert.match(code, /account_id/)
  assert.doesNotMatch(
    code,
    /accounts\.find\(\s*\(a\)\s*=>\s*a\.profileId === profileId && a\.platform === platform/,
    'first-match on platform posts two Instagram ticks to Instagram 1',
  )
})

test('linked Zernio path does not fall through to Mixpost when the id is missing', () => {
  assert.match(transport, /That account isn’t connected for this business/)
  assert.match(transport, /No account ticked for this network/)
  assert.match(code, /backend: 'refused'/)
})
