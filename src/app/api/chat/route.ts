export const maxDuration = 300 // Fluid Compute — 5 minutes for delegation

import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from '@/lib/agents/tools'
import { createDelegateTool } from '@/lib/agents/tools/delegate'
import { createConveneMeetingTool } from '@/lib/agents/tools/convene-meeting'
import { extractAndStoreMemories } from '@/lib/ruflo/memory-extractor'
import { recordTurn, shouldExtractSessionMemory, extractSessionMemory } from '@/lib/memory/session-memory'
import { extractFacts } from '@/lib/memory/fact-extractor'
import { memoryStoreV2 } from '@/lib/memory/store'
import { classifyIntent, classifyIntentMulti, buildRoutingContext } from '@/lib/agents/intent-router'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { ensureProforma } from '@/lib/proforma/auto-populate'
import { CADENCE_DAYS, type ReviewCadence } from '@/lib/proforma/sections'

const VALID_AGENT_TYPES: AgentType[] = [
  'overall', 'content', 'seo', 'paid_ads', 'strategy', 'email',
  'growth', 'brand', 'competitor', 'website', 'compliance',
  'analytics', 'automation', 'video',
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
    return new Response(JSON.stringify({ error: 'Unauthorised', friendlyMessage: "You've been signed out. Please log in again." }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', friendlyMessage: "Something didn't look right. Try rewording your message.", details: parsed.error.issues }), {
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
    return new Response(JSON.stringify({ error: 'Brand not found', friendlyMessage: "I can't find this brand. Try selecting it again from the sidebar." }), {
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
    return new Response(JSON.stringify({ error: 'Agent not found', friendlyMessage: "This department isn't available right now. Try the Director instead." }), {
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
        message: `${agentConfig.display_name} has exhausted its monthly budget.`,
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

  // Fetch user work context + sibling brands + proforma (for ecosystem awareness)
  const [{ data: userProfile }, { data: siblingBrands }, proformaSections] = await Promise.all([
    supabase.from('users').select('work_context').eq('id', user.id).single(),
    supabase.from('brands').select('name, slug, description, niche, website_url, github_url, products_services').eq('user_id', user.id).neq('id', brandId),
    ensureProforma(supabase, brand as Brand),
  ])

  // Build proforma summary for system prompt
  let proformaSummary: string | null = null
  if (proformaSections.length > 0) {
    const lines: string[] = []

    // Executive snapshot in full
    const snapshot = proformaSections.find(s => s.section_key === 'executive_snapshot')
    if (snapshot) {
      const data = snapshot.section_data as Record<string, unknown>
      const entries = Object.entries(data)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      if (entries.length > 0) {
        lines.push('**Executive Snapshot:**')
        lines.push(...entries)
        lines.push('')
      }
    }

    // Status overview of all other sections
    lines.push('**Section Status:**')
    for (const s of proformaSections) {
      if (s.section_key === 'executive_snapshot') continue
      const maxDays = CADENCE_DAYS[s.review_cadence as ReviewCadence] ?? 30
      const ageDays = (Date.now() - new Date(s.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      const stale = ageDays > maxDays
      const status = s.rag_status === 'green' ? 'GREEN' : s.rag_status === 'amber' ? 'AMBER' : s.rag_status === 'red' ? 'RED' : '?'
      const updated = new Date(s.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      lines.push(`- ${s.section_title}: [${status}]${stale ? ' **STALE**' : ''} (updated ${updated})`)
    }

    proformaSummary = lines.join('\n')
  }

  // Build system prompt with memory + user context + proforma
  let { prompt: systemPrompt, memoryCount } = await buildSystemPromptWithMemory(
    brand as Brand,
    agentConfig as AgentConfig,
    lastMessageText,
    userProfile?.work_context,
    (siblingBrands as Brand[]) ?? [],
    proformaSummary,
    user.id
  )

  // Intent classification + auto-routing for Director
  let multiRouting: ReturnType<typeof classifyIntentMulti> | undefined
  if (agentType === 'overall' && lastMessageText) {
    const routing = classifyIntent(lastMessageText)
    multiRouting = classifyIntentMulti(lastMessageText)
    const routingContext = buildRoutingContext(routing, multiRouting)
    if (routingContext) {
      systemPrompt = systemPrompt + '\n\n---\n\n' + routingContext
    }
  }

  // Get tools for this agent
  const tools = getToolsForAgent(agentType, {
    supabase,
    userId: user.id,
    brandId,
    conversationId: conversationId ?? null,
    agentRegistryId: registry?.id ?? null,
  })

  // Add delegation + meeting tools for Director only
  if (agentType === 'overall') {
    const delegateCtx = {
      supabase,
      userId: user.id,
      brandId,
      brand: brand as Brand,
      conversationId: conversationId ?? null,
    }
    ;(tools as Record<string, unknown>).delegate_to_agent = createDelegateTool(delegateCtx)
    ;(tools as Record<string, unknown>).convene_meeting = createConveneMeetingTool(delegateCtx)
  }

  const typedBrand = brand as Brand

  // Add web search for Director, SEO, Market Intelligence
  if (['overall', 'seo', 'competitor'].includes(agentType)) {
    ;(tools as Record<string, unknown>).web_search = gateway.tools.perplexitySearch({
      maxResults: 5,
      searchLanguageFilter: ['en'],
      searchRecencyFilter: 'month',
    })
  }

  // Gateway options — fallbacks, tracking, compliance
  const isHealthBrand = typedBrand.compliance_flags?.ahpra || typedBrand.compliance_flags?.tga

  // Stream with all features
  const result = streamText({
    model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    providerOptions: {
      gateway: {
        models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'],
        user: user.id,
        tags: [agentType, typedBrand.slug, 'chat'],
        ...(isHealthBrand && { zeroDataRetention: true }),
      },
    },
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage.inputTokens ?? 0
      const outputTokens = usage.outputTokens ?? 0
      const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

      // Record spend
      if (registry) {
        await recordAgentSpend(supabase, registry.id, costCents)
      }

      // Log usage
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
        detail: { agentType, brand: typedBrand.slug, inputTokens, outputTokens, costCents, memoryCount },
        costCents,
      })

      // Smart memory extraction — v2 (LLM) + v1 (regex) in parallel
      if (text && text.length > 20) {
        // v1: Regex extraction (fast, immediate, catches common patterns)
        extractAndStoreMemories({
          brandSlug: typedBrand.slug,
          agentType,
          userMessage: lastMessageText,
          assistantResponse: text,
          conversationId: conversationId ?? null,
        }).catch((err) => console.error('[chat] Memory v1 extraction failed:', err))

        // v2: LLM extraction (Haiku — deeper understanding, structured facts)
        extractFacts(lastMessageText, text, typedBrand.name)
          .then(async (facts) => {
            if (facts.length === 0) return
            const ns = `nrs-${typedBrand.slug}-${agentType}`
            for (const fact of facts) {
              await memoryStoreV2(fact, ns, user.id, conversationId ?? undefined)
                .catch((err) => console.error('[chat] Memory v2 store failed:', err))
            }
          })
          .catch((err) => console.error('[chat] Memory v2 extraction failed:', err))
      }

      // Session memory — compounding per-brand learning (Anthropic pattern)
      if (conversationId) {
        recordTurn(conversationId)
        if (shouldExtractSessionMemory(conversationId)) {
          extractSessionMemory({
            brandSlug: typedBrand.slug,
            brandName: typedBrand.name,
            userId: user.id,
            userMessage: lastMessageText,
            assistantResponse: text,
            conversationId,
          }).catch(err => console.error('[chat] Session memory failed:', err))
        }
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
