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
  assert.doesNotMatch(route, /resolveTelegramBrand|telegram-selection|\.eq\('user_id', account\.actor_user_id\).*from\('brands'\)/s)
})

test('Telegram delivery runs through the clean marketing-copy renderer', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
    'utf8',
  )

  assert.match(route, /formatTelegramMarketingCopy/)
  assert.match(route, /text: telegramResponse/)
})

test('Telegram route never tells the owner to use a slash command', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
    'utf8',
  )

  assert.doesNotMatch(route, /Use \/(?:projects|connect)/)
})
