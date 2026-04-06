import type { Brand, AgentConfig } from '@/types/database'
import { getComplianceRules } from './compliance-rules'
import { getMarketingKnowledge } from './knowledge/au-health-marketing-2025'
import { getSocialMediaKnowledge } from './knowledge/social-media-benchmarks'
import { getBrandPortfolioContext } from './knowledge/brand-portfolio'
import { memorySearch } from '@/lib/ruflo/client'
import { memorySearchV2 } from '@/lib/memory/store'
import { getNamespace, getGlobalNamespace, getBrandNamespace } from '@/lib/ruflo/namespaces'
import { getSessionMemoryForPrompt } from '@/lib/memory/session-memory'

export function buildSystemPrompt(brand: Brand, agentConfig: AgentConfig, userWorkContext?: string | null, siblingBrands?: Partial<Brand>[], proformaSummary?: string | null): string {
  const sections: string[] = []

  // Base agency rules
  sections.push(`You are working for ${brand.name} as part of NotRealSmart, an AI marketing agency.

Current date: ${new Date().toLocaleDateString('en-AU', { dateStyle: 'full' })}

Core rules:
- ANSWER THE QUESTION FIRST. Lead with a direct answer to what the user asked. Then expand with details, suggestions, or next steps. Never skip the answer to jump into actions or tool calls. If the user asks "can you see X?" — say yes or no FIRST, then show what you found.
- Write in Australian English (colour, behaviour, organisation, optimise, analyse, licence/license, practise/practice)
- Produce finished, publish-ready outputs — not drafts, not outlines
- Use markdown formatting for all outputs
- When producing a deliverable, clearly label the platform, format, and character/word count
- Be direct and actionable — no filler, no preamble
- The user is time-poor — give complete, ready-to-use outputs, not suggestions or outlines`)

  // Literacy-adaptive communication style
  sections.push(`## Communication Style
- The user is a business owner, not a marketer. They may not know marketing jargon.
- If you use a term like "SEO", "CRO", "CTR", "GEO", or any acronym — explain it in brackets on first use. Example: "SEO (how Google finds your website)"
- Never assume the user knows what a marketing concept means. Lead with the benefit, then name the technique.
- If the user seems confused or asks "what does that mean?", switch to simpler language for the rest of the conversation.
- Match the user's language level. If they write casually, respond casually. If they write formally, respond formally.
- Use Australian English throughout (colour, behaviour, organisation, optimise, analyse).

## How to Work With the User
- You are the ONLY agent the user talks to. They don't know about departments. When you delegate work to specialists, present it as YOUR work: "Here's what I've written" not "The content team wrote this."
- When you use tools like delegate_to_agent or convene_meeting, the user sees results but never department names. Frame it as: "I've put together a comprehensive audit" not "I convened SEO, Content, and Analytics departments."
- The user's experience is: one brand, one conversation, one marketing person (you). Everything else is invisible.
- You are a COLLABORATIVE partner, not an automation machine.
- Show ONE piece of work at a time. Wait for feedback before moving on.
- Never dump a batch of 10+ items and say "approve all." Present one, get a reaction, iterate.
- After showing a draft, ask: "Want me to change anything? Or should I move on to the next one?"
- If the user says something is missing from their brand profile (socials, competitors, etc.), collect it conversationally and save it — don't send them to a settings page.
- When the user wants to add a new brand, ask them about it conversationally: name, website, what they do, who their customers are. Use the save_brand_info tool to create the brand. NEVER send them to a form or settings page.
- When the user mentions social media profiles, competitors, or products — save them immediately using save_brand_info with action 'update'. Don't ask them to go to Brand Settings.
- Suggest what to do next, but let the user decide. "I could write an Instagram post about this, or a LinkedIn article — which sounds better?"
- Remember preferences. If the user says "skip Facebook" or "I like punchy captions", carry that forward.
- Never publish or schedule anything without explicit approval.
- Explain your reasoning briefly: "I wrote this casually because your audience skews younger."
- You are a marketing person having a conversation, not a content factory.

## Learning from the User
When the user expresses a preference about design, content style, posting frequency, platform choices, or brand presentation:
- Acknowledge it naturally: "Got it, I'll remember that for next time."
- The memory system will automatically save it for future conversations.
- Always check past memories before suggesting defaults — the user's preferences override generic best practices.
- If the user says "I like bold colours" or "never use stock photos" or "always include pricing" — treat it as a permanent rule for this brand until told otherwise.
- If you notice a pattern (e.g. the user always edits out emojis), proactively adapt: "I noticed you prefer no emojis — I'll skip them from now on."

## Creative Studio — Be the Guide
When the user is creating content (posts, videos, designs, campaigns), YOU drive the conversation. Don't wait for them to fill forms — ask them directly:

1. **WHAT** — "What do you want to create? A post, video, design, email, or something else?"
2. **WHERE** — "Which platforms should this go to? I can see you've got [list connected platforms] connected." Show only platforms they actually have connected via Mixpost.
3. **HOW** — "What's the vibe? Fun and playful, professional, bold, educational? Should I match your usual brand voice or try something different?"
4. **WHEN** — "Want to post this now, or schedule it for a better time? I can suggest the best times based on your audience."

After getting answers, DO the work:
- Write the caption/script/copy
- Generate or select visuals (Canva for graphics, HeyGen for video)
- Show a preview and ask for approval
- Schedule or publish only when they say go

If the user sends a vague request like "make me a post" or "I need content":
- Don't ask 10 questions. Ask the MOST important one first (usually: what's it about?)
- Use what you already know about the brand (strategy, pillars, voice, recent content) to fill in the rest
- Present a complete draft, then refine based on feedback

If the user sends a specific request like "post about our new winter special on Instagram":
- Just do it. Write the caption, suggest an image, show it for approval. Don't ask unnecessary questions when the brief is clear.

## Guided Onboarding — PROACTIVE SETUP
When a brand is missing key information, DON'T list what's missing. GUIDE the user through setup:
- **No channel strategy?** Ask: "Where are your customers? Pick the platforms that matter — Instagram, TikTok, LinkedIn, Facebook, YouTube — and I'll build your strategy around them." Then use save_brand_info to set the channel_strategy.
- **No Brand DNA?** Ask: "What should your brand never say? Any words or phrases that don't fit? Any rules about how you communicate?" Then set brand_dna_constraints.
- **No inspiration?** Ask: "Is there a brand you admire? Doesn't have to be in your industry. A brand whose marketing makes you think 'I want that energy.'" Then use add_inspiration to store it.
- **No competitors?** Ask: "Who are you competing against? Give me names or websites and I'll research them." Then use save_brand_info to save them.
- Do ONE setup question at a time. Don't dump all questions at once. After each answer, save it and move to the next missing item.
- After setup is complete, suggest their first action: "You're all set. Want me to fill your content calendar for the next 2 weeks?"
- If the user skips a question, move on. Don't insist. Come back to it later naturally.

## Competitive Positioning — CRITICAL
- Every piece of content you create must consider: what makes this brand DIFFERENT from competitors?
- If the brand has competitors listed, study them. Understand what they offer and what THIS brand does better.
- When writing social posts, ads, landing pages, emails — always lead with the brand's unique differentiators. Not generic benefits.
- If a competitor does the same thing, find what THIS brand does differently: price, features, approach, values, origin story, compliance, technology.
- When the brand is in a competitive market, position AGAINST competitors indirectly: "Unlike other scribes, TeleScribe includes built-in calling" not "Heidi Health doesn't have calling."
- If you notice the brand's products overlap with competitors but have unique features — highlight those features in EVERY piece of content.
- Always ask yourself: "Would this post work for any brand in this space, or is it specific to THIS brand?" If it's generic, rewrite it with specifics.
- The Director should proactively suggest competitive angles: "Your competitors charge $200-300/mo but you're $69 — we should lead with that."
- Marketing is not just creating content. It's positioning a product in a market. Every output should strengthen the brand's position.`)

  // User work context (how the founder operates)
  if (userWorkContext) {
    sections.push(`## About the User\n${userWorkContext}`)
  }

  // Brand context
  sections.push(buildBrandContext(brand))

  // Master Marketing Proforma summary
  if (proformaSummary) {
    sections.push(`## Master Marketing Proforma

${proformaSummary}

### How to Use the Proforma
- You have access to a Master Marketing Proforma for this brand — a living document that is the single source of truth.
- Before creating ANY content, check the proforma. Use read_proforma to review the relevant section.
- After every significant conversation, update the proforma with decisions, wins, and learnings using update_proforma (Director only).
- If a proforma section is STALE (not reviewed within its cadence), flag it to the user and offer to update it.
- The proforma is not aspirational — it reflects current truth. If information is wrong, update it immediately.`)
  }

  // Agent-specific instructions
  sections.push(agentConfig.system_prompt)

  // Marketing intelligence (filtered by agent type)
  const knowledge = getMarketingKnowledge(agentConfig.agent_type)
  if (knowledge) {
    sections.push(knowledge)
  }

  // Social media & video intelligence (filtered by agent type)
  const socialKnowledge = getSocialMediaKnowledge(agentConfig.agent_type)
  if (socialKnowledge) {
    sections.push(socialKnowledge)
  }

  // Brand ecosystem — sibling brands owned by the same user
  if (siblingBrands?.length) {
    const ecosystemLines = [`## Brand Ecosystem\nThe owner also runs these related brands — use this for cross-promotion and ecosystem awareness:\n`]
    for (const sib of siblingBrands) {
      const products = sib.products_services?.map(p => p.name).join(', ') || ''
      ecosystemLines.push(`- **${sib.name}** (${sib.niche || 'general'})${sib.description ? ': ' + sib.description : ''}${products ? ' — Products: ' + products : ''}${sib.website_url ? ' — ' + sib.website_url : ''}`)
    }
    ecosystemLines.push(`\nWhen relevant, suggest cross-promotion opportunities between ${brand.name} and these related brands. They share the same owner and can strengthen each other's marketing.`)
    sections.push(ecosystemLines.join('\n'))
  }

  // Compliance layer (conditional)
  if (brand.compliance_flags.ahpra || brand.compliance_flags.tga) {
    sections.push(getComplianceRules(brand.compliance_flags))
  }

  return sections.join('\n\n---\n\n')
}

function buildBrandContext(brand: Brand): string {
  const lines: string[] = [
    `## Brand Context`,
    `**Brand:** ${brand.name}`,
  ]

  if (brand.tagline) lines.push(`**Tagline:** ${brand.tagline}`)
  if (brand.description) lines.push(`**Description:** ${brand.description}`)
  if (brand.website_url) lines.push(`**Website:** ${brand.website_url}`)
  if (brand.github_url) lines.push(`**GitHub:** ${brand.github_url}`)
  if (brand.social_urls && Object.keys(brand.social_urls).length > 0) {
    const socials = Object.entries(brand.social_urls).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
    if (socials) lines.push(`**Social Media:** ${socials}`)
  }
  lines.push(`**Niche:** ${brand.niche}`)
  if (brand.business_stage) {
    const stageDescriptions: Record<string, string> = {
      idea: 'Idea stage — not yet built. Focus on validation, planning, and early positioning.',
      mvp: 'MVP stage — product exists but not launched. Focus on launch prep, early adopters, waitlist growth.',
      launch: 'Launch stage — just launched or recently live. Focus on awareness, first customers, initial traction.',
      growth: 'Growth stage — established product with customers. Focus on scaling, retention, market share.',
      scale: 'Scale stage — significant traction, expanding. Focus on efficiency, new markets, brand authority.',
      mature: 'Mature stage — established market position. Focus on retention, innovation, competitive defence.',
    }
    lines.push(`**Business Stage:** ${brand.business_stage} — ${stageDescriptions[brand.business_stage] ?? brand.business_stage}`)
  }

  // Marketing status
  if (brand.marketing_status && brand.marketing_status !== 'unknown') {
    const marketingDescriptions: Record<string, string> = {
      no_marketing: 'Zero marketing presence. Everything needs to be built from scratch.',
      early_stage: 'Early stage — has basic presence but no real strategy or consistent execution.',
      needs_strategy: 'Has some marketing assets but no cohesive strategy. Needs direction.',
      active: 'Active marketing in progress. Focus on optimisation and expansion.',
      scaling: 'Marketing is working. Focus on scaling what works and entering new channels.',
    }
    lines.push(`**Marketing Status:** ${brand.marketing_status} — ${marketingDescriptions[brand.marketing_status] ?? brand.marketing_status}`)
  }
  if (brand.marketing_notes) {
    lines.push(`**Marketing Notes:** ${brand.marketing_notes}`)
  }

  // Tone of voice
  if (brand.tone_of_voice && Object.keys(brand.tone_of_voice).length > 0) {
    const tone = brand.tone_of_voice
    lines.push(`\n**Tone of Voice:**`)
    if (tone.formality) lines.push(`- Formality: ${tone.formality}`)
    if (tone.humour) lines.push(`- Humour: ${tone.humour}`)
    if (tone.keywords?.length) lines.push(`- Key words to use: ${tone.keywords.join(', ')}`)
    if (tone.avoid_words?.length) lines.push(`- Words to AVOID: ${tone.avoid_words.join(', ')}`)
  }

  // Target audience
  if (brand.target_audience && Object.keys(brand.target_audience).length > 0) {
    const audience = brand.target_audience
    lines.push(`\n**Target Audience:**`)
    if (audience.demographics) lines.push(`- Demographics: ${audience.demographics}`)
    if (audience.pain_points?.length) lines.push(`- Pain points: ${audience.pain_points.join('; ')}`)
    if (audience.desires?.length) lines.push(`- Desires: ${audience.desires.join('; ')}`)
  }

  // Content pillars
  if (brand.content_pillars?.length) {
    lines.push(`\n**Content Pillars:** ${brand.content_pillars.join(', ')}`)
  }

  // Competitors
  if (brand.competitors?.length) {
    const activeComps = brand.competitors.filter(c => c.is_active !== false)
    if (activeComps.length > 0) {
      lines.push(`\n**Known Competitors:**`)
      for (const comp of activeComps) {
        const catLabel = comp.category ? `[${comp.category.toUpperCase()}]` : ''
        const whyText = comp.why ? ` — "${comp.why}"` : comp.notes ? ` — ${comp.notes}` : ''
        lines.push(`- ${comp.name} (${comp.url}) ${catLabel}${whyText}`)
      }
    }
  }

  // Competitive advantage summary — derived from competitors + products
  if (brand.competitors?.length && brand.products_services?.length) {
    lines.push(`\n**Your Competitive Edge:**`)
    lines.push(`You have ${brand.competitors.length} known competitor(s) and ${brand.products_services.length} product(s). When creating content, ALWAYS lead with what makes this brand unique compared to competitors. Generic content that could apply to any brand in this space is not acceptable.`)
    if (brand.products_services.some(p => p.usps?.length)) {
      const allUsps = brand.products_services.flatMap(p => p.usps || [])
      if (allUsps.length > 0) {
        lines.push(`Key USPs to highlight: ${allUsps.join(', ')}`)
      }
    }
  }

  // Products & Services
  if (brand.products_services?.length) {
    lines.push(`\n**Products & Services:**`)
    for (const prod of brand.products_services) {
      lines.push(`- ${prod.name}: ${prod.description}`)
      if (prod.price) lines.push(`  Price: ${prod.price}`)
      if (prod.target_audience) lines.push(`  Target Audience: ${prod.target_audience}`)
      if (prod.usps?.length) lines.push(`  USPs: ${prod.usps.join(', ')}`)
      if (prod.compliance_notes) lines.push(`  Compliance Notes: ${prod.compliance_notes}`)
    }
  }

  // Video Preferences
  if (brand.video_preferences && Object.keys(brand.video_preferences).length > 0) {
    const vp = brand.video_preferences
    lines.push(`\n**Video Presenter Preferences:**`)
    if (vp.avatar_id) lines.push(`- Avatar ID: ${vp.avatar_id}`)
    if (vp.accent) lines.push(`- Accent: ${vp.accent}`)
    if (vp.presenter_style) lines.push(`- Style: ${vp.presenter_style}`)
    if (vp.background_preference) lines.push(`- Background: ${vp.background_preference}`)
  }

  // GitHub Context
  if (brand.github_context) {
    lines.push(`\n**Technical/GitHub Context:**\n${brand.github_context}`)
  }

  // Brand DNA Constraints — deterministic rules, not adjectives (Layer 0)
  const dna = brand.brand_dna_constraints
  if (dna && Object.keys(dna).length > 0) {
    lines.push(`\n**Brand DNA Constraints (IMMUTABLE — these override everything):**`)
    if (dna.voice_rules?.length) {
      lines.push(`Voice rules:`)
      for (const rule of dna.voice_rules) lines.push(`- ${rule}`)
    }
    if (dna.banned_words?.length) {
      lines.push(`BANNED words (never use): ${dna.banned_words.join(', ')}`)
    }
    if (dna.founder_voice) {
      lines.push(`Founder voice: ${dna.founder_voice.name} — ${dna.founder_voice.framing === 'first_person' ? 'first person' : 'third person'} on ${dna.founder_voice.platforms.join(', ')}`)
    }
    if (dna.content_philosophy) {
      lines.push(`Content philosophy: ${dna.content_philosophy.replace(/_/g, ' ')}`)
    }
    if (dna.never_do?.length) {
      lines.push(`NEVER do: ${dna.never_do.map(d => d.replace(/_/g, ' ')).join(', ')}`)
    }
    if (dna.narrative_world) {
      lines.push(`Brand narrative: ${dna.narrative_world}`)
    }
    lines.push(`These constraints are IMMUTABLE. If a task instruction conflicts with Brand DNA, Brand DNA wins — always.`)
  }

  // Channel Strategy — the Marketing DNA that drives all content decisions
  const strategy = brand.channel_strategy
  if (strategy?.channels && Object.keys(strategy.channels).length > 0) {
    const channels = Object.entries(strategy.channels)
      .filter(([, pct]) => pct > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([ch, pct]) => `${ch}: ${pct}%`)
      .join(', ')

    lines.push(`\n**Channel Strategy (Marketing DNA — FOLLOW THIS):**`)
    lines.push(`Channel allocation: ${channels}`)
    if (strategy.content_mix) {
      const mix = Object.entries(strategy.content_mix)
        .filter(([, pct]) => pct > 0)
        .map(([type, pct]) => `${type.replace(/_/g, ' ')}: ${pct}%`)
        .join(', ')
      lines.push(`Content mix: ${mix}`)
    }
    if (strategy.posting_frequency) lines.push(`Posting frequency: ${strategy.posting_frequency.replace(/_/g, ' ')}`)
    if (strategy.growth_approach) lines.push(`Growth approach: ${strategy.growth_approach}`)
    if (strategy.aeo_priority) lines.push(`AI Engine Optimisation (AEO): HIGH PRIORITY — optimise all content for AI search citation`)
    if (strategy.avoid?.length) lines.push(`AVOID: ${strategy.avoid.map(a => a.replace(/_/g, ' ')).join(', ')}`)
    if (strategy.notes) lines.push(`Strategy notes: ${strategy.notes}`)
    lines.push(`When creating content, filling calendars, or planning campaigns — ALWAYS follow this channel allocation. Don't distribute equally unless the strategy says so.`)
  }

  // Post Signature — branding appended to all content
  const sig = brand.post_signature
  if (sig?.enabled && sig.text) {
    lines.push(`\n**Post Signature (MANDATORY):**`)
    lines.push(`Every piece of content you produce (social posts, blog articles, email campaigns, video scripts, ad copy) MUST include this attribution at the end:`)
    if (sig.format === 'mention' && sig.mention) {
      lines.push(`- Append this at the very end of every caption/post: ${sig.mention}`)
    } else if (sig.format === 'hashtag' && sig.hashtag) {
      lines.push(`- Include this hashtag in every post: ${sig.hashtag}`)
    } else {
      lines.push(`- Append this line at the end of every output: "${sig.text}"`)
    }
    lines.push(`This is non-negotiable branding — never skip it.`)
  }

  // Watermark & logo instructions for visual content
  const wm = brand.watermark
  if (wm?.logo_enabled && brand.logo_url) {
    lines.push(`\n**Brand Logo Watermark (VISUAL CONTENT):**`)
    lines.push(`When creating visual content (images, graphics, designs via Canva, video thumbnails), include the brand logo (${brand.logo_url}) as a watermark in the ${wm.logo_position ?? 'bottom-right'} corner at ${Math.round((wm.logo_opacity ?? 0.5) * 100)}% opacity.`)
    lines.push(`For Canva designs: add the logo as an overlay element positioned ${wm.logo_position ?? 'bottom-right'}.`)
    lines.push(`For HeyGen videos: include the logo in the video generation request.`)
    lines.push(`This is a mandatory brand requirement — every visual output must include the logo watermark.`)
  }
  if (wm?.nrs_watermark_enabled) {
    const nrsText = wm.nrs_watermark_text ?? 'Created with NotRealSmart Digital Agency - Australia'
    lines.push(`\n**NotRealSmart Signature (VISUAL CONTENT):**`)
    lines.push(`Add the signature "${nrsText}" as a small, subtle text watermark on all generated visual content.`)
    lines.push(`For videos: include in end credits or as a small lower-third text.`)
    lines.push(`For images/graphics: add as small text near the bottom edge.`)
  }

  // Extra context
  if (brand.extra_context) {
    const cleanedContext = brand.extra_context.replace(/\n---DIGEST_SETTINGS---[\s\S]*$/, '').trim()
    if (cleanedContext) {
      lines.push(`\n**Additional Context:** ${cleanedContext}`)
    }
  }

  // Deep brand context from portfolio scan
  const portfolioContext = getBrandPortfolioContext(brand.slug)
  if (portfolioContext) {
    lines.push(portfolioContext)
  }

  // Pricing context
  const brandAny = brand as unknown as Record<string, unknown>
  const pricingModel = brandAny.pricing_model as string | undefined
  const pricingDetails = brandAny.pricing_details as Record<string, unknown> | undefined
  if (pricingModel || pricingDetails) {
    lines.push(`\n## Pricing`)
    if (pricingModel) lines.push(`**Model:** ${pricingModel}`)
    if (pricingDetails) {
      const details = { ...pricingDetails }
      const competitors = details.competitors as Array<{ name: string; price: number; model: string }> | undefined
      delete details.competitors
      const detailStr = Object.entries(details)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
        .join('\n')
      if (detailStr) lines.push(detailStr)
      if (competitors?.length) {
        lines.push(`\n**Competitor Pricing:**`)
        for (const c of competitors) {
          lines.push(`- ${c.name}: $${c.price}/mo (${c.model})`)
        }
      }
    }
  }

  // Team & workflow context
  const teamContext = brandAny.team_context as string | undefined
  const socialStrategy = brandAny.social_strategy as string | undefined
  const devTools = brandAny.dev_tools as string | undefined

  if (teamContext || socialStrategy || devTools) {
    lines.push(`\n## How This Brand Operates`)
    if (teamContext) lines.push(`**Team:** ${teamContext}`)
    if (socialStrategy) lines.push(`**Social Media Strategy:** ${socialStrategy}`)
    if (devTools) lines.push(`**Development Tools:** ${devTools}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Memory-enhanced prompt builder
// ---------------------------------------------------------------------------

export async function buildSystemPromptWithMemory(
  brand: Brand,
  agentConfig: AgentConfig,
  latestMessage: string,
  userWorkContext?: string | null,
  siblingBrands?: Partial<Brand>[],
  proformaSummary?: string | null,
  userId?: string | null
): Promise<{ prompt: string; memoryCount: number }> {
  const basePrompt = buildSystemPrompt(brand, agentConfig, userWorkContext, siblingBrands, proformaSummary)

  try {
    const namespace = getNamespace(brand.slug, agentConfig.agent_type)

    // Try semantic search (v2) first, fall back to keyword search (v1)
    let allMemories: { key: string; value: string | Record<string, unknown>; similarity?: number; memory_type?: string; confidence?: number; tags?: string[] }[] = []

    if (userId) {
      // v2: Semantic vector search
      const memories = await memorySearchV2(latestMessage, namespace, userId, 10)
      let crossMemories: typeof memories = []
      if (agentConfig.agent_type === 'overall') {
        crossMemories = await memorySearchV2(latestMessage, getGlobalNamespace(), userId, 5)
      } else {
        crossMemories = await memorySearchV2(latestMessage, getBrandNamespace(brand.slug), userId, 5)
      }
      allMemories = [...memories, ...crossMemories]
    }

    // Fallback to v1 keyword search if v2 returned nothing
    if (allMemories.length === 0) {
      const memories = await memorySearch(latestMessage, namespace, 10)
      let crossMemories: typeof memories = []
      if (agentConfig.agent_type === 'overall') {
        crossMemories = await memorySearch(latestMessage, getGlobalNamespace(), 5)
      } else {
        crossMemories = await memorySearch(latestMessage, getBrandNamespace(brand.slug), 5)
      }
      allMemories = [...memories, ...crossMemories]
    }

    if (allMemories.length === 0) {
      return { prompt: basePrompt, memoryCount: 0 }
    }

    // Sort: brand_rules first, then preferences, then decisions, then others
    const typePriority: Record<string, number> = {
      brand_rule: 0, preference: 1, decision: 2, observation: 3, metric: 4, conversation: 5,
    }
    allMemories.sort((a, b) => {
      const aPri = typePriority[(a as { memory_type?: string }).memory_type ?? 'conversation'] ?? 5
      const bPri = typePriority[(b as { memory_type?: string }).memory_type ?? 'conversation'] ?? 5
      return aPri - bPri
    })

    // Format memories with type labels for the agent
    const memoryLines = allMemories.map((m, i) => {
      const val = typeof m.value === 'string' ? m.value : JSON.stringify(m.value)
      const truncated = val.length > 300 ? val.slice(0, 300) + '...' : val
      const typeLabel = (m as { memory_type?: string }).memory_type ?? 'note'
      const conf = (m as { confidence?: number }).confidence
      const confLabel = conf && conf >= 0.8 ? 'high' : conf && conf >= 0.5 ? 'medium' : 'low'
      return `${i + 1}. [${typeLabel}, ${confLabel} confidence] ${truncated}`
    })

    const memorySection = `## What I Remember About This Brand

These are facts I've learned from previous conversations. Brand rules are non-negotiable. Preferences guide my work unless the user says otherwise.

${memoryLines.join('\n')}

Use this context to provide continuity. Apply brand rules strictly. Follow preferences unless overridden. Reference past decisions where relevant.`

    // Insert memory section between brand context and agent instructions
    const sections = basePrompt.split('\n\n---\n\n')
    // Insert after brand context (index 1), before agent instructions
    if (sections.length >= 3) {
      sections.splice(2, 0, memorySection)
    } else {
      sections.push(memorySection)
    }

    // Session memory — compounding brand knowledge (Anthropic pattern)
    if (userId) {
      try {
        const sessionMemory = await getSessionMemoryForPrompt(brand.slug, userId)
        if (sessionMemory) {
          const sessionSection = `## Brand Learning — What I've Learned Over Time

This is my accumulated knowledge about ${brand.name} from past conversations. This compounds over time — each session adds to it.

${sessionMemory}

Apply these learnings. Brand rules are non-negotiable. Preferences guide my work unless the user overrides them. Use past performance data to inform content decisions.`

          // Insert after the individual memories section (which was just spliced in at index 2)
          if (sections.length >= 4) {
            sections.splice(3, 0, sessionSection)
          } else {
            sections.push(sessionSection)
          }
        }
      } catch (err) {
        console.error('[prompt-builder] Session memory retrieval failed:', err)
      }
    }

    return {
      prompt: sections.join('\n\n---\n\n'),
      memoryCount: allMemories.length,
    }
  } catch (error) {
    console.error('[prompt-builder] Memory retrieval failed, using base prompt:', error)
    return { prompt: basePrompt, memoryCount: 0 }
  }
}
