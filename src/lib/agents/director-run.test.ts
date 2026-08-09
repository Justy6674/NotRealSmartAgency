import assert from 'node:assert/strict'
import test from 'node:test'
import { statusForEvidence } from './director-run'

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
