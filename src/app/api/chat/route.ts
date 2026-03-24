import { ToolLoopAgent, stepCountIs, convertToModelMessages, type UIMessage } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from '@/lib/agents/tools'
import { createDelegateTool } from '@/lib/agents/tools/delegate'
import { memoryStore } from '@/lib/ruflo/client'
import { getNamespace } from '@/lib/ruflo/namespaces'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
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

  // Get/create agent registry entry (org chart + budget)
  const registry = await getOrCreateAgentRegistry(supabase, user.id, agentType)

  // Check budget before starting
  if (registry) {
    const budget = await checkBudget(supabase, registry.id)
    if (!budget.allowed) {
      return new Response(JSON.stringify({
        error: 'Budget exceeded',
        message: `${agentConfig.display_name} has exhausted its monthly budget. Please increase the budget or wait for the monthly reset.`,
        spent: budget.spent,
        limit: budget.limit,
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Get latest user message for memory search
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  const lastMessageText = lastUserMessage
    ? (lastUserMessage as UIMessage).parts
        ?.filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text ?? '')
        .join(' ')
      ?? ''
    : ''

  // Fetch user work context (how they operate — dev tools, social media, workflow)
  const { data: userProfile } = await supabase
    .from('users')
    .select('work_context')
    .eq('id', user.id)
    .single()

  // Build system prompt with memory context + user work context
  const { prompt: systemPrompt, memoryCount } = await buildSystemPromptWithMemory(
    brand as Brand,
    agentConfig as AgentConfig,
    lastMessageText,
    userProfile?.work_context
  )

  // Get tools for this agent
  const tools = getToolsForAgent(agentType, {
    supabase,
    userId: user.id,
    brandId,
    conversationId: conversationId ?? null,
    agentRegistryId: registry?.id ?? null,
  })

  // Add delegation tool for Director only
  if (agentType === 'overall') {
    const delegateTool = createDelegateTool({
      supabase,
      userId: user.id,
      brandId,
      brand: brand as Brand,
      conversationId: conversationId ?? null,
    })
    ;(tools as Record<string, unknown>).delegate_to_agent = delegateTool
  }

  const typedBrand = brand as Brand

  // Add web search tool for Director, SEO, and Market Intelligence
  if (['overall', 'seo', 'competitor'].includes(agentType)) {
    ;(tools as Record<string, unknown>).web_search = gateway.tools.perplexitySearch({
      maxResults: 5,
      searchLanguageFilter: ['en'],
      searchRecencyFilter: 'month',
    })
  }

  // Gateway provider options — fallbacks, tracking, compliance
  const isHealthBrand = typedBrand.compliance_flags?.ahpra || typedBrand.compliance_flags?.tga
  const gatewayOptions = {
    gateway: {
      // Fallback: if Claude is down, try GPT-4.1
      models: ['openai/gpt-4.1'] as string[],
      // Track spend per user
      user: user.id,
      // Tag by agent type for analytics
      tags: [agentType, typedBrand.slug, 'chat'],
      // Zero data retention for health brands (AHPRA/TGA compliance)
      ...(isHealthBrand && { zeroDataRetention: true }),
    },
  }

  // Create ToolLoopAgent with Gateway options
  const agent = new ToolLoopAgent({
    id: `nrs-${agentType}`,
    model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(5),
    providerOptions: gatewayOptions,
  })

  // Stream the agent's response
  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage?.inputTokens ?? 0
      const outputTokens = usage?.outputTokens ?? 0
      const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

      // Record spend against budget
      if (registry) {
        await recordAgentSpend(supabase, registry.id, costCents)
      }

      // Log token usage
      await supabase.from('ai_usage').insert({
        user_id: user.id,
        query_type: `agency_${agentType}`,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        model: registry?.model || 'anthropic/claude-sonnet-4',
        cost_usd: costCents / 100,
        metadata: { memoryCount, agentRegistryId: registry?.id },
      })

      // Audit log
      await logAudit({
        supabase,
        userId: user.id,
        agentId: registry?.id,
        action: 'chat_completed',
        entityType: 'conversation',
        entityId: conversationId ?? undefined,
        detail: {
          agentType,
          brand: typedBrand.slug,
          inputTokens,
          outputTokens,
          costCents,
          memoryCount,
        },
        costCents,
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
