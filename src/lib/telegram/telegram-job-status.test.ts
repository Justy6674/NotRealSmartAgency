import assert from 'node:assert/strict'
import test from 'node:test'
import { getTelegramJobAcknowledgement } from './telegram-job-status.ts'

test('describes a website scan as the concrete action rather than a generic marketing draft', () => {
  assert.equal(
    getTelegramJobAcknowledgement('Do Today', 'Scan the site'),
    'Scanning Do Today’s live website now. I’ll return the evidence and the one next marketing action here.',
  )
})
