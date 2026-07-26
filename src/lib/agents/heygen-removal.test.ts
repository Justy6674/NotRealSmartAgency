import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const sourceRoot = join(process.cwd(), 'src')
const thisFile = join(sourceRoot, 'lib/agents/heygen-removal.test.ts')
const removedProvider = ['hey', 'gen'].join('')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(file) : [file]
  })
}

test('NRS source has no runtime dependency on the removed video provider', () => {
  assert.equal(existsSync(join(sourceRoot, 'lib/heygen')), false)
  assert.equal(existsSync(join(sourceRoot, 'app/api/heygen')), false)
  assert.equal(existsSync(join(sourceRoot, 'app/api/webhooks/heygen')), false)

  const mentions = sourceFiles(sourceRoot)
    .filter((file) => file !== thisFile)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => readFileSync(file, 'utf8').toLowerCase().includes(removedProvider))

  assert.deepEqual(mentions, [])
})
