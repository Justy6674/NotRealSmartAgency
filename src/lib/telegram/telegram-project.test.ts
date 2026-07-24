import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramProjectKeyboard,
  getTelegramProjectPageAction,
  getTelegramProjectSelection,
  isTelegramProjectPickerRequest,
  isTelegramStartRequest,
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

test('pages project choices so no business is hidden below the Telegram keyboard', () => {
  const portfolio = Array.from({ length: 11 }, (_, index) => ({
    id: `brand-${index + 1}`,
    name: `Business ${index + 1}`,
    slug: `business-${index + 1}`,
  }))

  assert.deepEqual(buildTelegramProjectKeyboard(portfolio), {
    keyboard: [
      ['Business 1', 'Business 2'],
      ['Business 3', 'Business 4'],
      ['Business 5', 'Business 6'],
      ['More projects →'],
    ],
    resize_keyboard: true,
    input_field_placeholder: 'Choose a business (1/2)',
  })
  assert.deepEqual(buildTelegramProjectKeyboard(portfolio, 1), {
    keyboard: [
      ['Business 7', 'Business 8'],
      ['Business 9', 'Business 10'],
      ['Business 11'],
      ['← Earlier projects'],
    ],
    resize_keyboard: true,
    input_field_placeholder: 'Choose a business (2/2)',
  })
  assert.equal(getTelegramProjectPageAction('More projects →', 0, portfolio), 1)
  assert.equal(getTelegramProjectPageAction('← Earlier projects', 1, portfolio), 0)
})

test('recognises picker commands and an exact chosen business', () => {
  assert.equal(isTelegramProjectPickerRequest('/projects'), true)
  assert.equal(isTelegramProjectPickerRequest('/start'), true)
  assert.equal(isTelegramProjectPickerRequest('/help'), false)
  assert.equal(isTelegramStartRequest('/start'), true)
  assert.equal(isTelegramStartRequest('/projects'), false)
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
