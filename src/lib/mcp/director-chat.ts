import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from '@/lib/agents/tools'
import { createDelegateTool } from '@/lib/agents/tools/delegate'
import { createConveneMeetingTool } from '@/lib/agents/tools/convene-meeting'
import { classifyIntent, classifyIntentMulti, buildRoutingContext } from '@/lib/agents/intent-router'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import { extractAndStoreMemories } from '@/lib/ruflo/memory-extractor'
import { extractFacts } from '@/lib/memory/fact-extractor'
import { memoryStoreV2 } from '@/lib/memory/store'
import { ensureProforma } from '@/lib/proforma/auto-populate'
import { CADENCE_DAYS, type ReviewCadence } from '@/lib/proforma/sections'
import type { Brand, AgentConfig } from '@/types/database'

/**
 * Register the chat_with_director MCP tool.
 * This is the flagship tool — user talks to the Director and gets a full response
 * including delegation chains, tool use, and multi-agent meetings.
 */
export function registerDirectorChatTool(mcpServer: McpServer, userId: string) {
  mcpServer.registerTool('chat_with_director', {
    description: `Send a message to the NRS Director — the central orchestrator of a 14-agent AI marketing agency. The Director delegates to 13 specialist departments automatically: Content & Copy, SEO & GEO, Paid Ads, Strategy & Launch, Email Marketing, Growth & Partnerships, Brand, Market Intelligence, Web & CRO, Compliance (AHPRA/TGA), Analytics & Reporting, Automation & AI, Video & Scripting.

USE THIS TOOL for complex or multi-step marketing requests. The Director can chain tools, delegate to departments, and run multi-agent meetings.

ALWAYS call list_brands first to get brand IDs before using this tool.

Example messages:
- "Write a blog post about telehealth benefits and publish it to LinkedIn"
- "Run a full marketing audit"
- "Create a 2-week content calendar"
- "Post 'Free trial this week' to Facebook and Instagram"
- "Scan my website and tell me what's wrong"
- "Write 3 Google Ads for weight loss consultations"
- "Design a social media graphic for our new product"
- "What did my agency do this month?"
- "Analyse my competitors"
- "Write a welcome email sequence"

The Director answers in plain language and takes action. For simple single-tool tasks (like just checking the calendar), you can call the individual tools directly instead.`,
    inputSchema: {
      brand_id: z.string().describe('Brand ID — call list_brands first to get IDs'),
      message: z.string().describe('Your message to the Director — plain language, any marketing request'),
    },
  }, async ({ brand_id, message }: { brand_id: string; message: string }) => {
    const supabase = createAdminClient()

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .eq('user_id', userId)
      .single()

    if (brandError || !brand) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Brand not found or you do not have access.' }],
        isError: true,
      }
    }

    // Fetch agent config for Director
    const { data: agentConfig } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('agent_type', 'overall')
      .single()

    if (!agentConfig) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Director agent not configured.' }],
        isError: true,
      }
    }

    // Check budget
    const registry = await getOrCreateAgentRegistry(supabase, userId, 'overall')
    if (registry) {
      const budget = await checkBudget(supabase, registry.id)
      if (!budget.allowed) {
        return {
          content: [{ type: 'text' as const, text: `Budget exceeded. The Director has used its monthly allocation. Spent: ${budget.spent}c / ${budget.limit}c limit.` }],
          isError: true,
        }
      }
    }

    // Fetch user context + sibling brands + proforma
    const [{ data: userProfile }, { data: siblingBrands }, proformaSections] = await Promise.all([
      supabase.from('users').select('work_context').eq('id', userId).single(),
      supabase.from('brands').select('name, slug, description, niche, website_url, github_url, products_services').eq('user_id', userId).neq('id', brand_id),
      ensureProforma(supabase, brand as Brand),
    ])

    // Build proforma summary
    let proformaSummary: string | null = null
    if (proformaSections.length > 0) {
      const lines: string[] = []
      const snapshot = proformaSections.find((s: { section_key: string }) => s.section_key === 'executive_snapshot')
      if (snapshot) {
        const data = snapshot.section_data as Record<string, unknown>
        const entries = Object.entries(data)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        if (entries.length > 0) {
          lines.push('**Executive Snapshot:**', ...entries, '')
        }
      }
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

    // Build system prompt with memory
    let { prompt: systemPrompt } = await buildSystemPromptWithMemory(
      brand as Brand,
      agentConfig as AgentConfig,
      message,
      userProfile?.work_context,
      (siblingBrands as Brand[]) ?? [],
      proformaSummary,
      userId,
    )

    // Intent routing
    const routing = classifyIntent(message)
    const multiRouting = classifyIntentMulti(message)
    const routingContext = buildRoutingContext(routing, multiRouting)
    if (routingContext) {
      systemPrompt += '\n\n---\n\n' + routingContext
    }

    // Append MCP context
    systemPrompt += '\n\n---\nThis request is coming via MCP (CLI/API). The user is working from Claude Code or another AI client, not the web UI. Respond with text only — no UI-specific references like "click here" or "see the sidebar". Be direct and actionable.'

    // Get tools
    const tools = getToolsForAgent('overall', {
      supabase,
      userId,
      brandId: brand_id,
      conversationId: null,
      agentRegistryId: registry?.id ?? null,
    })

    // Add delegation + meeting tools
    const delegateCtx = {
      supabase,
      userId,
      brandId: brand_id,
      brand: brand as Brand,
      conversationId: null,
    }
    ;(tools as Record<string, unknown>).delegate_to_agent = createDelegateTool(delegateCtx)
    ;(tools as Record<string, unknown>).convene_meeting = createConveneMeetingTool(delegateCtx)

    // Add web search
    ;(tools as Record<string, unknown>).web_search = gateway.tools.perplexitySearch({
      maxResults: 5,
      searchLanguageFilter: ['en'],
      searchRecencyFilter: 'month',
    })

    const typedBrand = brand as Brand
    const isHealthBrand = typedBrand.compliance_flags?.ahpra || typedBrand.compliance_flags?.tga

    try {
      // Use generateText (blocking) instead of streamText — MCP needs complete response
      const result = await generateText({
        model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
        tools,
        stopWhen: stepCountIs(5),
        providerOptions: {
          gateway: {
            models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'],
            user: userId,
            tags: ['overall', typedBrand.slug, 'mcp'],
            ...(isHealthBrand && { zeroDataRetention: true }),
          },
        },
      })

      // Record spend + audit
      const inputTokens = result.usage?.inputTokens ?? 0
      const outputTokens = result.usage?.outputTokens ?? 0
      const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

      if (registry) {
        await recordAgentSpend(supabase, registry.id, costCents)
      }

      await supabase.from('ai_usage').insert({
        user_id: userId,
        query_type: 'agency_overall_mcp',
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        model: registry?.model || 'anthropic/claude-sonnet-4',
        cost_usd: costCents / 100,
        metadata: { source: 'mcp' },
      })

      await logAudit({
        supabase,
        userId,
        agentId: registry?.id,
        action: 'mcp_chat_completed',
        entityType: 'mcp',
        detail: { brand: typedBrand.slug, inputTokens, outputTokens, costCents },
        costCents,
      })

      // ── Memory extraction — same as web app, learning from MCP conversations ──
      if (result.text && result.text.length > 20) {
        // v1: Regex extraction (fast, catches common patterns)
        extractAndStoreMemories({
          brandSlug: typedBrand.slug,
          agentType: 'overall',
          userMessage: message,
          assistantResponse: result.text,
          conversationId: null,
        }).catch((err) => console.error('[mcp] Memory v1 extraction failed:', err))

        // v2: LLM extraction (Haiku — deeper understanding, structured facts)
        extractFacts(message, result.text, typedBrand.name)
          .then(async (facts) => {
            if (facts.length === 0) return
            const ns = `nrs-${typedBrand.slug}-overall`
            for (const fact of facts) {
              await memoryStoreV2(fact, ns, userId)
                .catch((err) => console.error('[mcp] Memory v2 store failed:', err))
            }
          })
          .catch((err) => console.error('[mcp] Memory v2 extraction failed:', err))
      }

      return {
        content: [{ type: 'text' as const, text: result.text || 'Done.' }],
      }
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      }
    }
  })
}
