import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { createClient } from '@supabase/supabase-js'
import { embedText } from './embeddings'

// ---------------------------------------------------------------------------
// Session Memory — compounding per-brand learning via Haiku subagent
//
// Follows Anthropic's Claude Code session memory pattern:
// - Structured 7-section markdown record per brand
// - Haiku updates sections in-place (compounds, doesn't replace)
// - Extraction thresholds: 3 turns before first, 3 turns between updates
// - Record embedded for semantic search
// - Injected into agent prompts as "Brand Learning"
// ---------------------------------------------------------------------------

const SESSION_MEMORY_TEMPLATE = `# Brand: {brandName} — Session Memory

## Current State
_What is actively being worked on? Pending tasks? Immediate next steps._

## User Preferences
_What the user likes/dislikes. Design preferences, tone, platform choices._

## Brand Rules
_Non-negotiable rules. Compliance requirements. Things to always/never do._

## Decisions Made
_Strategy choices, platform focus, content direction._

## Content Performance
_What worked well, what didn't. Engagement metrics, successful formats._

## Corrections & Feedback
_What the user corrected. Approaches that failed. What to avoid._

## Campaign History
_Past campaigns, their outcomes, lessons learned._
`

// Threshold config
const CONFIG = {
  minimumTurnsToInit: 3,
  turnsBetweenUpdates: 3,
}

// Track turns per conversation (module-level, resets on server restart — fine for serverless)
const turnCounts = new Map<string, number>()
const lastExtractionTurn = new Map<string, number>()

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function recordTurn(conversationId: string): void {
  const current = turnCounts.get(conversationId) ?? 0
  turnCounts.set(conversationId, current + 1)
}

export function shouldExtractSessionMemory(conversationId: string): boolean {
  const turns = turnCounts.get(conversationId) ?? 0
  const lastExtraction = lastExtractionTurn.get(conversationId) ?? 0

  if (turns < CONFIG.minimumTurnsToInit) return false
  if (turns - lastExtraction < CONFIG.turnsBetweenUpdates) return false
  return true
}

export async function extractSessionMemory(params: {
  brandId: string
  brandSlug: string
  brandName: string
  userId: string
  userMessage: string
  assistantResponse: string
  conversationId: string | null
}): Promise<void> {
  const { brandId, brandSlug, brandName, userId, userMessage, assistantResponse, conversationId } = params
  const supabase = getAdminClient()
  const memoryKey = `session-memory-${brandSlug}`
  const namespace = `nrs-${brandSlug}`

  try {
    // 1. Fetch existing session memory (if any)
    const { data: existing } = await supabase
      .from('agent_memories')
      .select('id, value')
      .eq('key', memoryKey)
      .eq('namespace', namespace)
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('isolation_status', 'active')
      .single()

    const currentRecord = (existing?.value as string) ?? SESSION_MEMORY_TEMPLATE.replace('{brandName}', brandName)

    // 2. Call Haiku to update the session memory
    const { text: updatedRecord } = await generateText({
      model: gateway('anthropic/claude-haiku-4-5-20251001'),
      maxOutputTokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You maintain a session memory document for the brand "${brandName}". Your job is to UPDATE this document with new information from the latest conversation turn.

CURRENT SESSION MEMORY:
${currentRecord}

LATEST CONVERSATION:
User: ${userMessage.slice(0, 1000)}
Agent: ${assistantResponse.slice(0, 2000)}

RULES:
- UPDATE sections with new information. Don't replace — ADD to existing content.
- Keep section headers exactly as they are (lines starting with ## or #).
- Keep italic _description_ lines intact.
- For User Preferences, Brand Rules, Corrections: format as "fact. **Why:** reason. **How to apply:** guidance."
- For Content Performance: include specific metrics and dates.
- Condense older entries if a section gets too long (over 500 words).
- If nothing new for a section, leave it unchanged.
- Write in Australian English.
- Return the COMPLETE updated document.

Return ONLY the updated markdown document. No explanation.`,
        },
      ],
    })

    if (!updatedRecord || updatedRecord.length < 50) return

    // 3. Embed the updated record for semantic search
    const embedding = await embedText(updatedRecord.slice(0, 500))
    const hasEmbedding = embedding.length > 0

    // 4. Upsert the session memory record
    if (existing?.id) {
      // Update existing record
      await supabase
        .from('agent_memories')
        .update({
          value: updatedRecord,
          memory_type: 'session',
          confidence: 1.0,
          tags: [brandSlug, 'session_memory'],
          ...(hasEmbedding ? { embedding } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Insert new record
      const insertPayload: Record<string, unknown> = {
        key: memoryKey,
        namespace,
        value: updatedRecord,
        user_id: userId,
        brand_id: brandId,
        isolation_status: 'active',
        memory_type: 'session',
        confidence: 1.0,
        tags: [brandSlug, 'session_memory'],
        updated_at: new Date().toISOString(),
      }
      if (hasEmbedding) {
        insertPayload.embedding = embedding
      }

      const { error: insertError } = await supabase
        .from('agent_memories')
        .insert(insertPayload)

      // Handle duplicate key race condition
      if (insertError?.code === '23505') {
        await supabase
          .from('agent_memories')
          .update({
            value: updatedRecord,
            memory_type: 'session',
            confidence: 1.0,
            tags: [brandSlug, 'session_memory'],
            ...(hasEmbedding ? { embedding } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('key', memoryKey)
          .eq('namespace', namespace)
          .eq('user_id', userId)
          .eq('brand_id', brandId)
      }
    }

    // 5. Mark extraction complete
    if (conversationId) {
      lastExtractionTurn.set(conversationId, turnCounts.get(conversationId) ?? 0)
    }

    console.log(`[session-memory] Updated session memory for ${brandName}`)
  } catch (error) {
    console.error('[session-memory] Extraction failed:', error)
  }
}

export async function getSessionMemoryForPrompt(
  brandId: string,
  brandSlug: string,
  userId: string
): Promise<string | null> {
  const supabase = getAdminClient()

  try {
    const { data } = await supabase
      .from('agent_memories')
      .select('value')
      .eq('key', `session-memory-${brandSlug}`)
      .eq('namespace', `nrs-${brandSlug}`)
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('isolation_status', 'active')
      .single()

    return (data?.value as string) ?? null
  } catch {
    return null
  }
}
