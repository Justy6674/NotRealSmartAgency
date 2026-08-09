import assert from 'node:assert/strict'
import test from 'node:test'
import { collectWorkerToolEvidence } from './worker-evidence'

test('collects every tool step and counts only completed Canva design receipts', () => {
  const evidence = collectWorkerToolEvidence([
    {
      toolCalls: [{ toolName: 'list_brand_templates' }],
      toolResults: [{
        type: 'tool-result',
        toolName: 'list_brand_templates',
        output: { success: true, templates: [{ id: 'template-1' }] },
      }],
    },
    {
      toolCalls: [{ toolName: 'generate_design_structured' }],
      toolResults: [{
        type: 'tool-result',
        toolName: 'generate_design_structured',
        output: { success: true, design_id: 'design-1', edit_url: 'https://www.canva.com/design/design-1/edit' },
      }],
    },
    {
      toolCalls: [{ toolName: 'generate_design_structured' }],
      toolResults: [{
        type: 'tool-result',
        toolName: 'generate_design_structured',
        output: { success: true, design_id: 'design-2', edit_url: 'https://www.canva.com/design/design-2/edit' },
      }],
    },
    {
      toolCalls: [{ toolName: 'generate_design_structured' }],
      toolResults: [{
        type: 'tool-result',
        toolName: 'generate_design_structured',
        output: { success: true, job: { status: 'running' } },
      }],
    },
  ])

  assert.deepEqual(evidence.toolNames, [
    'list_brand_templates',
    'generate_design_structured',
    'generate_design_structured',
    'generate_design_structured',
  ])
  assert.deepEqual(evidence.successfulToolNames, [
    'list_brand_templates',
    'generate_design_structured',
    'generate_design_structured',
    'generate_design_structured',
  ])
  assert.equal(evidence.completedCanvaDesigns.length, 2)
})
