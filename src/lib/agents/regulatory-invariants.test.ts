import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Some regulatory guarantees are decisions about wiring, not behaviour a unit
 * test can exercise: which transport the review uses, and whether every exit
 * to a live account passes the shared gate. Those are the ones most easily
 * undone by a later change that looks harmless, so they are asserted against
 * the source itself.
 */

const root = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

test('the regulatory review runs on the same transport as every other call', () => {
  // It reached a provider directly while everything else went through the
  // Gateway, which made it the one call with no fallback when a provider was
  // down — and, for a regulated project, an outage stops publishing entirely.
  const source = read('lib/agents/compliance-filter.ts')

  assert.ok(source.includes('gateway('), 'the review must go through the Gateway')
  assert.ok(
    !/from '@ai-sdk\/(anthropic|openai|google)'/.test(source),
    'the review must not reach a provider directly — it loses the fallback chain',
  )
})

test('regulated content keeps its retention and training controls', () => {
  const source = read('lib/agents/compliance-filter.ts')
  assert.ok(
    source.includes('zeroDataRetention'),
    'a health call must not be sent without zero-retention routing',
  )
  assert.ok(
    source.includes('getGatewayRouteProviderOptions'),
    'the shared Gateway policy carries the no-training setting',
  )
})

test('the cost of reviewing regulated content is attributed', () => {
  const source = read('lib/agents/compliance-filter.ts')
  assert.ok(source.includes('estimateGatewayCost'), 'the review must report what it cost')
  assert.ok(source.includes('result.spend'), 'the cost must reach the caller')
})

test('every route to a live account passes the shared publishing gate', () => {
  // A new publisher that forgets the gate is the failure this catches. Both
  // named files reach real accounts.
  for (const file of ['app/api/cron/publish-posts/route.ts', 'lib/publishers/dispatcher.ts']) {
    assert.ok(
      read(file).includes('checkPublishAllowed'),
      `${file} publishes without the shared gate`,
    )
  }
})

test('the outputs library is gated for regulated projects', () => {
  const source = read('lib/agents/tools/save-output.ts')
  assert.ok(
    source.includes('complianceGateForSave'),
    'failed content saved to the library returns later as an example to copy',
  )
})

test('creating a project settles its regulatory flags', () => {
  const source = read('app/api/brands/route.ts')
  assert.ok(
    source.includes('applyHealthFlags'),
    'a health project created without flags publishes unreviewed, silently',
  )
})

test('the publishing tool blocks on a review that did not complete', () => {
  const source = read('lib/agents/tools/publish-to-social.ts')
  assert.ok(source.includes('checkCompleted'), 'an absent review must not read as a pass')
})
