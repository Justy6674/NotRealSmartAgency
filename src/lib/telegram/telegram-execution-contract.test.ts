import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramExecutionContract,
  isTelegramExecutionRequest,
} from './telegram-execution-contract.ts'

test('an explicit Telegram task requires completed work rather than a service menu', () => {
  assert.equal(isTelegramExecutionRequest('Scan the site'), true)
  assert.equal(isTelegramExecutionRequest('Build this week’s launch plan'), true)
  assert.equal(isTelegramExecutionRequest('Hello'), false)

  const contract = buildTelegramExecutionContract('Scan the site')
  assert.match(contract, /complete the requested work now/i)
  assert.match(contract, /do not send a menu of services/i)
  assert.match(contract, /do not ask a clarifying question/i)
})
