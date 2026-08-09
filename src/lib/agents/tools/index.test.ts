import assert from 'node:assert/strict'
import test from 'node:test'
import { getToolsForAgent } from './index'

const baseContext = {
  supabase: {} as never,
  userId: 'user-1',
  brandId: 'brand-1',
  conversationId: null,
}

test('template-locked brands cannot reach generic visual generators or unverified Canva edit routes', () => {
  const tools = getToolsForAgent('overall', {
    ...baseContext,
    brand: {
      slug: 'scent-sell',
      compliance_flags: {},
      brand_dna_constraints: {
        canva_template_contract: {
          owner: 'ScentSell',
          require_template_for_social_visuals: true,
          templates: [{ id: 'cover', title: 'ScentSell cover' }],
        },
      },
    } as never,
  })

  assert.ok('create_canva_template_copy' in tools)
  assert.equal('generate_image' in tools, false)
  assert.equal('blotato_create_visual' in tools, false)
  assert.equal('start_editing_transaction' in tools, false)
  assert.equal('perform_editing_operations' in tools, false)
  assert.equal('commit_editing_transaction' in tools, false)
  assert.equal('cancel_editing_transaction' in tools, false)
})

test('ordinary brands retain the ordinary image-generation capability', () => {
  const tools = getToolsForAgent('overall', {
    ...baseContext,
    brand: {
      slug: 'ordinary-brand',
      compliance_flags: {},
      brand_dna_constraints: {},
    } as never,
  })

  assert.ok('generate_image' in tools)
  assert.ok('blotato_create_visual' in tools)
})
