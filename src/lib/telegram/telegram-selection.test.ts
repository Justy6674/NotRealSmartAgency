import assert from 'node:assert/strict'
import test from 'node:test'
import { TELEGRAM_SELECTION_NAMESPACE, telegramSelectionKey } from './telegram-selection.ts'

test('scopes a saved Telegram business choice to one private chat', () => {
  assert.equal(TELEGRAM_SELECTION_NAMESPACE, 'nrs-telegram-selection')
  assert.equal(telegramSelectionKey('8123637329'), 'selected-brand:8123637329')
})
