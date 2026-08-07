import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

/**
 * The Mini App is the Telegram surface that carries traffic — the chat webhook
 * receives nothing while another process owns the bot. Twice now a protection
 * was written on the chat path only and was therefore not in force anywhere
 * that mattered. These pin both to the surface that is actually used.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

test('the Mini App applies the same project fence as the chat path', () => {
  const miniApp = read('src/lib/telegram/mini-app.ts')
  assert.match(miniApp, /applyBrandFence/)
  assert.match(miniApp, /allowed_brand_ids/)
})

test('both surfaces use the one fence, not a copy each', () => {
  const miniApp = read('src/lib/telegram/mini-app.ts')
  const webhook = read('src/app/api/webhooks/telegram/route.ts')
  assert.match(miniApp, /from '\.\/project-fence'/)
  assert.match(webhook, /from '@\/lib\/telegram\/project-fence'/)
  // Neither may keep its own hand-rolled Set of brand ids.
  assert.doesNotMatch(webhook, /new Set\(account\.allowed_brand_ids\)/)
  assert.doesNotMatch(miniApp, /new Set\(account\.allowed_brand_ids\)/)
})

test('a project switched off cannot stay the active selection', () => {
  const miniApp = read('src/lib/telegram/mini-app.ts')
  assert.match(miniApp, /grants\.some\(\(grant\) => grant\.projectId === selected\.projectId\)/)
})

test('the marketing boundary is enforced on the Mini App answer too', () => {
  const jobs = read('src/app/api/telegram/mini-app/jobs/[jobId]/route.ts')
  assert.match(jobs, /inspectMarketingInput/)
  const inspection = jobs.indexOf('inspectMarketingInput(raw)')
  const send = jobs.indexOf('formatTelegramMarketingCopy(raw)')
  assert.ok(inspection > -1 && send > -1)
  assert.ok(inspection < send, 'the boundary must be checked before the answer is returned')
})

test('the Mini App sends files to the chat but not a duplicate of the answer', () => {
  const message = read('src/app/api/telegram/mini-app/message/route.ts')
  assert.match(message, /chatId: context\.auth\.telegramUserId/)
  assert.match(message, /deliverText: false/)
})

test('the job honours a scope that asks for files only', () => {
  const job = read('src/lib/mcp/director-job.ts')
  assert.match(job, /execution\.deliverText !== false/)
  // The album is NOT behind that flag — files are the whole point of it.
  const album = job.indexOf('await deliverTelegramMedia({')
  assert.ok(album > -1, 'the job must still deliver media')
})
