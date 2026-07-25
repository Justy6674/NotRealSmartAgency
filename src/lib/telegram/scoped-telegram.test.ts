import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildScopedProjectKeyboard,
  parseScopedTelegramIntent,
} from './scoped-telegram.ts'

test('Telegram pairing only accepts a deliberate one-time start code', () => {
  assert.deepEqual(
    parseScopedTelegramIntent('/start nrs_pair_0123456789abcdef0123456789abcdef'),
    { kind: 'pair', code: '0123456789abcdef0123456789abcdef' },
  )
  assert.deepEqual(parseScopedTelegramIntent('/start Scent Sell launch'), { kind: 'choose_project' })
  assert.deepEqual(parseScopedTelegramIntent('make social posts for Do Today'), {
    kind: 'marketing_request',
    message: 'make social posts for Do Today',
  })
})

test('Project selection is an explicit grant identifier, never inferred from a message', () => {
  assert.deepEqual(parseScopedTelegramIntent(undefined, 'nrs_project:7e19d0d7-98da-4585-92e9-bf47b405c511'), {
    kind: 'select_project',
    grantId: '7e19d0d7-98da-4585-92e9-bf47b405c511',
  })
  assert.deepEqual(parseScopedTelegramIntent(undefined, 'nrs_project:do-today'), { kind: 'ignore' })
})

test('The picker contains only the paired account grant names and opaque grant identifiers', () => {
  assert.deepEqual(buildScopedProjectKeyboard([
    { grantId: 'grant-1', projectName: 'Do Today' },
    { grantId: 'grant-2', projectName: 'Scent Sell' },
  ]), {
    inline_keyboard: [
      [{ text: 'Do Today', callback_data: 'nrs_project:grant-1' }],
      [{ text: 'Scent Sell', callback_data: 'nrs_project:grant-2' }],
    ],
  })
})

test('a project-scoped GitHub connection understands normal language', () => {
  assert.deepEqual(parseScopedTelegramIntent('/connect'), { kind: 'connect_github', scope: 'current' })
  assert.deepEqual(parseScopedTelegramIntent('/connect all'), { kind: 'connect_github', scope: 'all' })
  assert.deepEqual(parseScopedTelegramIntent('connect to my git hub'), { kind: 'connect_github', scope: 'current' })
  assert.deepEqual(parseScopedTelegramIntent('connect all my GitHub projects'), { kind: 'connect_github', scope: 'all' })
})
