import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('Telegram Director work appends the execution contract after the general prompt rules', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/mcp/director-job.ts'), 'utf8')

  assert.match(source, /buildTelegramExecutionContract/)
  assert.match(source, /needsTelegramResearchBeforeDeliver/)
  assert.match(source, /execution\.channel === 'telegram'/)
  assert.ok(source.indexOf('INQUISITIVE BEHAVIOUR') < source.indexOf('buildTelegramExecutionContract(message'))
  assert.match(source, /repairNeedsResearch \? \{ tools \}/)
})
