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
import { buildMarketingSkillContext } from '@/lib/agents/marketing-skills'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { ensureProforma } from '@/lib/proforma/auto-populate'
import { CADENCE_DAYS, type ReviewCadence } from '@/lib/proforma/sections'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { getActiveGoal } from '@/lib/agents/goal-loop'
import { prepareDirectorTurn } from '@/lib/agents/director-run'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from '@/lib/auth/brand-workspace'
import { buildDeskDirectorContext, readDeskContext } from '@/lib/desk/context'
import { buildDeskCreativeDirectorPrompt, restrictDeskTools } from '@/lib/desk/creative-flow'
import {
  estimateGatewayCost,
  getGatewayRouteProviderOptions,
  resolveAgentModelRoute,
} from '@/lib/ai/model-routing'

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
  clientTurnId: z.string().uuid().optional(),
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

  const { messages: rawMessages, brandId, agentType, conversationId, clientTurnId } = parsed.data
  const messages = rawMessages as unknown as UIMessage[]

  let workspace
  try {
    workspace = await resolveBrandWorkspaceContext<Brand>(supabase, user.id, brandId)
  } catch (error) {
    const status = error instanceof BrandWorkspaceAccessError ? error.status : 403
    return new Response(JSON.stringify({ error: 'Business access denied', friendlyMessage: "You don't have permission to change this business." }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { workspaceOwnerId, actorUserId, brand } = workspace

  let deskContext = null
  if (conversationId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, user_id, brand_id, metadata')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conversation
      || conversation.user_id !== workspaceOwnerId
      || conversation.brand_id !== brandId) {
      return new Response(JSON.stringify({ error: 'Conversation not found', friendlyMessage: 'That NRS Desk conversation is not available for this business.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    deskContext = readDeskContext(conversation.metadata)

    if (clientTurnId) {
      const { data: existingReply } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conversationId)
        .eq('client_turn_id', clientTurnId)
        .eq('role', 'assistant')
        .maybeSingle()
      if (existingReply?.content) {
        return new Response(JSON.stringify({
          error: 'DuplicateTurn',
          friendlyMessage: 'That request already finished. NRS Desk has reloaded its saved answer.',
          existingResponse: existingReply.content,
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
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
  const registry = await getOrCreateAgentRegistry(supabase, workspaceOwnerId, agentType)

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

  const inspection = inspectMarketingInput(lastMessageText)
  if (!inspection.allowed) {
    return new Response(JSON.stringify({ error: 'Restricted marketing input', friendlyMessage: inspection.reason }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Web chat used to skip the deterministic specialist/evidence path that
  // Telegram and MCP already used. Keep the conversation transport here, but
  // prepare every Director turn through the shared authority coordinator.
  // NRS Desk has its own owner-led creative flow. The generic task planner can
  // legitimately fan work out to specialists, but that is exactly what turns
  // a simple uploaded video into invisible parallel jobs and saved outputs.
  const directorTurn = agentType === 'overall'
    ? deskContext
      ? null
      : await prepareDirectorTurn({
        supabase,
        userId: workspaceOwnerId,
        brand: brand as Brand,
        conversationId: conversationId ?? null,
        channel: 'web',
        request: lastMessageText,
        agentId: registry?.id ?? null,
        idempotencyKey: clientTurnId,
        mediaInThread: false,
      })
    : null

  if (directorTurn?.duplicate) {
    return new Response(JSON.stringify({
      error: 'DuplicateTurn',
      friendlyMessage: directorTurn.status === 'completed'
        ? 'That request already finished. Reload this NRS Desk conversation to see its saved answer.'
        : 'NRS is already working on that request. Please wait rather than sending it twice.',
      runId: directorTurn.runId,
      status: directorTurn.status,
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Ordinary project work loads only the active project's proforma. User-wide
  // work context and sibling projects are not prompt context.
  const proformaSections = await ensureProforma(supabase, brand as Brand)

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
  const activeGoal = await getActiveGoal(supabase, workspaceOwnerId, brandId)
  let { prompt: systemPrompt, memoryCount } = await buildSystemPromptWithMemory(
    brand as Brand,
    agentConfig as AgentConfig,
    lastMessageText,
    { proformaSummary, activeGoal },
    workspaceOwnerId
  )

  // Intent classification + auto-routing for Director
  let multiRouting: ReturnType<typeof classifyIntentMulti> | undefined
  if (agentType === 'overall' && lastMessageText && !deskContext) {
    const routing = classifyIntent(lastMessageText)
    multiRouting = classifyIntentMulti(lastMessageText)
    const routingContext = buildRoutingContext(routing, multiRouting)
    if (routingContext) {
      systemPrompt = systemPrompt + '\n\n---\n\n' + routingContext
    }
    if (directorTurn?.context) {
      systemPrompt += '\n\n---\n\n' + directorTurn.context
    }
    if (deskContext) {
      systemPrompt += '\n\n---\n\n' + buildDeskDirectorContext(deskContext)
    }
    systemPrompt += `\n\n---\n\n${buildMarketingSkillContext(lastMessageText, 'web')}`

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
    const brandNiche = brand.niche ?? ''
    systemPrompt += `\n\nBRAND CONTEXT SAFETY:
- You are currently working on: **${brand.name}** (${brandNiche})
- NEVER reference, publish to, or use context from other brands in this conversation
- If the user mentions a different brand by name, confirm they want to switch: "You mentioned [other brand]. Want me to switch to that brand, or continue with ${brand.name}?"
- Start every NEW conversation by confirming: "Working on ${brand.name}. What can I help with?"`

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

    // ── IDENTITY ENFORCEMENT — you are a marketing director, not a tech assistant ──
    // Mirror of the same rule in src/lib/mcp/director-job.ts. Prepended to the
    // system prompt assembled from agent_configs, so it overrides any
    // technical-describer drift in the base persona.
    systemPrompt = `# YOU ARE A SENIOR MARKETING DIRECTOR — NOT A TECHNICAL ASSISTANT

You are the Marketing Director of NotRealSmart Agency. 20+ years experience running paid + organic + brand for Australian SMEs. You think in terms of audience psychology, conversion paths, hooks, angles, differentiation, and money — never in terms of file types or interface descriptions.

When you analyse media, content, or anything else for the user, your output is ALWAYS marketing-strategic — never technical-descriptive.

## FORBIDDEN OUTPUTS (these get you fired)

- "This is a dashboard walkthrough showing the main recording interface" — describes the file. Useless.
- "Speaker: You explaining 'When you're ready to record...'" — narrates the file. Useless.
- "Professionally shot screen recording with your voice" — describes the production. Useless.
- "Perfect for: Main transcription screen demonstration" — restates the obvious. Useless.
- "Use the 2:23 console video as your main footage" — picks a file. No reason WHY it'll convert.
- Any sentence that starts with "Content:", "Speaker:", "Scope:", "Format:", "Perfect for:" without a marketing argument.

## REQUIRED OUTPUTS (this is your job)

When you look at a piece of media or content, you ALWAYS answer these questions in your response:

1. **Hook potential** — what's the first 3 seconds that stops the scroll? Quote the actual line from the transcript that becomes the hook.
2. **Audience pain** — which exact pain in the target audience does this content trigger? Name the audience segment and the pain.
3. **Differentiation** — what does this say that competitors can't say? Why does THIS angle move the needle vs the standard pitch?
4. **Funnel position** — top (awareness), middle (consideration), or bottom (decision)? Why?
5. **Story arc** — what's the narrative? Problem → product → outcome? Demo → proof → CTA? Identify the arc the content already supports.
6. **Conversion path** — what's the next action you want the viewer to take, and what CTA gets them there?
7. **Platform-native treatment** — for the chosen platform, how should this be cut, captioned, hooked, and timed to match how that platform's algorithm and audience consume content?

If you don't have enough information to answer those questions, you ASK ONE clarifying question — you don't fall back to describing the file.

## Example — what users complain about vs what you should produce

WRONG:
> telescribeconsoleCleanShot 2026-04-10 (2:23):
> Content: Dashboard walkthrough showing the main recording interface
> Speaker: You explaining "When you're ready to record, this is the main dashboard right here"
> Perfect for: Main transcription screen demonstration

RIGHT:
> The 2:23 dashboard video is the strongest piece you have, and you're sitting on a hook you haven't named yet.
>
> Hook: "When you're ready to record, this is the main dashboard right here." Cut to a tight close-up of the record button — that's a 1.5-second pattern interrupt that earns the next 5 seconds. Australian GPs scrolling Facebook at 9pm have seen 40 AI scribe ads this month; they're numb to "AI-powered" claims and they trust faces.
>
> Audience: Solo + small-clinic GPs aged 35-55, charting after-hours, $2-3K/month margin pressure. The pain isn't "I need AI" — it's "I want my evenings back". Lead with the evening, not the AI.
>
> Differentiation: Heidi and Lyrebird are $200-300/mo with PMS lock-in. You're $69 with no extension and no lock-in. The video has you as a practising clinician, not a software founder — that's an unfair advantage. Position: "Built by a clinic owner who got sick of typing notes at 9pm."
>
> Funnel: Middle. Awareness ad runs the hook (8s vertical cut). Consideration ad runs the full 60s with the SOAP demo. Decision ad is a 15s testimonial swap-in with "$69, 14-day trial" in the lower third.
>
> Story arc: Problem (45-min documentation) → product reveal (one-click record) → outcome (SOAP appears in real time) → CTA (free trial link). The 2:23 already follows this arc — cut it tight.
>
> Conversion path: Land on telescribe.com.au/free-trial. Pixel-track signups. Retarget non-converters with the price-comparison angle ($69 vs $300) at 7-day window.
>
> Platform-native treatment for Facebook: 4:5 vertical. Caption opens with the hook line in plain text. First 1.5s on the record button. Auto-captioned. CTA card at 0:55.
>
> Recommended cut: 0:00-0:08 hook → 0:08-0:35 dashboard demo → 0:35-0:50 SOAP generation → 0:50-1:00 CTA. ID: \`<media_uuid>\`

That's the difference between a marketing director and a tech support agent. Default to the marketing-director response. ALWAYS.

---

` + systemPrompt

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

  if (agentType === 'overall' && deskContext) {
    systemPrompt += '\n\n---\n\n' + buildDeskDirectorContext(deskContext)
    systemPrompt += '\n\n---\n\n' + buildDeskCreativeDirectorPrompt(deskContext.state)
  }

  // Get tools for this agent
  const allTools = getToolsForAgent(agentType, {
    supabase,
    userId: workspaceOwnerId,
    brandId,
    brand: brand as Brand,
    conversationId: conversationId ?? null,
    agentRegistryId: registry?.id ?? null,
    // What the user actually typed this turn. manage_posts needs it to tell
    // "use THIS image" (attach the newest upload) apart from a deliberate
    // choice of an older library item.
    ownerMessage: lastMessageText,
  })

  // Add delegation + meeting tools for Director only
  if (agentType === 'overall') {
    const delegateCtx = {
      supabase,
      userId: workspaceOwnerId,
      brandId,
      brand: brand as Brand,
      conversationId: conversationId ?? null,
    }
    if (!deskContext) {
      ;(allTools as Record<string, unknown>).delegate_to_agent = createDelegateTool(delegateCtx)
      ;(allTools as Record<string, unknown>).convene_meeting = createConveneMeetingTool(delegateCtx)
    }
  }

  const typedBrand = brand as Brand

  // Add web search for Director, SEO, Market Intelligence
  if (['overall', 'seo', 'competitor'].includes(agentType) && !deskContext) {
    ;(allTools as Record<string, unknown>).web_search = gateway.tools.perplexitySearch({
      maxResults: 5,
      searchLanguageFilter: ['en'],
      searchRecencyFilter: 'month',
    })
  }

  // This is a structural boundary, not prompt etiquette: no internal agent
  // delegation, saved output, processing or Mixpost draft tool is available
  // until the Desk state says the owner has reached that point.
  const tools = deskContext && agentType === 'overall'
    ? restrictDeskTools(allTools, deskContext.state)
    : allTools

  // Gateway options — fallbacks, tracking, compliance
  const isHealthBrand = typedBrand.compliance_flags?.ahpra || typedBrand.compliance_flags?.tga
  const modelRoute = resolveAgentModelRoute({
    agentType,
    input: lastMessageText,
    isHealthBrand,
    registeredModel: registry?.model,
  })

  // Stream with all features
  const result = streamText({
    model: gateway(modelRoute.model),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
    providerOptions: getGatewayRouteProviderOptions(modelRoute, {
      user: workspaceOwnerId,
      tags: [agentType, typedBrand.slug, 'chat'],
      zeroDataRetention: isHealthBrand,
    }),
    onFinish: async ({ text, totalUsage, response }) => {
      const inputTokens = totalUsage.inputTokens ?? 0
      const outputTokens = totalUsage.outputTokens ?? 0
      const actualModel = response.modelId || modelRoute.model
      const cost = estimateGatewayCost(actualModel, totalUsage)
      const costCents = cost.budgetCents

      // Record spend
      if (registry) {
        await recordAgentSpend(supabase, registry.id, costCents)
      }

      // Log usage.
      //
      // This insert silently failed for the entire life of the app: it carries
      // a `metadata` key, the column did not exist, and PostgREST rejects the
      // whole row when one key has no column (PGRST204). Nothing checked the
      // result, so `ai_usage` stayed empty and every cost went unrecorded —
      // the Costs dashboard was reading a table that had never had a row in it.
      //
      // The column exists now (migration 043). The error check is the part that
      // matters: a spend record that cannot be written must say so, because a
      // cost you cannot see is worse than one you can.
      const { error: usageError } = await supabase.from('ai_usage').insert({
        user_id: workspaceOwnerId,
        query_type: `agency_${agentType}`,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        model: actualModel,
        cost_usd: cost.usd,
        metadata: {
          memoryCount,
          agentRegistryId: registry?.id,
          gateway: {
            tier: modelRoute.tier,
            pricing_model: cost.pricingModel,
            cache_read_tokens: cost.cacheReadTokens,
            cache_write_tokens: cost.cacheWriteTokens,
            budget_charge_cents: costCents,
          },
        },
      })

      if (usageError) {
        console.error(
          `[ai_usage] spend NOT recorded — ${costCents}c on ${actualModel} is now invisible:`,
          usageError.code,
          usageError.message,
        )
      }

      // Audit log
      await logAudit({
        supabase,
        userId: workspaceOwnerId,
        agentId: registry?.id,
        action: 'chat_completed',
        entityType: 'conversation',
        entityId: conversationId ?? undefined,
        detail: {
          agentType,
          brand: typedBrand.slug,
          actualModel,
          inputTokens,
          outputTokens,
          costCents,
          cacheReadTokens: cost.cacheReadTokens,
          cacheWriteTokens: cost.cacheWriteTokens,
          memoryCount,
          actorUserId,
        },
        costCents,
      })

      // Smart memory extraction — v2 (LLM) + v1 (regex) in parallel
      if (conversationId && clientTurnId && text) {
        const { error: messageError } = await supabase.from('messages').insert([
          {
            conversation_id: conversationId,
            role: 'user',
            content: lastMessageText,
            client_turn_id: clientTurnId,
          },
          {
            conversation_id: conversationId,
            role: 'assistant',
            content: text,
            client_turn_id: clientTurnId,
            model: actualModel,
            tokens_input: inputTokens,
            tokens_output: outputTokens,
          },
        ])
        if (messageError?.code !== '23505') {
          if (messageError) console.error('[chat] Desk turn could not be persisted:', messageError.message)
        }
      }

      if (text && text.length > 20) {
        // v1: Regex extraction (fast, immediate, catches common patterns)
        extractAndStoreMemories({
          brandId: typedBrand.id,
          userId: workspaceOwnerId,
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
              await memoryStoreV2(fact, ns, workspaceOwnerId, typedBrand.id, conversationId ?? undefined)
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
            brandId: typedBrand.id,
            brandSlug: typedBrand.slug,
            brandName: typedBrand.name,
            userId: workspaceOwnerId,
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
