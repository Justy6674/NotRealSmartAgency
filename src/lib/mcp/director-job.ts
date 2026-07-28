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
import { buildMarketingSkillContext } from '@/lib/agents/marketing-skills'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import { extractAndStoreMemories } from '@/lib/ruflo/memory-extractor'
import { extractFacts } from '@/lib/memory/fact-extractor'
import { extractExplicitFounderLearnings } from '@/lib/memory/founder-learning'
import { memoryStoreV2 } from '@/lib/memory/store'
import { ensureProforma } from '@/lib/proforma/auto-populate'
import { CADENCE_DAYS, type ReviewCadence } from '@/lib/proforma/sections'
import { getDirectorCompletion } from './director-completion'
import { scanWebsiteCore } from '@/lib/agents/tools/scan-website'
import {
  buildWebsiteScanGroundingDirective,
  isWebsiteScanRequest,
  resolveWebsiteScanUrl,
} from '@/lib/agents/website-scan-directive'
import type { Brand, AgentConfig } from '@/types/database'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { buildTelegramExecutionContract } from '@/lib/telegram/telegram-execution-contract'
import { getActiveGoal } from '@/lib/agents/goal-loop'
import {
  estimateGatewayCost,
  getGatewayRouteProviderOptions,
  resolveAgentModelRoute,
} from '@/lib/ai/model-routing'
import {
  buildTelegramResponseRepairPrompt,
  needsTelegramResponseRepair,
} from '@/lib/telegram/telegram-response-quality'
import {
  buildTelegramModelMessages,
  buildTelegramThreadContract,
  loadTelegramThreadHistory,
  resolveTelegramWorkMessage,
} from '@/lib/telegram/telegram-thread'
import {
  matchesDirectorJobScope,
  type DirectorExecutionScope,
} from '@/lib/agents/director-execution'

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
  execution: DirectorExecutionScope,
  input: DirectorJobInput,
): Promise<void> {
  const supabase = createAdminClient()
  const startTime = Date.now()
  const userId = execution.actorUserId

  // Mark running
  await supabase
    .from('mcp_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)

  try {
    const { brand_id, message } = input

    if (brand_id !== execution.projectId) {
      await markJobError(supabase, jobId, 'Job project does not match its execution scope.', startTime)
      return
    }

    const { data: scopedJob, error: scopedJobError } = await supabase
      .from('mcp_jobs')
      .select('user_id, brand_id, channel, project_access_grant_id, api_key_id')
      .eq('id', jobId)
      .single()

    if (scopedJobError || !scopedJob || !matchesDirectorJobScope(execution, scopedJob)) {
      await markJobError(supabase, jobId, 'Job scope could not be verified.', startTime)
      return
    }

    const inspection = inspectMarketingInput(message)
    if (!inspection.allowed) {
      await markJobError(supabase, jobId, inspection.reason, startTime)
      return
    }

    // The grant is the authority; querying owner-wide access here would widen
    // the scope after the job was safely queued.
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
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

    // A short request such as "scan the site" is a deterministic action, not
    // a vague creative brief. Scan first, then constrain the response to the
    // actual page evidence so stale memory cannot masquerade as a live audit.
    let websiteScanDirective: string | null = null
    if (isWebsiteScanRequest(message)) {
      const websiteUrl = resolveWebsiteScanUrl(message, (brand as Brand).website_url)
      if (!websiteUrl) {
        await markJobError(supabase, jobId, 'This project does not have a website configured for scanning.', startTime)
        return
      }

      const websiteScan = await scanWebsiteCore(supabase, userId, brand_id, websiteUrl, 'messaging', jobId)
      if ('error' in websiteScan) {
        await markJobError(supabase, jobId, websiteScan.error, startTime)
        return
      }
      websiteScanDirective = buildWebsiteScanGroundingDirective(websiteScan)
    }

    // Ordinary Director work loads only the active project's proforma. Owner
    // work context and sibling projects are never prompt context by default.
    const proformaSections = await ensureProforma(supabase, brand as Brand)

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

    // Telegram reconstructs short-term thread from recent completed jobs for
    // this exact project grant so follow-ups ("try again", "what did I ask")
    // resolve against prior turns instead of a blank slate.
    let telegramWorkMessage = message
    let modelMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: message },
    ]
    let telegramThreadContract = ''
    if (execution.channel === 'telegram') {
      const thread = await loadTelegramThreadHistory(supabase, {
        userId,
        brandId: brand_id,
        grantId: execution.projectAccessGrantId,
        excludeJobId: jobId,
      })
      telegramWorkMessage = resolveTelegramWorkMessage(
        message,
        thread.map((turn) => turn.userMessage),
      )
      modelMessages = buildTelegramModelMessages(thread, message)
      telegramThreadContract = buildTelegramThreadContract(
        message,
        telegramWorkMessage,
        thread.length > 0,
      )
    }

    // Build system prompt with memory
    const activeGoal = await getActiveGoal(supabase, userId, brand_id)
    let { prompt: systemPrompt } = await buildSystemPromptWithMemory(
      brand as Brand,
      agentConfig as AgentConfig,
      telegramWorkMessage,
      { proformaSummary, deliveryChannel: execution.channel, activeGoal },
      userId,
    )

    // ── Injection 1: routing hints ──
    // On Telegram follow-ups, route against the resolved prior ask so Intent
    // still points at the real marketing work.
    const routingMessage = execution.channel === 'telegram' ? telegramWorkMessage : message
    const routing = classifyIntent(routingMessage)
    const multiRouting = classifyIntentMulti(routingMessage)
    const routingContext = websiteScanDirective ? null : buildRoutingContext(routing, multiRouting)
    if (routingContext) {
      systemPrompt += '\n\n---\n\n' + routingContext
    }
    systemPrompt += `\n\n---\n\n${buildMarketingSkillContext(message, execution.channel)}`

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
- A mention of another brand NEVER changes this job's project scope. Explain that this request remains scoped to the current project; the user must start a separately scoped request through the project picker or by selecting that project in MCP.`

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

    // ── Injection 0: IDENTITY ENFORCEMENT — you are a marketing director, not a tech assistant ──
    // Justin's repeated complaint: the Director keeps describing media files
    // technically ("dashboard walkthrough", "professional screen recording with
    // your voice", "broader product overview") instead of doing strategic
    // marketing analysis. The base persona in agent_configs is the right kind
    // of marketing director, but interactions consistently drift toward
    // technical helper mode. This injection re-anchors the identity at the
    // top of every system prompt assembly so technical-describer mode is
    // forbidden structurally.
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

## Example — what the user just got vs what you should produce

The user uploaded a 2:23 walkthrough of TeleScribe's transcription dashboard. They asked you to review their media for marketing.

WRONG (what you produced):
> telescribeconsoleCleanShot 2026-04-10 (2:23):
> Content: Dashboard walkthrough showing the main recording interface
> Speaker: You explaining "When you're ready to record, this is the main dashboard right here"
> Perfect for: Main transcription screen demonstration

RIGHT (what you should produce):
> The 2:23 dashboard video is the strongest piece you have, and you're sitting on a hook you haven't named yet.
>
> Hook: "When you're ready to record, this is the main dashboard right here." Cut to you saying that line on a tight close-up of the record button — that's a 1.5-second pattern interrupt that earns the next 5 seconds. Australian GPs scrolling Facebook at 9pm have seen 40 AI scribe ads this month; they're numb to "AI-powered" claims and they trust faces.
>
> Audience: Solo + small-clinic GPs aged 35-55, tired, charting after-hours, $2-3K/month margin pressure. Their pain isn't "I need AI" — it's "I want my evenings back". Lead with the evening, not the AI.
>
> Differentiation: Heidi and Lyrebird both cost $200-300/mo and lock you into their stack. You're $69 with no extension and no PMS lock-in. The video has you as a practising clinician, not a software founder — that's an unfair advantage. Position: "Built by a clinic owner who got sick of typing notes at 9pm." Heidi's founders can't claim that.
>
> Funnel: Middle. Awareness ad runs the hook (8s vertical cut). Consideration ad runs the full 60s with the SOAP demo. Decision ad is a 15s testimonial swap-in over the dashboard footage with "$69, 14-day trial" in the lower third.
>
> Story arc: Problem (45-min documentation) → product reveal (one-click record) → outcome (SOAP appears in real time) → CTA (free trial link). The 2:23 already follows this arc — you don't need to script it, you need to cut it tight.
>
> Conversion path: Land on telescribe.com.au/free-trial. Pixel-track signups. Retarget non-converters with the price-comparison angle ($69 vs $300) at 7-day window.
>
> Platform-native treatment for Facebook: 4:5 vertical. Caption opens with the hook line in plain text (no "🎯" emoji). First 1.5s on the record button. Auto-captioned. CTA card at 0:55. Comments section pre-seeded with the trial link.
>
> Recommended cut: 0:00-0:08 hook → 0:08-0:35 dashboard demo → 0:35-0:50 SOAP generation → 0:50-1:00 CTA. ID: \`4c342177-c32c-4710-b285-867b425e7ea0\`

That's the difference between a marketing director and a tech support agent. Default to the marketing-director response. ALWAYS.

---

` + systemPrompt

    // ── Injection 6c: MANDATORY MEDIA ANALYSIS RULE ──
    // When the user asks the Director to "review my media", "suggest which
    // images would work", "what should I do with this video", or any
    // strategy/recommendation question about media items, the Director
    // MUST analyse the actual content — AI description, transcription, tags
    // — not pattern-match on the filename. The previous behaviour was to
    // call query_media (default mode='list'), get a 100-char snippet, and
    // recommend based on filename. The fix: query_media now has mode='analysis'
    // which returns the full transcript + ai_description + tags. Use it.
    systemPrompt += `\n\nMANDATORY MEDIA ANALYSIS RULE:
- When the user asks for a media review, recommendation, or strategy involving uploaded media items, you MUST call query_media with mode="analysis" so you receive the full transcription, AI description, and tags for each item.
- NEVER recommend or analyse media based on the filename alone. Filenames are not content. "telescribe-clinical-tools.png" tells you nothing about what's actually visible in the image.
- Read the AI description and the transcript. Map them to the brand's content pillars, target audience, and current campaign. Recommend specifically: which item, for which pillar, with which angle, and WHY based on the actual content.
- If an item has no ai_description or transcription, name it explicitly and offer to run /api/media/process so the next review has real data. Do not invent content for it.
- Reference media by UUID (from query_media) when recommending — never by filename — so the user can attach the right one to a post.`

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

    if (execution.channel !== 'telegram') {
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

    }

    if (execution.channel !== 'telegram') {
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

    }

    if (execution.channel === 'telegram') {
      if (telegramThreadContract) {
        systemPrompt += `\n\n${telegramThreadContract}`
      }
      const telegramExecutionContract = buildTelegramExecutionContract(message, telegramWorkMessage)
      if (telegramExecutionContract) {
        systemPrompt += `\n\n${telegramExecutionContract}`
      }
    }

    if (websiteScanDirective) {
      systemPrompt += `\n\n---\n\n${websiteScanDirective}`
    }

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
    const modelRoute = resolveAgentModelRoute({
      agentType: 'overall',
      input: message,
      isHealthBrand,
      registeredModel: registry?.model,
    })

    // Run the Director — full power, 8 tool steps, delegation allowed.
    // No timeout fight: this runs in after() so the MCP route already returned.
    // Telegram passes reconstructed thread turns; other channels stay single-turn.
    const result = await generateText({
      model: gateway(modelRoute.model),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(8),
      providerOptions: getGatewayRouteProviderOptions(modelRoute, {
        user: userId,
        tags: ['overall', typedBrand.slug, execution.channel === 'telegram' ? 'telegram' : 'mcp'],
        zeroDataRetention: isHealthBrand,
      }),
    })

    const completion = getDirectorCompletion(result)
    if (!completion.complete) {
      throw new Error(completion.reason)
    }
    let response = completion.response
    let repairInputTokens = 0
    let repairOutputTokens = 0
    let repairCostUsd = 0
    let repairCacheReadTokens = 0
    let repairCacheWriteTokens = 0
    let repairModel: string | undefined

    if (execution.channel === 'telegram' && needsTelegramResponseRepair(message, response)) {
      const repaired = await generateText({
        model: gateway(modelRoute.model),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: 'user' as const,
            content: buildTelegramResponseRepairPrompt(message, response, telegramWorkMessage),
          },
        ],
        stopWhen: stepCountIs(1),
        providerOptions: getGatewayRouteProviderOptions(modelRoute, {
          user: userId,
          tags: ['overall', typedBrand.slug, 'telegram-repair'],
          zeroDataRetention: isHealthBrand,
        }),
      })
      const repairedCompletion = getDirectorCompletion(repaired)
      if (!repairedCompletion.complete || needsTelegramResponseRepair(message, repairedCompletion.response)) {
        throw new Error('The Director did not return a completed Telegram result.')
      }
      response = repairedCompletion.response
      repairInputTokens = repaired.totalUsage?.inputTokens ?? 0
      repairOutputTokens = repaired.totalUsage?.outputTokens ?? 0
      repairModel = repaired.response.modelId || modelRoute.model
      const repairCost = estimateGatewayCost(repairModel, repaired.totalUsage)
      repairCostUsd = repairCost.usd
      repairCacheReadTokens = repairCost.cacheReadTokens
      repairCacheWriteTokens = repairCost.cacheWriteTokens
    }

    const inputTokens = (result.totalUsage?.inputTokens ?? 0) + repairInputTokens
    const outputTokens = (result.totalUsage?.outputTokens ?? 0) + repairOutputTokens
    const actualModel = result.response.modelId || modelRoute.model
    const primaryCost = estimateGatewayCost(actualModel, result.totalUsage)
    const costUsd = Number((primaryCost.usd + repairCostUsd).toFixed(9))
    const costCents = costUsd > 0 ? Math.ceil(costUsd * 100) : 0
    const durationMs = Date.now() - startTime

    if (registry) {
      await recordAgentSpend(supabase, registry.id, costCents)
    }

    await supabase.from('ai_usage').insert({
      user_id: userId,
      query_type: 'agency_overall_mcp',
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      model: actualModel,
      cost_usd: costUsd,
      metadata: {
        source: 'mcp',
        job_id: jobId,
        gateway: {
          tier: modelRoute.tier,
          pricing_model: primaryCost.pricingModel,
          repair_model: repairModel,
          cache_read_tokens: primaryCost.cacheReadTokens + repairCacheReadTokens,
          cache_write_tokens: primaryCost.cacheWriteTokens + repairCacheWriteTokens,
          budget_charge_cents: costCents,
        },
      },
    })

    await logAudit({
      supabase,
      userId,
      agentId: registry?.id,
      action: 'mcp_chat_completed',
      entityType: 'mcp',
      detail: {
        brand: typedBrand.slug,
        jobId,
        actualModel,
        repairModel,
        inputTokens,
        outputTokens,
        costCents,
        cacheReadTokens: primaryCost.cacheReadTokens + repairCacheReadTokens,
        cacheWriteTokens: primaryCost.cacheWriteTokens + repairCacheWriteTokens,
        durationMs,
      },
      costCents,
    })

    // Telegram learns direct founder corrections and preferences, never a
    // speculative conclusion generated by the Director itself.
    if (response.length > 20) {
      extractAndStoreMemories({
        brandId: typedBrand.id,
        userId,
        brandSlug: typedBrand.slug,
        agentType: 'overall',
        userMessage: message,
        assistantResponse: response,
        conversationId: null,
        captureAssistantInferences: execution.channel !== 'telegram',
        captureConversationSummary: execution.channel !== 'telegram',
      }).catch((err) => console.error('[director-job] Memory v1 extraction failed:', err))

      const facts = execution.channel === 'telegram'
        ? extractExplicitFounderLearnings(message)
        : await extractFacts(message, response, typedBrand.name)
      const ns = `nrs-${typedBrand.slug}-overall`
      for (const fact of facts) {
        await memoryStoreV2(fact, ns, userId, typedBrand.id).catch((err) =>
          console.error('[director-job] Memory v2 store failed:', err),
        )
      }
    }

    // Mark done
    const jobResult: DirectorJobResult = {
      response,
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
