import assert from 'node:assert/strict'
import test from 'node:test'
import { isDirectorRunIdempotencyConflict, statusForEvidence } from './director-run'

test('blocks a Director claim when product identity evidence is missing', () => {
  assert.deepEqual(statusForEvidence([{
    capability: 'product_identity', agentType: 'content', model: 'none',
    toolNames: [], evidenceSatisfied: false, result: '',
  }]), { status: 'blocked', claimStatus: 'blocked' })
})

test('limits ordinary evidence gaps but does not call them verified', () => {
  assert.deepEqual(statusForEvidence([{
    capability: 'website_evidence', agentType: 'website', model: 'none',
    toolNames: [], evidenceSatisfied: false, result: '',
  }]), { status: 'partial', claimStatus: 'limited' })
})

test('blocks a Director claim when a required Canva asset was not created', () => {
  assert.deepEqual(statusForEvidence([{
    capability: 'canva_asset', agentType: 'brand', model: 'none',
    toolNames: ['list_brand_templates'], evidenceSatisfied: false, result: '',
  }]), { status: 'blocked', claimStatus: 'blocked' })
})

test('has no verification claim for ordinary conversation', () => {
  assert.deepEqual(statusForEvidence([]), { status: 'completed', claimStatus: 'not_applicable' })
})

test('only a unique-key collision on an idempotent turn is treated as a duplicate run', () => {
  assert.equal(isDirectorRunIdempotencyConflict({ code: '23505' }, 'turn-1'), true)
  assert.equal(isDirectorRunIdempotencyConflict({ code: '23505' }, undefined), false)
  assert.equal(isDirectorRunIdempotencyConflict({ code: 'PGRST204' }, 'turn-1'), false)
})
