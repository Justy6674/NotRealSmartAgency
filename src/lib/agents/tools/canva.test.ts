import assert from 'node:assert/strict'
import test from 'node:test'
import {
  completedCanvaDesignFromJob,
  normaliseCanvaAutofillData,
  validateCanvaAutofillData,
} from './canva'

test('formats simple text values as Canva Autofill text fields', () => {
  assert.deepEqual(normaliseCanvaAutofillData({
    HEADLINE: 'Price it for today',
    BODY: 'Use fill level, condition and current sales.',
  }), {
    HEADLINE: { type: 'text', text: 'Price it for today' },
    BODY: { type: 'text', text: 'Use fill level, condition and current sales.' },
  })
})

test('extracts a completed Canva design receipt from the documented job response', () => {
  assert.deepEqual(completedCanvaDesignFromJob({
    id: 'job-1',
    status: 'success',
    result: {
      design: {
        url: 'https://www.canva.com/design/DESIGN123/edit',
      },
    },
  }), {
    jobId: 'job-1',
    designId: 'DESIGN123',
    editUrl: 'https://www.canva.com/design/DESIGN123/edit',
  })
})

test('does not manufacture a design receipt while an Autofill job is still running', () => {
  assert.equal(completedCanvaDesignFromJob({ id: 'job-1', status: 'in_progress' }), null)
})

test('refuses an Autofill request when the template has no configured fields', () => {
  assert.match(
    validateCanvaAutofillData({ HEADLINE: 'Price it for today' }, {}),
    /no published Autofill fields/i,
  )
})

test('refuses an Autofill request that invents a field not in the Canva template', () => {
  assert.match(
    validateCanvaAutofillData({ HEADLINE: 'Price it for today' }, { BODY: { type: 'text' } }),
    /not a field/i,
  )
})
