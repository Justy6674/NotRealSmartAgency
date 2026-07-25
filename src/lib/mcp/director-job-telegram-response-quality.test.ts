import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('Telegram Director work repairs a generic hand-off before completing a job', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/mcp/director-job.ts'), 'utf8')

  assert.match(source, /needsTelegramResponseRepair/)
  assert.match(source, /buildTelegramResponseRepairPrompt/)
  assert.match(source, /telegram-repair/)
})
