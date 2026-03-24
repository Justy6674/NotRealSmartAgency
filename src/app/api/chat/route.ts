import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { memoryStore } from '@/lib/ruflo/client'
import { getNamespace } from '@/lib/ruflo/namespaces'
import { ensureAgent } from '@/lib/ruflo/ensure-agent'
import { getToolsForAgent } from '@/lib/agents/tools'
import type { AgentType, Brand, AgentConfig } from '@/types/database'

const VALID_AGENT_TYPES: AgentType[] = [
  'overall', 'content', 'seo', 'paid_ads', 'strategy', 'email',
  'growth', 'brand', 'competitor', 'website', 'compliance',
  'analytics', 'automation',
  // Archived but still valid for loading old conversations
  'martech',
]

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  brandId: z.string().uuid(),
  agentType: z.enum(VALID_AGENT_TYPES as [AgentType, ...AgentType[]]),
  conversationId: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorised', { status: 401 })
  }

  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages: rawMessages, brandId, agentType, conversationId } = parsed.data
  const messages = rawMessages as unknown as UIMessage[]

  // Fetch brand (RLS ensures ownership)
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch agent config
  const { data: agentConfig, error: agentError } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('agent_type', agentType)
    .single()

  if (agentError || !agentConfig) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Ensure agent is registered
  await ensureAgent(agentType)

  // Get latest user message for memory search
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  const lastMessageText = lastUserMessage
    ? (lastUserMessage as UIMessage).parts
        ?.filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text ?? '')
        .join(' ')
      ?? ''
    : ''

  // Build system prompt with memory context
  const { prompt: systemPrompt, memoryCount } = await buildSystemPromptWithMemory(
    brand as Brand,
    agentConfig as AgentConfig,
    lastMessageText
  )

  // Get tools for this agent
  const tools = getToolsForAgent(agentType, {
    supabase,
    userId: user.id,
    brandId,
    conversationId: conversationId ?? null,
  })

  const typedBrand = brand as Brand

  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage.inputTokens ?? 0
      const outputTokens = usage.outputTokens ?? 0

      // Log token usage
      await supabase.from('ai_usage').insert({
        user_id: user.id,
        query_type: `agency_${agentType}`,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        model: 'anthropic/claude-sonnet-4',
        cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
        metadata: { memoryCount },
      })

      // Store conversation summary to memory (non-blocking)
      if (text && text.length > 20) {
        const namespace = getNamespace(typedBrand.slug, agentType)
        memoryStore(
          `conv-${conversationId ?? 'new'}-${Date.now()}`,
          {
            agent: agentType,
            brand: typedBrand.slug,
            userQuery: lastMessageText.slice(0, 200),
            summary: text.slice(0, 500),
            timestamp: new Date().toISOString(),
          },
          namespace,
          [agentType, typedBrand.slug, 'conversation']
        ).catch((err) => console.error('[chat] Memory store failed:', err))
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
