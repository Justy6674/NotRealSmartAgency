import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDirectorSourcePolicy } from './source-policy'
import { planDirectorTask } from './task-capability-plan'

test('keeps the ScentSell catalogue and a regulated corpus in their proper scopes', () => {
  const plan = planDirectorTask('Write a caption for a fragrance product and check TGA compliance.', {
    brandSlug: 'scent-sell', regulated: true,
  })
  const policy = buildDirectorSourcePolicy({
    id: 'brand', slug: 'scent-sell', compliance_flags: { ahpra: false, tga: true, tga_categories: [] },
  }, plan)

  assert.deepEqual(policy.requiredSources.product_identity, ['product_catalogue'])
  assert.deepEqual(policy.requiredSources.compliance_review, ['regulatory_corpus'])
  assert.equal(policy.allowsRegulatoryCorpus, true)
})

test('does not expose the regulated corpus to an unregulated brand', () => {
  const policy = buildDirectorSourcePolicy({
    id: 'brand', slug: 'scent-sell', compliance_flags: { ahpra: false, tga: false, tga_categories: [] },
  }, planDirectorTask('Write a caption for a fragrance product.', { brandSlug: 'scent-sell' }))
  assert.equal(policy.allowsRegulatoryCorpus, false)
})
