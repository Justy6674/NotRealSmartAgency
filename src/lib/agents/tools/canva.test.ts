import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  buildCanvaBrandTemplateCopyRequest,
  canvaTemplateCopyReceipt,
  completedCanvaDesignFromJob,
  normaliseCanvaAutofillData,
  validateCanvaAutofillData,
} from './canva'

test('uses Canva’s documented Brand Template copy payload and only accepts an editable receipt', () => {
  assert.deepEqual(buildCanvaBrandTemplateCopyRequest('template-1'), {
    type: 'brand_template',
    brand_template_id: 'template-1',
  })
  assert.deepEqual(buildCanvaBrandTemplateCopyRequest('template-1', [1, 3]), {
    type: 'brand_template',
    brand_template_id: 'template-1',
    page_numbers: [1, 3],
  })
  assert.deepEqual(canvaTemplateCopyReceipt({
    design: {
      id: 'design-1',
      page_count: 3,
      thumbnail: { url: 'https://canva.example/thumb.png' },
      urls: { edit_url: 'https://canva.example/edit', view_url: 'https://canva.example/view' },
    },
  }), {
    designId: 'design-1',
    editUrl: 'https://canva.example/edit',
    viewUrl: 'https://canva.example/view',
    thumbnailUrl: 'https://canva.example/thumb.png',
    pageCount: 3,
  })
  assert.equal(canvaTemplateCopyReceipt({ design: { id: 'design-1' } }), null)
})

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
  // `null` is the "this is fine" answer, so asserting it is a string first is
  // part of the test, not a cast to get past the compiler.
  const refusal = validateCanvaAutofillData({ HEADLINE: 'Price it for today' }, {})
  assert.ok(refusal, 'expected a refusal, got a pass')
  assert.match(refusal, /no published Autofill fields/i)
})

test('refuses an Autofill request that invents a field not in the Canva template', () => {
  const refusal = validateCanvaAutofillData(
    { HEADLINE: 'Price it for today' },
    { BODY: { type: 'text' } },
  )
  assert.ok(refusal, 'expected a refusal, got a pass')
  assert.match(refusal, /not a field/i)
})

test('brand-template reads and writes are fenced to the active NRS brand', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/agents/tools/canva.ts'), 'utf8')
  const registry = readFileSync(resolve(process.cwd(), 'src/lib/agents/tools/index.ts'), 'utf8')

  assert.match(source, /filterCanvaTemplatesForBrand/)
  assert.match(source, /isCanvaTemplateAllowed\(scope\.contract, brand_template_id\)/)
  assert.match(source, /will not create a design from a cross-brand Canva template/i)
  assert.match(source, /template-locked visual identity/i)
  assert.match(source, /type: 'brand_template'/)
  assert.match(source, /template copy, not a finished social post/i)
  assert.doesNotMatch(source, /editing\/transactions/)
  assert.match(registry, /createListBrandKitsTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.match(registry, /createCanvaTemplateCopyTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.match(registry, /createGetBrandTemplateDatasetTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.match(registry, /createGenerateDesignStructuredTool\(ctx\.supabase, ctx\.userId, ctx\.brandId\)/)
  assert.doesNotMatch(registry, /start_editing_transaction:/)
  assert.doesNotMatch(registry, /perform_editing_operations:/)
  assert.doesNotMatch(registry, /commit_editing_transaction:/)
  assert.doesNotMatch(registry, /cancel_editing_transaction:/)
  assert.match(registry, /templateLockedVisuals/)
  assert.match(registry, /visualGenerationTools/)
})
