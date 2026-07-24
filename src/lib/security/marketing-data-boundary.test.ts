import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectMarketingInput } from './marketing-data-boundary.ts'

test('allows a normal marketing request', () => {
  assert.deepEqual(
    inspectMarketingInput('Draft a winter Instagram post about our appointment process.'),
    { allowed: true },
  )
})

test('blocks patient-identifying clinical information', () => {
  const result = inspectMarketingInput(
    'Patient Jane Smith, DOB 1 January 1980, is taking semaglutide.',
  )

  assert.equal(result.allowed, false)
})

test('blocks customer contact details before they enter marketing work', () => {
  const result = inspectMarketingInput('Please email alex@example.com about their order.')

  assert.equal(result.allowed, false)
})

test('blocks an exposed Telegram bot token', () => {
  const result = inspectMarketingInput('Use 123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi for Telegram.')

  assert.equal(result.allowed, false)
})
