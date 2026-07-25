import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTelegramMarketingCopy } from './telegram-marketing-copy.ts'

test('renders marketing responses as clean Telegram text rather than raw Markdown', () => {
  const formatted = formatTelegramMarketingCopy(`## What is strong

**Messaging:** [Do Today](https://www.dotoday.com.au) has a clear promise.

- Keep the \`five free messages\` offer.

> Do not add a generic conclusion.`)

  assert.equal(formatted, `What is strong

Messaging: Do Today (https://www.dotoday.com.au) has a clear promise.

• Keep the five free messages offer.

Do not add a generic conclusion.`)
  assert.doesNotMatch(formatted, /(?:##|\*\*|`|\[Do Today\]\()/)
})

test('keeps numbered recommendations readable in Telegram', () => {
  const formatted = formatTelegramMarketingCopy('1. **First:** Fix the hero.\n2. **Second:** Test the CTA.')

  assert.equal(formatted, '1. First: Fix the hero.\n2. Second: Test the CTA.')
})
