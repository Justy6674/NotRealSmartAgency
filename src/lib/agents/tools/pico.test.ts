import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PICO_SEARCH_OPERATION_NAMES,
  isPicoSearchWriteOperation,
  toPicoSearchRequest,
} from './pico.ts'

test('exposes the complete PICO evidence-search lifecycle to the Director', () => {
  assert.deepEqual(PICO_SEARCH_OPERATION_NAMES, [
    'search_clinical_evidence',
    'get_clinical_evidence_result',
  ])
  assert.equal(isPicoSearchWriteOperation('search_clinical_evidence'), true)
  assert.equal(isPicoSearchWriteOperation('get_clinical_evidence_result'), false)
})

test('normalises PICO evidence requests to its v1 HTTP contract', () => {
  assert.deepEqual(
    toPicoSearchRequest({
      operation: 'search_clinical_evidence',
      question: 'What evidence exists for obesity stigma in primary care?',
      mode: 'both',
      department_hint: ['primary_care'],
    }),
    {
      question: 'What evidence exists for obesity stigma in primary care?',
      mode: 'both',
      department_hint: ['primary_care'],
      client_name: 'notrealsmart',
    },
  )
})
