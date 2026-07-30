import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSystemPrompt } from './prompt-builder.ts'
import type { AgentConfig, Brand } from '@/types/database'

const brand = {
  id: 'b1', name: 'Scent Sell', slug: 'scent-sell',
  tone_of_voice: {}, target_audience: {}, competitors: [], compliance_flags: {},
  brand_colours: {}, content_pillars: [], products_services: [], video_preferences: {},
  brand_dna_constraints: {}, emulation_wishlist: [], channel_strategy: {},
  post_signature: {}, watermark: {}, social_urls: {},
} as unknown as Brand

const config = { agent_type: 'content', system_prompt: 'You write copy.' } as unknown as AgentConfig

test('agents are told a remembered name is not permission to publish it', () => {
  // A draft came back reading "Here's how it works, Justin and Bec style" —
  // the agent pulled the owner's and his wife's names out of memory and put
  // them in public marketing copy. Nobody chose that.
  const prompt = buildSystemPrompt(brand, config)
  assert.match(prompt, /memory is not permission/i)
  assert.match(prompt, /NEVER put a real person's name into published copy/i)
})
