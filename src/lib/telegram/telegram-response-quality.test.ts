import assert from 'node:assert/strict'
import test from 'node:test'
import { needsTelegramResponseRepair } from './telegram-response-quality.ts'

test('repairs a generic service menu for an explicit Telegram task', () => {
  const genericReply = `I can help with:
• Marketing strategy
• Social content

What is the most pressing marketing need right now?`

  assert.equal(needsTelegramResponseRepair('Scan the site', genericReply), true)
})

test('keeps a completed result for an explicit Telegram task', () => {
  const completedReply = `What I found
The homepage leads with a five-message trial.

Recommended next action
Test that trial in the first paid-social campaign.`

  assert.equal(needsTelegramResponseRepair('Scan the site', completedReply), false)
})

test('repairs an explicit task that is handed back as a final question', () => {
  const handBack = `The raw scan was thin, so I need a deeper browse first.

One question first: what result matters most from this review — signups, messaging, or SEO?`

  assert.equal(needsTelegramResponseRepair('Scan the site', handBack), true)
})
