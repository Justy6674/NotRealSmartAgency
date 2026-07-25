import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'

// ---------------------------------------------------------------------------
// LLM-based fact extractor for memory v2
//
// Uses Claude Haiku to extract structured facts from conversation turns.
// Returns max 5 facts per message. Never throws -- returns empty on failure.
// ---------------------------------------------------------------------------

export interface ExtractedFact {
  fact: string
  type: 'preference' | 'brand_rule' | 'decision' | 'observation' | 'metric'
  confidence: number
  tags: string[]
}

const VALID_TYPES = new Set<ExtractedFact['type']>([
  'preference',
  'brand_rule',
  'decision',
  'observation',
  'metric',
])

function buildPrompt(
  userMessage: string,
  assistantResponse: string,
  brandName: string
): string {
  return `Extract discrete, memorable facts from this conversation between a user and their AI marketing agent. Each fact should be one clear statement worth remembering for future interactions.

Types:
- preference: User likes/dislikes/wants (e.g., "User prefers short punchy captions")
- brand_rule: Must always/never do (e.g., "Never make health claims without evidence")
- decision: Strategy choice made (e.g., "Focus on YouTube Shorts as primary platform")
- observation: Performance insight (e.g., "Tuesday carousel posts get higher engagement")
- metric: Specific number (e.g., "Instagram engagement rate is 4.2%")

Rules:
- Max 5 facts per message
- Only extract facts worth remembering -- skip greetings, confirmations, generic conversation
- If there's nothing worth remembering, return an empty array
- Include the brand name in relevant tags
- Set confidence 0.5-1.0 based on how certain the fact is

Brand: ${brandName}
User said: ${userMessage}
Agent responded: ${assistantResponse}

Return ONLY a JSON array, no markdown, no explanation.`
}

/**
 * Extract structured facts from a conversation turn.
 * Returns an empty array on failure or if nothing worth remembering.
 */
export async function extractFacts(
  userMessage: string,
  assistantResponse: string,
  brandName: string
): Promise<ExtractedFact[]> {
  // Skip very short or empty messages
  if (!userMessage?.trim() && !assistantResponse?.trim()) return []

  try {
    const { text } = await generateText({
      model: gateway(getGatewayModel('fast')),
      providerOptions: getGatewayProviderOptions('fast'),
      prompt: buildPrompt(userMessage, assistantResponse, brandName),
      maxOutputTokens: 1024,
      temperature: 0,
    })

    // Parse JSON from response -- strip any markdown fencing if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) return []

    // Validate and sanitise each fact
    const facts: ExtractedFact[] = []

    for (const item of parsed.slice(0, 5)) {
      if (!item?.fact || typeof item.fact !== 'string') continue

      const type = VALID_TYPES.has(item.type) ? item.type : 'observation'
      const confidence = typeof item.confidence === 'number'
        ? Math.max(0.5, Math.min(1.0, item.confidence))
        : 0.7
      const tags = Array.isArray(item.tags)
        ? item.tags.filter((t: unknown) => typeof t === 'string')
        : [brandName.toLowerCase()]

      facts.push({
        fact: item.fact.trim(),
        type,
        confidence,
        tags,
      })
    }

    return facts
  } catch (err) {
    console.error('[memory/v2] extractFacts failed:', err)
    return []
  }
}
