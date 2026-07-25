import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getGatewayFallbackModels,
  getGatewayModel,
  getGatewayProviderOptions,
  resolveAgentModelRoute,
} from './model-routing.ts'

test('uses Sonnet 5 with cross-provider fallbacks for ordinary agency work', () => {
  const route = resolveAgentModelRoute({
    agentType: 'overall',
    input: 'Create a launch plan for our spring campaign.',
    registeredModel: 'anthropic/claude-sonnet-4',
  })

  assert.deepEqual(route, {
    tier: 'agency',
    model: 'anthropic/claude-sonnet-5',
    fallbacks: ['openai/gpt-5.4', 'google/gemini-3-flash'],
  })
})

test('escalates only high-stakes healthcare governance work to Opus 5', () => {
  const route = resolveAgentModelRoute({
    agentType: 'overall',
    isHealthBrand: true,
    input: 'Review the AHPRA advertising risk and accreditation implications before we publish.',
  })

  assert.equal(route.tier, 'frontier')
  assert.equal(route.model, 'anthropic/claude-opus-5')
  assert.deepEqual(route.fallbacks, ['anthropic/claude-sonnet-5', 'openai/gpt-5.4'])
})

test('routes repository and code work to GPT-5.3 Codex rather than marketing chat', () => {
  const route = resolveAgentModelRoute({
    agentType: 'automation',
    input: 'Inspect the connected GitHub repository for the authentication bug and produce a developer handoff.',
  })

  assert.equal(route.tier, 'code')
  assert.equal(route.model, 'openai/gpt-5.3-codex')
  assert.deepEqual(route.fallbacks, ['anthropic/claude-sonnet-5', 'openai/gpt-5.4'])
})

test('does not mistake ordinary marketing implementation for code work', () => {
  const route = resolveAgentModelRoute({
    agentType: 'strategy',
    input: 'Create an implementation plan for our spring campaign.',
  })

  assert.equal(route.tier, 'agency')
  assert.equal(route.model, 'anthropic/claude-sonnet-5')
})

test('keeps a deliberate non-legacy registry model and centralises direct tiers', () => {
  const route = resolveAgentModelRoute({
    agentType: 'analytics',
    input: 'Summarise this report.',
    registeredModel: 'google/gemini-3-flash',
  })

  assert.equal(route.tier, 'custom')
  assert.equal(route.model, 'google/gemini-3-flash')
  assert.deepEqual(route.fallbacks, ['anthropic/claude-sonnet-5', 'openai/gpt-5.4'])
  assert.equal(getGatewayModel('fast'), 'anthropic/claude-haiku-4.5')
  assert.deepEqual(getGatewayFallbackModels('fast'), ['google/gemini-3-flash', 'openai/gpt-5.4-nano'])
  assert.deepEqual(getGatewayProviderOptions('fast'), {
    gateway: { models: ['google/gemini-3-flash', 'openai/gpt-5.4-nano'] },
  })
})
