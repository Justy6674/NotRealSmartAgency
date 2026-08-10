import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolRunSucceeded, collectWorkerToolEvidence } from './worker-evidence'

/**
 * The evidence contract used to be unsatisfiable by every read tool it names.
 *
 * It counted a tool as having run only if its output was an OBJECT carrying
 * `success`, `updated`, `created` or `requested` — the shape durable-write
 * tools return. `query_media` returns markdown. `verify_product` returns a
 * plain object with no flag. So `product_identity`, whose only backing tool is
 * `verify_product`, could never pass.
 *
 * On 10 August the specialist ran query_media, verify_product and query_media
 * again, all successfully, and the run was still recorded
 * `evidence_satisfied: false`. That verdict reached the Director, which told
 * the owner "the verification check failed" and withheld a fragrance name it
 * had already resolved correctly. He replied: "NO the verificaton did not fail
 * Why say that". He was right.
 */

test('a read tool that returned prose counts as having run', () => {
  assert.equal(toolRunSucceeded('## Your Media Library (1 item)\n\nID: b4fcd9c3…'), true)
  assert.equal(toolRunSucceeded('No media items found. Upload a video…'), true,
    'an empty library is a completed check, not a failed one')
})

test('a flagless data object counts — this is what verify_product returns', () => {
  assert.equal(toolRunSucceeded({ resolved: true, name: 'Kajal Äican' }), true)
  assert.equal(toolRunSucceeded({ matches: [], searched: 'aican' }), true)
})

test('an explicit failure still does not count', () => {
  assert.equal(toolRunSucceeded({ error: 'Could not read the media library just now.' }), false)
  assert.equal(toolRunSucceeded({ success: false }), false)
  assert.equal(toolRunSucceeded({ ok: false }), false)
  assert.equal(toolRunSucceeded(''), false)
  assert.equal(toolRunSucceeded('   '), false)
  assert.equal(toolRunSucceeded(null), false)
  assert.equal(toolRunSucceeded(undefined), false)
  assert.equal(toolRunSucceeded({}), false, 'an empty object carries no evidence')
})

test('the write receipts that already worked keep working', () => {
  assert.equal(toolRunSucceeded({ success: true, output_id: 'abc' }), true)
  assert.equal(toolRunSucceeded({ created: true }), true)
  assert.equal(toolRunSucceeded({ updated: true }), true)
  assert.equal(toolRunSucceeded({ requested: true }), true)
})

test("the 10 August run is now recorded as the successful check it was", () => {
  // The exact tool sequence from job 07:39:43, with the shapes those tools
  // really return.
  const steps = [
    {
      toolCalls: [{ toolName: 'query_media' }, { toolName: 'verify_product' }],
      toolResults: [
        {
          type: 'tool-result',
          toolName: 'query_media',
          output: '## Your Media Library (1 item)\n\nID: b4fcd9c3-5a09-4d97-8e05-031308edc880\n10-08-2026_10-23-35_A.mov',
        },
        {
          type: 'tool-result',
          toolName: 'verify_product',
          output: { resolved: true, canonical_name: 'Kajal Äican' },
        },
      ],
    },
  ]

  const evidence = collectWorkerToolEvidence(steps)

  assert.deepEqual(evidence.toolNames, ['query_media', 'verify_product'])
  assert.ok(
    evidence.successfulToolNames.includes('query_media'),
    'query_media returned the library and must count as a real check',
  )
  assert.ok(
    evidence.successfulToolNames.includes('verify_product'),
    'verify_product resolved the fragrance and must count — product_identity depended on it',
  )
})

test('a failed library read does not become evidence that the library was checked', () => {
  const steps = [{
    toolCalls: [{ toolName: 'query_media' }],
    toolResults: [{
      type: 'tool-result',
      toolName: 'query_media',
      output: { error: 'Could not read the media library just now. Try again in a moment.' },
    }],
  }]

  const evidence = collectWorkerToolEvidence(steps)
  assert.deepEqual(evidence.toolNames, ['query_media'])
  assert.deepEqual(evidence.successfulToolNames, [],
    'a tool that reported an error must never satisfy an evidence requirement')
})
