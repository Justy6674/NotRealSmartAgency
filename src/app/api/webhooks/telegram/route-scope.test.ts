import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('Telegram route is paired-grant scoped and contains no legacy brand inference', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
    'utf8',
  )

  assert.match(route, /if \(!config\?\.enabled\)/)
  assert.match(route, /parseScopedTelegramIntent/)
  assert.match(route, /\.eq\('channel', 'telegram'\)/)
  assert.match(route, /createTelegramDirectorExecution/)
  assert.match(route, /\.eq\('project_access_grant_id', execution\.projectAccessGrantId\)/)
  assert.doesNotMatch(route, /resolveTelegramBrand|telegram-selection|\.eq\('user_id', account\.actor_user_id\)[\s\S]*from\('brands'\)/)
})

/**
 * The answer is delivered by the job that produced it, and by nothing else.
 *
 * Both used to send it: the job (added when this continuation proved it could
 * be reclaimed mid-flight) and the continuation here, which was left in place.
 * Every answer went out twice. This asserts the webhook has no send of the
 * response left in it, so a third delivery site cannot quietly reappear.
 */
test('the webhook audits the answer but does not send it', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
    'utf8',
  )

  assert.doesNotMatch(route, /text: telegramResponse/)
  assert.doesNotMatch(route, /sendTelegramText\([^)]*formatTelegramMarketingCopy/)
  assert.match(route, /action: 'director_response'/)
})

test('Telegram delivery runs through the clean marketing-copy renderer', () => {
  const job = readFileSync(
    resolve(process.cwd(), 'src/lib/mcp/director-job.ts'),
    'utf8',
  )

  assert.match(job, /formatTelegramMarketingCopy/)
  assert.match(job, /text: formatTelegramMarketingCopy\(text\)/)
})

/**
 * A response that fails the marketing data boundary must be stopped BEFORE it
 * is sent. The check used to run in the continuation, after the job had
 * already delivered — so the owner received the response and was then told it
 * had been withheld.
 */
test('the boundary check sits in front of Telegram delivery', () => {
  const job = readFileSync(
    resolve(process.cwd(), 'src/lib/mcp/director-job.ts'),
    'utf8',
  )

  const inspection = job.indexOf('const outputInspection = inspectMarketingInput(response)')
  const delivery = job.indexOf('await deliverTelegramResult(execution.telegramChatId, response')
  assert.ok(inspection > -1, 'the job must inspect the response it is about to send')
  assert.ok(delivery > -1, 'the job must deliver the response')
  assert.ok(inspection < delivery, 'the boundary check must run before delivery')
})

test('Telegram route never tells the owner to use a slash command', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
    'utf8',
  )

  assert.doesNotMatch(route, /Use \/(?:projects|connect)/)
})
