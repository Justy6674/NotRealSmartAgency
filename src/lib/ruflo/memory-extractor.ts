import { memoryStore } from './client'
import { getNamespace, getGlobalNamespace } from './namespaces'
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
        tags: [agentType, brandSlug, 'preference'],
      })
      memoriesStored++
    }
  }

  // 2. Decisions made (from assistant response)
  const decisionPatterns = [
    /(?:i recommend|i suggest|let's go with|the best approach|we should|the strategy is)\s+(.{20,200})/gi,
  ]
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

  // Also store to global namespace for Director cross-department visibility
  if (agentType !== 'overall') {
    await memoryStore(
      `cross-${agentType}-${Date.now()}`,
      {
        type: 'cross_department',
        department: agentType,
        brand: brandSlug,
        summary: `${agentType} worked on: ${userMessage.slice(0, 100)}`,
        timestamp,
      },
      getGlobalNamespace(),
      [agentType, brandSlug, 'cross_department']
    ).catch(() => {})
  }

  return memoriesStored
}
