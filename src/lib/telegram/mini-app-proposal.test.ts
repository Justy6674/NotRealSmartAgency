import assert from 'node:assert/strict'
import test from 'node:test'
import { extractProposalJson } from './mini-app-proposal.ts'

/**
 * The proposal tool answers with markdown for the Director to read out, and
 * closes with the same proposal as JSON for the next iteration. Reading the
 * LAST block matters: the reply also quotes the previous proposal when it is
 * iterating, and taking the first block would store the copy being replaced.
 */

const reply = [
  '## Proposal from Content & Copy for ScentSell (instagram)',
  '',
  '**Hook:** The bottle nobody believed was real',
  '',
  '*Raw JSON for next iteration:*',
  '```json',
  JSON.stringify({ hook: 'The bottle nobody believed was real', caption: 'Full caption body.', hashtags: ['fragrance', 'scentsell'], post_type: 'reel', rationale: 'Authentication is the brand promise.' }, null, 2),
  '```',
].join('\n')

test('reads the structured proposal out of the tool reply', () => {
  const parsed = extractProposalJson(reply)
  assert.equal(parsed?.caption, 'Full caption body.')
  assert.equal(parsed?.post_type, 'reel')
  assert.deepEqual(parsed?.hashtags, ['fragrance', 'scentsell'])
})

test('takes the final block, so an iteration does not store the copy it replaced', () => {
  const iterating = [
    '### Previous proposal (iterate on this):',
    '```json',
    '{"caption":"The old caption nobody liked."}',
    '```',
    reply,
  ].join('\n')
  assert.equal(extractProposalJson(iterating)?.caption, 'Full caption body.')
})

test('reports no proposal rather than guessing when Content & Copy returns prose', () => {
  assert.equal(extractProposalJson('## Proposal (unstructured fallback)\n\nSome prose, no JSON at all.'), null)
  assert.equal(extractProposalJson('```json\n{not valid json\n```'), null)
})
