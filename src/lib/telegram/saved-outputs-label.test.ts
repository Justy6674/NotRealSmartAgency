import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { savedOutputsFromJobResult } from './timeline-sources'

/**
 * The social-copy card told the owner his copy had not been saved, in the same
 * message that told him it had.
 *
 * Job 07:51:29 on 10 August logged actions
 *   ["save_output (Instagram)", "save_output (YouTube)"]
 * and the Director closed with "Both descriptions are saved." Above it, the
 * card printed "Prepared in this chat · not saved in NRS or Mixpost" — a fixed
 * string on every card that looked like social copy. The bubble was handed
 * text and nothing else, so it never had grounds for either claim.
 */

const VIEW = resolve(process.cwd(), 'src/app/telegram/timeline-view.tsx')

test('the two saves from the real job are read back and named', () => {
  const labels = savedOutputsFromJobResult({
    actions: ['save_output (Instagram)', 'save_output (YouTube)'],
  })

  assert.deepEqual(labels, ['Instagram', 'YouTube'])
})

test('a turn that saved nothing reports nothing', () => {
  assert.deepEqual(savedOutputsFromJobResult({ actions: [] }), [])
  assert.deepEqual(savedOutputsFromJobResult({}), [])
  assert.deepEqual(savedOutputsFromJobResult(null), [])
})

test('only saving counts — publishing and scheduling are other claims', () => {
  const labels = savedOutputsFromJobResult({
    actions: [
      'publish_to_social (Instagram)',
      'caption_video (b4fcd9c3-5a09-4d97-8e05-031308edc880)',
      'save_output (YouTube)',
      'manage_posts (schedule)',
    ],
  })

  assert.deepEqual(labels, ['YouTube'], 'a publish must never be reported as a save, or the reverse')
})

test('the same platform saved twice is named once', () => {
  assert.deepEqual(
    savedOutputsFromJobResult({ actions: ['save_output (Instagram)', 'save_output (Instagram)'] }),
    ['Instagram'],
  )
})

test('malformed action entries cannot crash the card', () => {
  assert.deepEqual(
    savedOutputsFromJobResult({ actions: [null, 42, 'save_output', 'save_output ()', { a: 1 }] as unknown[] }),
    [],
  )
})

test('the card no longer hard-codes a persistence claim', () => {
  const source = readFileSync(VIEW, 'utf8')

  // The string may still exist as the empty-state branch, but it must not be
  // rendered directly into the card any more.
  assert.doesNotMatch(
    source,
    /<p[^>]*>\s*Prepared in this chat · not saved in NRS or Mixpost\s*<\/p>/,
    'the label must be derived from what the job did, never printed unconditionally',
  )
  assert.match(
    source,
    /persistenceLabel\(savedOutputs\)/,
    'the card should render the derived label',
  )
})
