/**
 * Director Job Runner — runs the full Director in the background.
 *
 * Triggered via Next.js `after()` from the chat_with_director MCP tool.
 * The MCP transport has a ~60s client timeout but generateText with
 * delegation chains takes 90s+. Pattern: tool returns job_id immediately,
 * this runner does the actual work, the client polls get_director_response.
 *
 * IMPORTANT — this is the same Director as the web app. It must NOT be
 * a stripped-down version. All five system-prompt injections from
 * /api/chat/route.ts (routing, queue, proforma, brand context, product
 * search-first) are mirrored here.
 */

import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
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

export interface DirectorJobInput {
  brand_id: string
  message: string
}

export interface DirectorJobResult {
  response: string
  cost_cents: number
  duration_ms: number
  input_tokens: number
  output_tokens: number
}

/**
 * Run the full Director for a given job. Updates the mcp_jobs row in place.
 * Called via Next.js after() from chat_with_director — runs after the
 * MCP response has already been sent.
 */
export async function runDirectorJob(
  jobId: string,
  userId: string,
  input: DirectorJobInput,
): Promise<void> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  // Mark running
  await supabase
    .from('mcp_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)

  try {
    const { brand_id, message } = input

    // Verify brand ownership (defence in depth — already checked in tool)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .eq('user_id', userId)
      .single()

    if (brandError || !brand) {
      await markJobError(supabase, jobId, 'Brand not found or you do not have access.', startTime)
      return
    }

    // Fetch agent config for Director
    const { data: agentConfig } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('agent_type', 'overall')
      .single()

    if (!agentConfig) {
      await markJobError(supabase, jobId, 'Director agent not configured.', startTime)
      return
    }

    // Check budget
    const registry = await getOrCreateAgentRegistry(supabase, userId, 'overall')
    if (registry) {
      const budget = await checkBudget(supabase, registry.id)
      if (!budget.allowed) {
        await markJobError(
          supabase,
          jobId,
          `Budget exceeded. Director used ${budget.spent}c / ${budget.limit}c monthly limit.`,
          startTime,
        )
        return
      }
    }

    // Fetch user context + sibling brands + proforma in parallel
    const [{ data: userProfile }, { data: siblingBrands }, proformaSections] = await Promise.all([
      supabase.from('users').select('work_context').eq('id', userId).single(),
      supabase
        .from('brands')
        .select('name, slug, description, niche, website_url, github_url, products_services')
        .eq('user_id', userId)
        .neq('id', brand_id),
      ensureProforma(supabase, brand as Brand),
    ])

    // Build proforma summary (same shape as web Director)
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
        const status =
          s.rag_status === 'green' ? 'GREEN' : s.rag_status === 'amber' ? 'AMBER' : s.rag_status === 'red' ? 'RED' : '?'
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

    // ── Injection 1: routing hints ──
    const routing = classifyIntent(message)
    const multiRouting = classifyIntentMulti(message)
    const routingContext = buildRoutingContext(routing, multiRouting)
    if (routingContext) {
      systemPrompt += '\n\n---\n\n' + routingContext
    }

    // ── Injection 2: pending review queue (mirrored from /api/chat/route.ts) ──
    try {
      const { data: draftPosts } = await supabase
        .from('scheduled_posts')
        .select('platform, metadata')
        .eq('brand_id', brand_id)
        .eq('status', 'draft')
        .limit(50)

      if (draftPosts && draftPosts.length > 0) {
        const sourceCounts: Record<string, number> = {}
        for (const d of draftPosts) {
          const src = ((d.metadata as Record<string, unknown>)?.source as string) ?? 'unknown'
          sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
        }
        const sourceBreakdown = Object.entries(sourceCounts)
          .map(([s, c]) => `${c} from ${s.replace(/_/g, ' ')}`)
          .join(', ')
        systemPrompt += `\n\nCONTENT REVIEW QUEUE: ${draftPosts.length} draft${
          draftPosts.length !== 1 ? 's' : ''
        } pending review for this brand (${sourceBreakdown}). If the user asks about content, posts, drafts, or scheduling, reference this. They can review them in the Studio Review tab.`
      }
    } catch {
      /* non-fatal */
    }

    // ── Injection 3: brand context safety ──
    const brandNiche = (brand as Record<string, unknown>).niche ?? ''
    systemPrompt += `\n\nBRAND CONTEXT SAFETY:
- You are currently working on: **${(brand as Record<string, unknown>).name}** (${brandNiche})
- NEVER reference, publish to, or use context from other brands in this conversation
- If the user mentions a different brand by name, confirm they want to switch.`

    // ── Injection 4: product-mention search-first ──
    const mentionsProducts =
      /(?:write|create|post|caption|describe|carousel|about)\s+.*(?:product|fragrance|perfume|service|item|scent|cologne)/i.test(
        message,
      )
    if (mentionsProducts) {
      systemPrompt +=
        '\n\nMANDATORY RESEARCH RULE: Before writing ANY product descriptions, you MUST use web_search to look up the real product details (scent notes, ingredients, specs, features). Do NOT use training data for product-specific information. Search first, write second.'
    }

    // ── Injection 5: MCP context ──
    systemPrompt += `\n\n---\nThis request is coming via MCP (CLI/API). The user is working from Claude Code, Cowork, or another AI client, not the web UI. Respond with text only — no UI-specific references like "click here". Be direct and actionable.`

    // ── Injection 6: mandatory hashtag rule for all published content ──
    // NRS rule: every social post must ship with hashtags. Content is written
    // by Content & Copy, not by the MCP client. When you delegate or call
    // publish_to_social, you (or your delegate) MUST include 5-8 lowercase
    // hashtags in the hashtags array — never embedded in the caption body.
    // The MCP client is the messenger; YOU (the agency's AI) own the creative.
    systemPrompt += `\n\nMANDATORY HASHTAG RULE: Every social media post you publish MUST include 5-8 relevant lowercase hashtags in the hashtags array parameter (not inline in the caption). Mix broad (brand/category) and narrow (topic/product) tags. No spaces, no # prefix. This applies to every call of publish_to_social, write_blog, write_ads, and every delegation to Content & Copy. If the user forgot to ask for hashtags, add them anyway — that is YOUR job as the marketing agency, not theirs. The AI client calling you (Claude/Grok/Gemini via MCP) should NEVER supply captions, descriptions, or hashtags of its own — if it tries, reject them and use your own.`

    // ── Injection 6b: MANDATORY CAPTION FORMAT ──
    // Captions presented to the user (in chat OR via tool output) must look
    // exactly like what would land on the platform — not like a structured
    // doc. Previously the Director was returning captions with ✅ checkmark
    // bullets, **bold** labels, "Character count: 789" metadata sections,
    // "Scene 1 / Scene 2 / Scene 3" structure, and other markdown clutter.
    // The user copies the caption verbatim into the composer; every piece
    // of "helpful structure" becomes garbage in the actual post.
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

    // ── Injection 7a: MANDATORY APPROVAL BEFORE PUBLISHING ──
    // The Director NEVER publishes, schedules, or finalises anything without
    // the user's explicit approval in the current conversation. This is a
    // hard rule — even if the user said "publish X" in an earlier message,
    // the Director MUST re-confirm before calling publish_to_social,
    // blotato_publish, or any tool with side effects on external platforms.
    // Research, proposals, drafts, and previews do NOT require approval.
    // Only the final publish/schedule/send action does.
    systemPrompt += `\n\nMANDATORY APPROVAL BEFORE POSTING (NON-NEGOTIABLE):
- You MUST get explicit approval from the user IN THE CURRENT CONVERSATION before calling publish_to_social, blotato_publish, send_email, or any tool that commits work to an external platform (Facebook, Instagram, LinkedIn, TikTok, YouTube, X, email).
- "Explicit approval" means a clear affirmative in the user's most recent message: "yes", "publish it", "do it", "send it", "go ahead", "approved", or similar. An ambiguous "ok" on its own after a long silence is NOT enough — re-confirm.
- BEFORE calling a publish tool, ALWAYS show the user exactly what you're about to publish: platform, caption, hashtags, media, schedule time. Ask "Ready to publish this?" or "Shall I send it?" and WAIT for their reply.
- If the user previously said "publish X" at the start of the session, treat that as an intent to publish, not as approval for the specific final content. Show the final content and re-confirm.
- Drafts (status='draft') via draft_post do NOT need approval — they land in the Review queue where the user approves them manually. Only IMMEDIATE publishes need in-conversation approval.
- If you are uncertain whether you have approval, ASK. Cost of asking: one extra message. Cost of publishing without approval: the user loses trust in the agency.`

    // ── Injection 7b: INQUISITIVE DIRECTOR ──
    // The Director asks questions instead of assuming. Before any creative
    // or strategic decision, surface at least one clarifying question about
    // the user's goal, audience, constraints, or preferences. The Director
    // is a partner, not an order-taker. Inquisitive ≠ annoying; ask the
    // ONE question that most changes the output, not five low-value ones.
    systemPrompt += `\n\nINQUISITIVE BEHAVIOUR: You are a senior marketing director, not a vending machine.
- Before making any non-trivial creative or strategic decision, ask the user ONE clarifying question that most changes the output. Examples: "What outcome matters most — reach, engagement, or conversions?", "Who's the target reader — existing customers or new ones?", "Do you want a playful hook or authoritative?", "What angle should we emphasise — the price, the story, or the authenticity?"
- Ask ONE question, not five. The one that most changes the result.
- Skip asking only when the answer is obvious from context (the user already told you, the brand has a strong documented voice, the request is a pure execution task like "draft a post from these media").
- Questions are cheap. Wrong guesses waste the user's time and erode trust.
- When a user hands you a task with ambiguity, ask first; execute second. Then confirm what they said back to them before you delegate.`

    // ── Injection 7: creation session rule (media-aware iteration) ──
    // When the user provides media IDs and asks for a post idea, use the
    // propose_post_from_media tool — it reads pre-computed visual_analysis
    // from each media_items row and delegates to Content & Copy for a
    // structured proposal. DO NOT write the proposal yourself, DO NOT
    // call the analyse endpoint again, and DO NOT finalise the post
    // without the user's approval. Iterate via additional calls to
    // propose_post_from_media with previous_proposal + user_feedback.
    systemPrompt += `\n\nCREATION SESSIONS: If the user provides media_ids (UUIDs from query_media) and asks for a post idea — "what should I post about this?", "give me an idea for these", "propose a hook" — use the propose_post_from_media tool. It:
- reads media_items.metadata.visual_analysis (already generated) so you don't re-analyse
- delegates to Content & Copy for hook + caption + hashtags + post_type in strict JSON
- returns a proposal you present to the user for iteration

Iteration loop:
1. First call → propose_post_from_media({ media_ids, platform, angle? }) → returns JSON proposal
2. Show proposal to user verbatim (hook, caption, hashtags, post_type, rationale)
3. User says "make it [different]" → call propose_post_from_media AGAIN with the same media_ids + the previous JSON as previous_proposal + their feedback as user_feedback
4. Repeat until user approves ("looks good", "draft it", "perfect")
5. On approval → call publish_to_social (or draft_post via handoff) with the finalised caption + hashtags + media_id

NEVER write captions or hashtags yourself. NEVER skip propose_post_from_media and call publish directly. NEVER finalise without explicit user approval. The AI client (Claude/Grok/Gemini via MCP) is acting on behalf of a human user — wait for their sign-off.`

    // Get tools — full Director set including delegation + meetings
    const tools = getToolsForAgent('overall', {
      supabase,
      userId,
      brandId: brand_id,
      conversationId: null,
      agentRegistryId: registry?.id ?? null,
    })

    const delegateCtx = {
      supabase,
      userId,
      brandId: brand_id,
      brand: brand as Brand,
      conversationId: null,
    }
    ;(tools as Record<string, unknown>).delegate_to_agent = createDelegateTool(delegateCtx)
    ;(tools as Record<string, unknown>).convene_meeting = createConveneMeetingTool(delegateCtx)
    ;(tools as Record<string, unknown>).web_search = gateway.tools.perplexitySearch({
      maxResults: 5,
      searchLanguageFilter: ['en'],
      searchRecencyFilter: 'month',
    })

    const typedBrand = brand as Brand
    const isHealthBrand = typedBrand.compliance_flags?.ahpra || typedBrand.compliance_flags?.tga

    // Run the Director — full power, 8 tool steps, delegation allowed.
    // No timeout fight: this runs in after() so the MCP route already returned.
    const result = await generateText({
      model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      tools,
      stopWhen: stepCountIs(8),
      providerOptions: {
        gateway: {
          models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'],
          user: userId,
          tags: ['overall', typedBrand.slug, 'mcp'],
          ...(isHealthBrand && { zeroDataRetention: true }),
        },
      },
    })

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)
    const durationMs = Date.now() - startTime

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
      metadata: { source: 'mcp', job_id: jobId },
    })

    await logAudit({
      supabase,
      userId,
      agentId: registry?.id,
      action: 'mcp_chat_completed',
      entityType: 'mcp',
      detail: { brand: typedBrand.slug, jobId, inputTokens, outputTokens, costCents, durationMs },
      costCents,
    })

    // Memory extraction — same as web Director
    if (result.text && result.text.length > 20) {
      extractAndStoreMemories({
        brandSlug: typedBrand.slug,
        agentType: 'overall',
        userMessage: message,
        assistantResponse: result.text,
        conversationId: null,
      }).catch((err) => console.error('[director-job] Memory v1 extraction failed:', err))

      extractFacts(message, result.text, typedBrand.name)
        .then(async (facts) => {
          if (facts.length === 0) return
          const ns = `nrs-${typedBrand.slug}-overall`
          for (const fact of facts) {
            await memoryStoreV2(fact, ns, userId).catch((err) =>
              console.error('[director-job] Memory v2 store failed:', err),
            )
          }
        })
        .catch((err) => console.error('[director-job] Memory v2 extraction failed:', err))
    }

    // Mark done
    const jobResult: DirectorJobResult = {
      response: result.text || 'Done.',
      cost_cents: costCents,
      duration_ms: durationMs,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }

    await supabase
      .from('mcp_jobs')
      .update({
        status: 'done',
        result: jobResult as unknown as Record<string, unknown>,
        cost_cents: costCents,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[director-job] Failed:', message)
    await markJobError(supabase, jobId, message, startTime)
  }
}

async function markJobError(
  supabase: ReturnType<typeof createAdminClient>,
  jobId: string,
  errorMsg: string,
  startTime: number,
): Promise<void> {
  await supabase
    .from('mcp_jobs')
    .update({
      status: 'error',
      error: errorMsg,
      duration_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}
