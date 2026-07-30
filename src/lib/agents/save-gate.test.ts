import assert from 'node:assert/strict'
import test from 'node:test'
import { complianceGateForSave } from './save-gate.ts'
import type { GuardianResult } from './compliance-filter.ts'

function review(over: Partial<GuardianResult> = {}): GuardianResult {
  return {
    isValid: true,
    checkCompleted: true,
    flags: [],
    warnings: [],
    brandVoiceIssues: [],
    regulatoryCitations: [],
    regulatoryCorpusVersion: null,
    ...over,
  }
}

test('a clean completed review may be saved', () => {
  assert.equal(complianceGateForSave(review()).allowed, true)
})

test('content that failed the review never enters the library', () => {
  // query_outputs hands the library to every department as an example of past
  // work. Saving a failed piece means it comes back later as a model to copy.
  const gate = complianceGateForSave(
    review({ isValid: false, flags: ['Uses a prohibited testimonial'] }),
  )
  assert.equal(gate.allowed, false)
  assert.match(gate.reason!, /prohibited testimonial/)
})

test('a review that did not finish is a block, not a pass', () => {
  const gate = complianceGateForSave(review({ checkCompleted: false }))
  assert.equal(gate.allowed, false)
  assert.match(gate.reason!, /did not finish/i)
})

test('no review at all is a block', () => {
  const gate = complianceGateForSave(null)
  assert.equal(gate.allowed, false)
})

test('a definite finding is named ahead of an incomplete review', () => {
  // Both block. Saying "the review did not finish" would hide a banned word
  // the caller could have fixed in one edit.
  const gate = complianceGateForSave(
    review({ isValid: false, checkCompleted: false, brandVoiceIssues: ['Contains banned word: "cure"'] }),
  )
  assert.match(gate.reason!, /banned word/)
})

test('the block explains itself without naming plumbing', () => {
  const gate = complianceGateForSave(review({ checkCompleted: false }))
  const shown = gate.reason!.toLowerCase()
  for (const word of ['llm', 'model', 'timeout', 'api', 'schema', 'null', 'undefined']) {
    assert.ok(!shown.includes(word), `block message leaks "${word}"`)
  }
})
