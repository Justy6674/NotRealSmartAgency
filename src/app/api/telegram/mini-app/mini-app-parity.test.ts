import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

/**
 * The boundary moved with the answer.
 *
 * It used to be asserted on the job-polling route, which the timeline
 * replaced. Rather than deleting the guard with the route, it now lives in
 * timeline-text.ts as an EXHAUSTIVE switch — so a new event kind cannot be
 * added without declaring which of its text fields a model wrote. The check
 * stopped being something anyone has to remember.
 */
test('the marketing boundary is enforced on everything the timeline returns', () => {
  const text = read('src/lib/telegram/timeline-text.ts')
  assert.match(text, /inspectMarketingInput/)
  assert.match(text, /const exhaustive: never = payload/)

  const route = read('src/app/api/telegram/mini-app/timeline/route.ts')
  assert.match(route, /sanitiseTimeline/)
  const sanitise = route.indexOf('sanitiseTimeline(sourceEvents)')
  const build = route.indexOf('buildTelegramTimeline')
  assert.ok(sanitise > -1 && build > -1)
  assert.ok(build < sanitise, 'events are sanitised on the way into the builder')
})

test('the routes the timeline replaced are gone, not left beside it', () => {
  // Leaving /media alive preserves the newest-first ordering this whole
  // change exists to remove.
  assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/telegram/mini-app/media/route.ts')), false)
  assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/telegram/mini-app/jobs/[jobId]/route.ts')), false)
})

test('the client never sorts the conversation itself', () => {
  const page = read('src/app/telegram/page.tsx')
  const view = read('src/app/telegram/timeline-view.tsx')
  assert.doesNotMatch(page, /\.sort\(/)
  assert.doesNotMatch(view, /\.sort\(/)
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

test('a Mini App social proposal is filed through the canonical draft path, never published directly', () => {
  const draft = read('src/app/api/telegram/mini-app/draft/route.ts')
  assert.match(draft, /createDraftPost/)
  assert.match(draft, /stage !== 'proposal'/)
  assert.doesNotMatch(draft, /post_type !== 'carousel'/)
  assert.match(draft, /mixpost/)
  assert.doesNotMatch(draft, /publishToSocial|publish_now/)
})
