import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

test('brand-template reads and writes are fenced to the active NRS brand', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/agents/tools/canva.ts'), 'utf8')
  const registry = readFileSync(resolve(process.cwd(), 'src/lib/agents/tools/index.ts'), 'utf8')

  assert.match(source, /filterCanvaTemplatesForBrand/)
  assert.match(source, /isCanvaTemplateAllowed\(scope\.contract, brand_template_id\)/)
  assert.match(source, /will not create a design from a cross-brand Canva template/i)
  assert.match(source, /template-locked visual identity/i)
  assert.match(registry, /createListBrandKitsTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.match(registry, /createGetBrandTemplateDatasetTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.match(registry, /createGenerateDesignStructuredTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
})
