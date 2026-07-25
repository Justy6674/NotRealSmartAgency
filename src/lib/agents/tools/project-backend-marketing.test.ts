import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isScentSellBackendBrand,
  parseScentSellMarketingResponse,
} from './project-backend-marketing.ts'

test('the Scent Sell backend connector is available only to its exact workspace', () => {
  assert.equal(isScentSellBackendBrand('scent-sell'), true)
  assert.equal(isScentSellBackendBrand('do-today'), false)
})

test('the NRS client accepts only aggregate, proposal-only Scent Sell evidence', () => {
  const result = parseScentSellMarketingResponse({
    project: 'scent-sell',
    contractVersion: '2026-07-25',
    operation: 'get_marketing_snapshot',
    generatedAt: '2026-07-25T01:00:00.000Z',
    dataClassification: 'aggregate_marketing_only',
    access: { readOnly: true, writesPermitted: false },
    freshness: { observedAt: '2026-07-25T01:00:00.000Z', maxAgeSeconds: 300 },
    data: {
      marketplace: { activeListings: 114, pendingReviewListings: 0, newListings7d: 12, activeSwapListings: 7 },
      community: { newProfiles7d: 5, activeCabinetItems: 300, wears30d: 18 },
      product: { catalogueEntries: 1000, swapEnabled: true, boostPayOnSaleEnabled: false },
    },
    customer_email: 'must-not-reach-nrs@example.com',
  })

  assert.deepEqual(result, {
    project: 'scent-sell',
    contractVersion: '2026-07-25',
    operation: 'get_marketing_snapshot',
    generatedAt: '2026-07-25T01:00:00.000Z',
    dataClassification: 'aggregate_marketing_only',
    access: { readOnly: true, writesPermitted: false },
    freshness: { observedAt: '2026-07-25T01:00:00.000Z', maxAgeSeconds: 300 },
    data: {
      marketplace: { activeListings: 114, pendingReviewListings: 0, newListings7d: 12, activeSwapListings: 7 },
      community: { newProfiles7d: 5, activeCabinetItems: 300, wears30d: 18 },
      product: { catalogueEntries: 1000, swapEnabled: true, boostPayOnSaleEnabled: false },
    },
  })
})

test('the client rejects a response that could authorise a backend write', () => {
  assert.throws(() => parseScentSellMarketingResponse({
    project: 'scent-sell',
    contractVersion: '2026-07-25',
    operation: 'get_marketing_snapshot',
    generatedAt: '2026-07-25T01:00:00.000Z',
    dataClassification: 'aggregate_marketing_only',
    access: { readOnly: true, writesPermitted: true },
    freshness: { observedAt: '2026-07-25T01:00:00.000Z', maxAgeSeconds: 300 },
    data: {
      marketplace: { activeListings: 114, pendingReviewListings: 0, newListings7d: 12, activeSwapListings: 7 },
      community: { newProfiles7d: 5, activeCabinetItems: 300, wears30d: 18 },
      product: { catalogueEntries: 1000, swapEnabled: true, boostPayOnSaleEnabled: false },
    },
  }))
})
