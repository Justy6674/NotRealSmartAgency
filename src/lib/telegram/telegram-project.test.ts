import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramProjectKeyboard,
  getTelegramProjectSelection,
  isTelegramProjectPickerRequest,
  toTelegramDirectorRequest,
} from './telegram-project.ts'

const brands = [
  { id: 'dotoday', name: 'Do Today', slug: 'do-today' },
  { id: 'telescribe', name: 'TeleScribe', slug: 'telescribe' },
  { id: 'scent-sell', name: 'Scent Sell', slug: 'scent-sell' },
]

test('offers the owner a compact business picker', () => {
  assert.deepEqual(buildTelegramProjectKeyboard(brands), {
    keyboard: [['Do Today', 'TeleScribe'], ['Scent Sell']],
    resize_keyboard: true,
    input_field_placeholder: 'Choose a business',
  })
})

test('recognises picker commands and an exact chosen business', () => {
  assert.equal(isTelegramProjectPickerRequest('/projects'), true)
  assert.equal(isTelegramProjectPickerRequest('/start'), true)
  assert.equal(isTelegramProjectPickerRequest('/help'), false)
  assert.deepEqual(getTelegramProjectSelection('DoToday', brands), brands[0])
  assert.deepEqual(getTelegramProjectSelection('/use Scent Sell', brands), brands[2])
  assert.equal(getTelegramProjectSelection('Create posts for Do Today', brands), null)
})

test('turns the social shortcut into an approval-only Director brief', () => {
  const request = toTelegramDirectorRequest('/social', brands[0])

  assert.match(request, /topical social media pack/i)
  assert.match(request, /Do Today/)
  assert.match(request, /do not publish/i)
  assert.equal(toTelegramDirectorRequest('Make a Reel about this week', brands[0]), 'Make a Reel about this week')
})
