import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramModelMessages,
  buildTelegramThreadContract,
  isTelegramFollowUp,
  isTelegramMetaRecall,
  parseTelegramJobTurn,
  resolveTelegramWorkMessage,
} from './telegram-thread.ts'

test('detects try-again and meta-recall follow-ups', () => {
  assert.equal(isTelegramFollowUp('try again'), true)
  assert.equal(isTelegramFollowUp('Please retry'), true)
  assert.equal(isTelegramFollowUp('What did i ask you'), true)
  assert.equal(isTelegramMetaRecall('What did i ask you'), true)
  assert.equal(isTelegramFollowUp('Need a caption and hashtags'), false)
})

test('follow-ups resolve to the last concrete owner ask in the thread', () => {
  const prior = [
    'Need a caption and hashtags for this video and why look at Scent Sell',
    'try again',
  ]
  assert.equal(
    resolveTelegramWorkMessage('try again', prior),
    'Need a caption and hashtags for this video and why look at Scent Sell',
  )
  assert.equal(
    resolveTelegramWorkMessage('What did i ask you', prior),
    'Need a caption and hashtags for this video and why look at Scent Sell',
  )
})

test('model messages keep chronological user/assistant pairs then the current ask', () => {
  const messages = buildTelegramModelMessages(
    [
      {
        jobId: '1',
        userMessage: 'Need a caption',
        assistantResponse: 'Paste the product…',
        completedAt: '2026-07-28T06:00:00.000Z',
      },
      {
        jobId: '2',
        userMessage: 'What did i ask you',
        assistantResponse: 'You asked: What did i ask you',
        completedAt: '2026-07-28T06:18:00.000Z',
      },
    ],
    'try again',
  )

  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant', 'user'])
  assert.equal(messages.at(-1)?.content, 'try again')
  assert.equal(messages[0]?.content, 'Need a caption')
})

test('parses completed mcp job rows into thread turns', () => {
  const turn = parseTelegramJobTurn({
    id: 'job-1',
    input: { brand_id: 'b', message: 'Scan the site' },
    result: { response: 'Homepage leads with a trial.', cost_cents: 2 },
    completed_at: '2026-07-28T06:00:00.000Z',
  })
  assert.ok(turn)
  assert.equal(turn!.userMessage, 'Scan the site')
  assert.equal(turn!.assistantResponse, 'Homepage leads with a trial.')
  assert.equal(parseTelegramJobTurn({ id: 'x', input: {}, result: {}, completed_at: null }), null)
})

test('thread contract forces completion of the prior ask on try again', () => {
  const contract = buildTelegramThreadContract(
    'try again',
    'Need a caption and hashtags for this video',
    true,
  )
  assert.match(contract, /TELEGRAM THREAD CONTRACT/)
  assert.match(contract, /Need a caption and hashtags/)
  assert.match(contract, /Do not ask which task to retry/i)
  assert.match(contract, /90-day/i)
})

test('meta recall contract quotes then completes the prior ask', () => {
  const contract = buildTelegramThreadContract(
    'What did i ask you',
    'Need a caption for this video',
    true,
  )
  assert.match(contract, /quote that prior ask/i)
  assert.match(contract, /IMMEDIATELY complete/i)
})
