import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSystemPrompt, getProjectMemoryNamespaces } from './prompt-builder.ts'
import type { AgentConfig, Brand } from '@/types/database'

const brand: Brand = {
  id: 'underground-id',
  user_id: 'owner-id',
  name: 'Underground Parfums',
  slug: 'underground-parfums',
  tagline: null,
  description: 'An independent perfume house.',
  website_url: 'https://www.undergroundparfums.com',
  github_url: null,
  logo_url: null,
  business_stage: 'launch',
  social_urls: {},
  niche: 'indie_fragrance',
  tone_of_voice: { formality: 'professional', humour: 'none', keywords: [], avoid_words: [] },
  target_audience: { demographics: 'Fragrance collectors', pain_points: [], desires: [] },
  competitors: [],
  compliance_flags: { ahpra: false, tga: false, tga_categories: [] },
  brand_colours: {},
  content_pillars: [],
  extra_context: null,
  products_services: [],
  video_preferences: {},
  github_context: null,
  brand_dna_constraints: {
    founder_voice: {
      perspective: 'small-batch house authorship',
      signature_phrases: ['Memories turned into Perfumes'],
    },
  },
  emulation_wishlist: [],
  channel_strategy: {},
  post_signature: {},
  watermark: {},
  marketing_status: 'unknown',
  marketing_notes: null,
  is_active: true,
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z',
}

const director: AgentConfig = {
  id: 'director-id',
  agent_type: 'overall',
  display_name: 'NRS Director',
  description: 'Marketing director',
  icon: 'sparkles',
  system_prompt: 'Direct the marketing work.',
  available_tools: [],
  is_active: true,
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z',
}

test('builds a prompt when an imported founder voice omits platforms', () => {
  const prompt = buildSystemPrompt(brand, director)

  assert.match(prompt, /Founder voice: small-batch house authorship/)
  assert.doesNotMatch(prompt, /undefined/)
})

test('does not inject a sibling project into an ordinary project prompt', () => {
  const prompt = Reflect.apply(buildSystemPrompt, undefined, [
    brand,
    director,
    null,
    [{
      id: 'scent-sell-id',
      name: 'Scent Sell sentinel',
      slug: 'scent-sell',
      description: 'must never enter an Underground prompt',
    }],
  ]) as string

  assert.doesNotMatch(prompt, /Scent Sell sentinel/)
  assert.doesNotMatch(prompt, /Brand Ecosystem/)
})

test('Director memory search stays inside the active project', () => {
  assert.deepEqual(
    getProjectMemoryNamespaces('downscale', 'overall'),
    ['nrs-downscale-overall', 'nrs-downscale'],
  )
})

test('Telegram prompts ask for clean text rather than raw Markdown', () => {
  const prompt = buildSystemPrompt(brand, director, { deliveryChannel: 'telegram' })

  assert.match(prompt, /Telegram Delivery Format/)
  assert.match(prompt, /Do not use Markdown/)
  assert.doesNotMatch(prompt, /Use markdown formatting for all outputs/)
})

test('Telegram prompts require research-before-deliver instead of invent-then-ask', () => {
  const prompt = buildSystemPrompt(brand, director, { deliveryChannel: 'telegram' })

  assert.match(prompt, /RESEARCH the active project with tools first/i)
  assert.match(prompt, /query_media analysis/i)
  assert.doesNotMatch(prompt, /write the finished copy NOW using brand voice/i)
})

test('Telegram skips goal-discovery when there is no active outcome', () => {
  const prompt = buildSystemPrompt(brand, director, {
    deliveryChannel: 'telegram',
    activeGoal: null,
  })

  assert.doesNotMatch(prompt, /NO ACTIVE END-USER OUTCOME/)
  assert.doesNotMatch(prompt, /What result would make the next 90 days a win/)
})

test('web still discovers an outcome when there is no active goal', () => {
  const prompt = buildSystemPrompt(brand, director, { activeGoal: null })

  assert.match(prompt, /NO ACTIVE END-USER OUTCOME/)
  assert.match(prompt, /What result would make the next 90 days a win/)
})

test('prompts turn source-grounded build opportunities into approval-only developer handoffs', () => {
  const prompt = buildSystemPrompt(brand, director)

  assert.match(prompt, /Proactive Build Opportunities/)
  assert.match(prompt, /source-grounded evidence/)
  assert.match(prompt, /expected marketing impact/i)
  assert.match(prompt, /risk and rollback/i)
  assert.match(prompt, /never make or imply a code, backend, or product change/i)
  assert.match(prompt, /say what evidence is missing instead of inventing/i)
})

test('gives the Director the full Abe bridge for regulated healthcare brands only', () => {
  const regulatedBrand: Brand = {
    ...brand,
    compliance_flags: { ahpra: true, tga: false, tga_categories: [] },
  }

  const regulatedPrompt = buildSystemPrompt(regulatedBrand, director)
  const nonRegulatedPrompt = buildSystemPrompt(brand, director)

  assert.match(regulatedPrompt, /Abe Healthcare Intelligence/)
  assert.match(regulatedPrompt, /use_abe_ai/)
  assert.match(regulatedPrompt, /execute_approved_abe_action/)
  assert.match(regulatedPrompt, /PICO Clinical Evidence/)
  assert.match(regulatedPrompt, /use_pico_search/)
  assert.match(regulatedPrompt, /execute_approved_pico_search/)
  assert.doesNotMatch(nonRegulatedPrompt, /Abe Healthcare Intelligence/)
  assert.doesNotMatch(nonRegulatedPrompt, /PICO Clinical Evidence/)
})

test('every agent is told the brand palette and logo, not just its voice rules', () => {
  // Voice rules always reached the prompt, so copy came out on-brand while
  // designs did not: the palette and logo reached no agent at all, and a logo
  // only appeared if the optional watermark block happened to be enabled.
  // Visual identity has to be a default, not something an agent asks for.
  const branded: Brand = {
    ...brand,
    logo_url: 'https://www.scentsell.com.au/scentsell-logo.png',
    brand_colours: { primary: '#e4a968', accent: '#c28237', background: '#fff9f1' },
    brand_dna_constraints: {
      ...brand.brand_dna_constraints,
      typography: { display: 'Fraunces', body: 'Manrope' },
    },
    watermark: {},
  }

  const prompt = buildSystemPrompt(branded, director)

  assert.match(prompt, /#e4a968/)
  assert.match(prompt, /#c28237/)
  assert.match(prompt, /#fff9f1/)
  assert.match(prompt, /scentsell-logo\.png/)
  assert.match(prompt, /Fraunces/)
  assert.match(prompt, /Manrope/)
})

test('a project with no palette gets no invented one', () => {
  const prompt = buildSystemPrompt(brand, director)

  assert.doesNotMatch(prompt, /Brand colours \(use these exact values\)/)
})
