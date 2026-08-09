import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterCanvaTemplatesForBrand,
  isCanvaTemplateAllowed,
  readCanvaTemplateContract,
} from './template-contract'

test('reads only an explicit, de-duplicated Canva template allowlist', () => {
  const contract = readCanvaTemplateContract({
    canva_template_contract: {
      owner: 'ScentSell',
      require_template_for_social_visuals: true,
      templates: [
        { id: 'cover', title: 'Cover', role: 'cover' },
        { id: 'cover', title: 'Duplicate cover' },
        { id: 'body', title: 'Body' },
      ],
    },
  })

  assert.deepEqual(contract, {
    owner: 'ScentSell',
    requireTemplateForSocialVisuals: true,
    templates: [
      { id: 'cover', title: 'Cover', role: 'cover' },
      { id: 'body', title: 'Body' },
    ],
  })
})

test('fails closed and removes account-wide Canva templates without a brand contract', () => {
  assert.equal(readCanvaTemplateContract({}), null)
  assert.equal(isCanvaTemplateAllowed(null, 'downscale-template'), false)
  assert.deepEqual(
    filterCanvaTemplatesForBrand(
      [{ id: 'scent-sell-template' }, { id: 'downscale-template' }],
      null,
    ),
    [],
  )
})

test('filters provider templates by the active brand allowlist, not their names', () => {
  const contract = readCanvaTemplateContract({
    canva_template_contract: {
      owner: 'ScentSell',
      templates: [{ id: 'scent-sell-template', title: 'Got a bottle collecting dust?' }],
    },
  })

  assert.deepEqual(
    filterCanvaTemplatesForBrand(
      [
        { id: 'scent-sell-template', title: 'Heading' },
        { id: 'downscale-template', title: 'ScentSell social post' },
      ],
      contract,
    ),
    [{ id: 'scent-sell-template', title: 'Heading' }],
  )
})
