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

test('repairs paste-the-product intake forms on caption asks', () => {
  const form = `Got it.

Paste the product, angle, and platform, and I’ll write the caption only.

If you want, use this format:
• Product:
• Platform:
• Angle:

Also, one quick thing so I don’t miss the mark:
What result matters most here — sales, engagement, or brand awareness?`

  assert.equal(needsTelegramResponseRepair('Need a caption and hashtags for this video', form), true)
})

test('repairs 90-day goal discovery spam on follow-ups', () => {
  const spam = `You asked: "What did i ask you"

Standing instructions for Scent Sell still apply.

Also, before we turn this into ongoing work, what result would make the next 90 days a win for Scent Sell?`

  assert.equal(needsTelegramResponseRepair('What did i ask you', spam), true)
})

test('repairs try-again retry menus', () => {
  const menu = `What exactly do you want me to retry?
• the media review
• the caption
• the publish step
• or the fragrance carousel copy.`

  assert.equal(needsTelegramResponseRepair('try again', menu), true)
})
