import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ABEAI_OPERATION_NAMES,
  isAbeAiWriteOperation,
  toAbeAiRequest,
} from './abeai.ts'

test('maps every shipped Abe capability into the NRS Director gateway', () => {
  assert.deepEqual(ABEAI_OPERATION_NAMES, [
    'ask_oracle',
    'query_np_endorsement_corpus',
    'search_regulatory_corpus',
    'run_triage',
    'run_assessment',
    'generate_governance_documents',
    'scan_website',
    'scan_socials',
    'scan_seo_competitive',
    'scan_site_deep',
    'run_privacy_data_review',
    'run_accreditation',
    'run_solve',
    'list_tasks',
    'list_memory',
  ])
})

test('maps Abe accreditation and full Solve orchestration to their native endpoints', () => {
  assert.deepEqual(
    toAbeAiRequest({ operation: 'run_accreditation', standard_set: 'nsqhs_2nd_ed' }),
    { path: '/api/agents/accreditation', method: 'POST', body: { standard_set: 'nsqhs_2nd_ed' } },
  )
  assert.deepEqual(
    toAbeAiRequest({
      operation: 'run_solve',
      prompt: 'Assess our public AI policy against the relevant standard.',
      context: { standard_set: 'nsqhs_2nd_ed' },
    }),
    {
      path: '/api/solve',
      method: 'POST',
      body: {
        prompt: 'Assess our public AI policy against the relevant standard.',
        context: { standard_set: 'nsqhs_2nd_ed' },
      },
    },
  )
})

test('maps corpus and Oracle knowledge calls to Abe without widening the endpoint', () => {
  assert.deepEqual(
    toAbeAiRequest({ operation: 'ask_oracle', question: 'What applies?' }),
    { path: '/api/agents/oracle', method: 'POST', body: { question: 'What applies?' } },
  )
  assert.deepEqual(
    toAbeAiRequest({
      operation: 'search_regulatory_corpus',
      question: 'AHPRA advertising',
      scope: 'all_healthcare',
      roles: ['all'],
      jurisdictions: ['qld'],
      source_categories: ['ahpra'],
      org_types: ['telehealth'],
      limit: 12,
    }),
    {
      path: '/api/corpus/search',
      method: 'POST',
      body: {
        question: 'AHPRA advertising',
        scope: 'all_healthcare',
        roles: ['all'],
        jurisdictions: ['qld'],
        source_categories: ['ahpra'],
        org_types: ['telehealth'],
        limit: 12,
      },
    },
  )
})

test('marks every Abe workflow that changes Abe organisation state for approval', () => {
  for (const operation of [
    'ask_oracle',
    'run_triage',
    'run_assessment',
    'generate_governance_documents',
    'scan_website',
    'scan_socials',
    'scan_seo_competitive',
    'scan_site_deep',
    'run_privacy_data_review',
    'run_accreditation',
    'run_solve',
  ] as const) {
    assert.equal(isAbeAiWriteOperation(operation), true, operation)
  }

  for (const operation of [
    'query_np_endorsement_corpus',
    'search_regulatory_corpus',
    'list_tasks',
    'list_memory',
  ] as const) {
    assert.equal(isAbeAiWriteOperation(operation), false, operation)
  }
})
