import assert from 'node:assert/strict'
import test from 'node:test'
import { createTelegramCommandReply } from './telegram-command.ts'

test('explains how to start without running a Director job', () => {
  assert.equal(
    createTelegramCommandReply('/start', ['DoToday']),
    'I’m NRS, your marketing Director. Tell me what you want to grow and name the brand — for example: “For DoToday, make a week of launch posts.”',
  )
})

test('lists the owner brands when asked', () => {
  assert.equal(
    createTelegramCommandReply('/brands', ['DoToday', 'TeleScribe']),
    'Your brands: DoToday, TeleScribe.',
  )
})

test('leaves marketing requests for the Director', () => {
  assert.equal(createTelegramCommandReply('For DoToday, draft three launch posts', ['DoToday']), null)
})
