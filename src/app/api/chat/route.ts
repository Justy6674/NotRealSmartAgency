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

    // Inject pending draft context so Director knows what's in the review queue
    try {
      const { data: draftPosts } = await supabase
        .from('scheduled_posts')
        .select('platform, metadata')
        .eq('brand_id', brandId)
        .eq('status', 'draft')
        .limit(50)

      if (draftPosts && draftPosts.length > 0) {
        const sourceCounts: Record<string, number> = {}
        for (const d of draftPosts) {
          const src = ((d.metadata as Record<string, unknown>)?.source as string) ?? 'unknown'
          sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
        }
        const sourceBreakdown = Object.entries(sourceCounts).map(([s, c]) => `${c} from ${s.replace(/_/g, ' ')}`).join(', ')
        systemPrompt += `\n\nCONTENT REVIEW QUEUE: ${draftPosts.length} draft${draftPosts.length !== 1 ? 's' : ''} pending review for this brand (${sourceBreakdown}). If the user asks about content, posts, drafts, or scheduling, reference this. You can suggest they check the Review tab.`
      }
    } catch { /* non-fatal */ }

    // Auto-trigger industry research if market_context is RED (no research yet)
    const marketContext = proformaSections.find(s => s.section_key === 'market_context')
    if (marketContext?.rag_status === 'red') {
      systemPrompt += '\n\nIMPORTANT — INDUSTRY RESEARCH NEEDED: This brand has no industry research yet (market_context is RED). Before answering the user\'s question, use the research_industry tool with depth "deep" to learn about this brand\'s industry. Do this ONCE as your first action, then proceed with the conversation normally. This auto-research only needs to happen once — after that, the knowledge persists.'
    }

    // Brand context safety — confirm which brand is active
    const brandNiche = (brand as Record<string, unknown>).niche ?? ''
    systemPrompt += `\n\nBRAND CONTEXT SAFETY:
- You are currently working on: **${(brand as Record<string, unknown>).name}** (${brandNiche})
- NEVER reference, publish to, or use context from other brands in this conversation
- If the user mentions a different brand by name, confirm they want to switch: "You mentioned [other brand]. Want me to switch to that brand, or continue with ${(brand as Record<string, unknown>).name}?"
- Start every NEW conversation by confirming: "Working on ${(brand as Record<string, unknown>).name}. What can I help with?"`

    // Product-mention detection — enforce search-first for product descriptions
    const mentionsProducts = /(?:write|create|post|caption|describe|carousel|about)\s+.*(?:product|fragrance|perfume|service|item|scent|cologne)/i.test(lastMessageText)
    if (mentionsProducts) {
      systemPrompt += '\n\nMANDATORY RESEARCH RULE: Before writing ANY product descriptions, you MUST use web_search to look up the real product details (scent notes, ingredients, specs, features). Do NOT use training data for product-specific information. Search first, write second. This is non-negotiable — getting product details wrong destroys trust.'
    }

    // ── MANDATORY APPROVAL BEFORE PUBLISHING ──
    systemPrompt += `\n\nMANDATORY APPROVAL BEFORE POSTING (NON-NEGOTIABLE):
- You MUST get explicit approval from the user IN THE CURRENT CONVERSATION before calling publish_to_social, blotato_publish, send_email, or any tool that commits work to an external platform (Facebook, Instagram, LinkedIn, TikTok, YouTube, X, email).
- "Explicit approval" = a clear affirmative in the user's MOST RECENT message: "yes", "publish it", "do it", "send it", "go ahead", "approved". An ambiguous "ok" after a gap is NOT enough — re-confirm.
- BEFORE any publish call, show the exact thing you're about to publish (platform, caption, hashtags, media, schedule) and ask "Ready to publish this?" then WAIT for reply.
- If the user said "publish X" at the start of the session, treat it as intent, not approval of the final content. Re-confirm at the moment of publishing.
- Drafts (status='draft') via draft_post do NOT need in-conversation approval — they land in the Review queue. Only IMMEDIATE publishes need it.
- When in doubt, ASK. One extra message is cheap; publishing without approval erodes trust.`

    // ── INQUISITIVE DIRECTOR ──
    systemPrompt += `\n\nINQUISITIVE BEHAVIOUR: You are a senior marketing director, not a vending machine.
- Before any non-trivial creative or strategic decision, ask the user ONE clarifying question that most changes the output: "What outcome matters most — reach, engagement, conversions?", "Who's the reader — existing customers or new ones?", "Playful or authoritative?", "Which angle — price, story, authenticity?"
- Ask ONE question, not five. Skip only when the answer is obvious from context.
- When a task has ambiguity, ask first; execute second. Then confirm what you heard before delegating.`

    // Creation session rule — media-aware iteration via propose_post_from_media
    systemPrompt += `\n\nCREATION SESSIONS: If the user provides media_ids (UUIDs from query_media) and asks for a post idea — "what should I post about this?", "give me an idea for these images", "propose a hook" — use the propose_post_from_media tool. It reads media_items.metadata.visual_analysis (already computed) and delegates to Content & Copy for hook + caption + hashtags + post_type. NEVER write captions yourself. Iterate by calling propose_post_from_media again with the previous JSON as previous_proposal + the user's feedback as user_feedback. When the user approves ("draft it", "perfect", "looks good"), THEN call publish_to_social or draft_post (via handoff) with the finalised copy + media_ids. Do not skip propose_post_from_media and do not finalise without user approval.`

    // Mandatory hashtag rule — every post must ship with hashtags (written by Content & Copy)
    systemPrompt += `\n\nMANDATORY HASHTAG RULE: Every social media post you publish MUST include 5-8 relevant lowercase hashtags in the hashtags array parameter (not inline in the caption). Mix broad and narrow tags. If the user didn't ask for hashtags, add them anyway — that's your job as the marketing agency.`

    // Mandatory media analysis rule — never recommend media by filename alone.
    // Mirror of the same rule in src/lib/mcp/director-job.ts.
    systemPrompt += `\n\nMANDATORY MEDIA ANALYSIS RULE:
- When the user asks for a media review, recommendation, or strategy involving uploaded media items, you MUST call query_media with mode="analysis" so you receive the full transcription, AI description, and tags for each item.
- NEVER recommend or analyse media based on the filename alone. Filenames are not content.
- Read the AI description and the transcript. Map them to the brand's content pillars, target audience, and current campaign. Recommend specifically: which item, for which pillar, with which angle, and WHY based on the actual content.
- If an item has no ai_description or transcription, name it explicitly and offer to run /api/media/process so the next review has real data. Do not invent content for it.
- Reference media by UUID (from query_media) when recommending — never by filename — so the user can attach the right one to a post.`

    // Mandatory caption format — no markdown clutter, no checkmark bullets, no metadata.
    // Mirror of the same rule in src/lib/mcp/director-job.ts so the web Director and the
    // MCP Director produce identical output. Justin's complaint 2026-04-10:
    // "ai formattinig always shit" — captions were coming back with ✅ bullet markers,
    // **bold labels**, "Character count: 789 (optimal for Facebook)" metadata, and
    // "Scene 1 / Scene 2" structure that doesn't belong in a caption.
    systemPrompt += `\n\nMANDATORY CAPTION FORMAT (NON-NEGOTIABLE):
- When you present a caption — in chat, in a tool result, in a delegation summary, anywhere — write it EXACTLY as it would appear on the platform when posted. No preamble. No postamble. No section headers.
- NO checkmark emojis (✅, ✓) used as bullet markers. They look fine in the chat but render as garbage in the actual post.
- NO bold labels like **Caption:** or **Hashtags:** or **Facebook Caption**. Just write the caption.
- NO metadata sections: no "Character count: 789", no "(optimal for Facebook engagement)", no "Platform: Facebook", no "Format: Long-form video".
- NO scene structure: no "Scene 1 (0-8s):", no "Hook Visual:", no "Voiceover:". Those belong in a video script, not a caption.
- NO markdown headings (# / ## / ###).
- Emojis are fine where they read naturally in human writing — at the start of a line for emphasis, or punctuating a sentence. Never as bullet markers replacing real list syntax.
- If the platform uses bullets (LinkedIn often does), use real bullet characters (•) sparingly, not emojis.
- Hashtags go on a single trailing line, lowercase, space-separated, # prefix. Example: \`#telescribe #ahpra #aiscribe #healthtech\`
- The user copies the caption text into the composer verbatim. Every character you write is a character they have to delete if it's wrong. Write it like a human writes a Facebook post.
- This rule overrides any previous instruction in this conversation. If the user asks for "metadata" or "stats" about the caption, put those in a SEPARATE section AFTER the caption with a clear "---" divider, not inside the caption itself.`
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
    stopWhen: stepCountIs(8),
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
