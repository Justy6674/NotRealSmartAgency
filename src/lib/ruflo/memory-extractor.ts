import { memoryStore } from './client'
import { getNamespace } from './namespaces'
import type { AgentType } from '@/types/database'

/**
 * Smart memory extraction — pulls out key decisions, preferences,
 * and facts from a conversation, rather than just dumping raw text.
 */
export async function extractAndStoreMemories(params: {
  brandSlug: string
  agentType: AgentType
  userMessage: string
  assistantResponse: string
  conversationId: string | null
}): Promise<number> {
  const { brandSlug, agentType, userMessage, assistantResponse, conversationId } = params
  const namespace = getNamespace(brandSlug, agentType)
  const timestamp = new Date().toISOString()
  let memoriesStored = 0

  // Extract different types of learnings
  const extractions: { key: string; value: Record<string, unknown>; tags: string[] }[] = []

  // 1. User preferences (tone, style, format requests)
  const prefPatterns = [
    /(?:i prefer|i like|i want|always use|never use|don't use|avoid|make sure|remember that)\s+(.{10,100})/gi,
    /(?:our tone|our style|our voice|brand voice)\s+(?:is|should be)\s+(.{10,80})/gi,
  ]
  for (const pattern of prefPatterns) {
    const matches = userMessage.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `pref-${Date.now()}-${memoriesStored}`,
        value: { type: 'preference', content: match[1].trim(), source: 'user', timestamp },
        tags: [agentType, brandSlug, 'preference', 'user_preference'],
      })
      memoriesStored++
    }
  }

  // 1b. Design & visual preferences
  const designPatterns = [
    // "I like/love/prefer [X] style/design/look/colour/font/layout"
    /(?:i (?:like|love|prefer|want)|use|always use)\s+(.+?)\s+(?:style|design|look|colou?r|font|layout|aesthetic|vibe)/gi,
    // "For Instagram/TikTok always/usually/prefer [X]"
    /(?:for|on)\s+(instagram|facebook|linkedin|tiktok|youtube|twitter|x)\s+(?:always|usually|prefer|use)\s+(.{5,100})/gi,
    // "Don't/never/avoid/stop use/using/make/making [X]"
    /(?:don't|never|avoid|stop)\s+(?:use|using|make|making|include|including|add|adding)\s+(.{5,100})/gi,
    // "Always [X] for/on/with [Y]"
    /(?:always|must|should always)\s+(.{5,80}?)\s+(?:for|on|with)\s+(.{3,60})/gi,
    // "Keep it [adjective]" or "Make it [adjective]"
    /(?:keep it|make it|keep things|i want it)\s+([\w\s]{3,40})/gi,
    // "No [X] in posts/content/designs"
    /(?:no|zero|none)\s+(.{3,60}?)\s+(?:in|on|for)\s+(?:posts?|content|designs?|videos?|images?|graphics?)/gi,
  ]
  for (const pattern of designPatterns) {
    const matches = userMessage.matchAll(pattern)
    for (const match of matches) {
      const content = match.length > 2 ? `${match[1]}: ${match[2]}` : (match[1] ?? match[0])
      const matchText = match[0].toLowerCase()
      const isNegative = /don't|never|avoid|stop|no\s/.test(matchText)
      extractions.push({
        key: `design-pref-${Date.now()}-${memoriesStored}`,
        value: { type: 'design_preference', content: content.trim(), source: 'user', timestamp },
        tags: [agentType, brandSlug, 'preference', 'design', 'user_preference', ...(isNegative ? ['negative_preference'] : [])],
      })
      memoriesStored++
    }
  }

  // 1c. Platform-specific preferences
  const platformPatterns = [
    // "On Instagram I want/use/prefer [X]"
    /(?:on|for)\s+(instagram|facebook|linkedin|tiktok|youtube|twitter|x|reels?|shorts?)\s+(?:i want|i use|i prefer|we use|we prefer|always)\s+(.{5,100})/gi,
    // "[Platform] should be/have [X]"
    /(instagram|facebook|linkedin|tiktok|youtube|twitter|x)\s+(?:should|must|needs to)\s+(?:be|have|include)\s+(.{5,100})/gi,
  ]
  for (const pattern of platformPatterns) {
    const matches = userMessage.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `platform-pref-${Date.now()}-${memoriesStored}`,
        value: { type: 'platform_preference', platform: match[1].trim().toLowerCase(), content: match[2].trim(), source: 'user', timestamp },
        tags: [agentType, brandSlug, 'preference', 'platform', match[1].trim().toLowerCase()],
      })
      memoriesStored++
    }
  }

  // 1d. Brand rules stated by user
  const brandRulePatterns = [
    // "We always/never [X]"
    /(?:we always|we never|our rule is|our policy is)\s+(.{10,120})/gi,
    // "For [brand] always/never [X]"
    /(?:for\s+\w+\s+)(?:always|never)\s+(.{10,100})/gi,
  ]
  for (const pattern of brandRulePatterns) {
    const matches = userMessage.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `brand-rule-${Date.now()}-${memoriesStored}`,
        value: { type: 'brand_rule', content: match[1].trim(), source: 'user', timestamp },
        tags: [agentType, brandSlug, 'rule', 'brand', 'brand_rule'],
      })
      memoriesStored++
    }
  }

  // 2. Decisions made (from assistant response)
  const decisionPatterns = [
    /(?:i recommend|i suggest|let's go with|the best approach|we should|the strategy is)\s+(.{20,200})/gi,
  ]

  // 2b. Social media metrics (from assistant response) — cross-agent learning
  const metricsPatterns = [
    /(?:engagement rate|CTR|click-through rate|conversion rate|ROI|ROAS|CPM|CPC|CPE)\s*(?:is|was|of|at|=|:)\s*(.{5,100})/gi,
  ]
  for (const pattern of metricsPatterns) {
    const matches = assistantResponse.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `metrics-${Date.now()}-${memoriesStored}`,
        value: { type: 'metrics', content: match[0].trim(), source: 'agent', timestamp },
        tags: ['metrics', agentType, brandSlug],
      })
      memoriesStored++
    }
  }
  for (const pattern of decisionPatterns) {
    const matches = assistantResponse.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `decision-${Date.now()}-${memoriesStored}`,
        value: { type: 'decision', content: match[1].trim(), source: 'agent', timestamp },
        tags: [agentType, brandSlug, 'decision'],
      })
      memoriesStored++
    }
  }

  // 2c. Product corrections and knowledge (from user messages)
  const productCorrectionPatterns = [
    /(?:actually|correct(?:ion|ly)|real(?:ly)?)\s+(?:is|are|has|smells?|tastes?|contains?|includes?)\s+(.{10,300})/gi,
    /(?:the (?:real|actual|correct) (?:notes?|ingredients?|description|specs?|price|features?))\s+(?:is|are)\s+(.{10,300})/gi,
    /(?:that'?s?\s+(?:not right|wrong|incorrect)).*(?:it'?s?\s+actually|should be|is really)\s+(.{10,300})/gi,
    /(?:our (?:product|service|offering|fragrance|item))\s+(?:is|does|has|includes?|features?)\s+(.{10,300})/gi,
  ]
  for (const pattern of productCorrectionPatterns) {
    const matches = userMessage.matchAll(pattern)
    for (const match of matches) {
      extractions.push({
        key: `product-${Date.now()}-${memoriesStored}`,
        value: { type: 'product_knowledge', content: match[0].trim(), source: 'user_correction', timestamp },
        tags: ['product_knowledge', brandSlug, 'correction'],
      })
      memoriesStored++
    }
  }

  // 3. Always store a conversation summary (fallback)
  extractions.push({
    key: `conv-${conversationId ?? 'new'}-${Date.now()}`,
    value: {
      type: 'conversation',
      agent: agentType,
      brand: brandSlug,
      userQuery: userMessage.slice(0, 200),
      summary: assistantResponse.slice(0, 500),
      timestamp,
    },
    tags: [agentType, brandSlug, 'conversation'],
  })
  memoriesStored++

  // Store all extractions
  for (const extraction of extractions) {
    await memoryStore(extraction.key, extraction.value, namespace, extraction.tags)
      .catch((err) => console.error('[memory-extractor] Store failed:', err))
  }

  return memoriesStored
}
