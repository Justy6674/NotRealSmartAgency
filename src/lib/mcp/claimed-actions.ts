/**
 * Stop the Director saying it did something it did not do.
 *
 * The owner asked for four specific edits to a draft. The Director explained
 * the edits, wrote the corrected copy in chat, and said the drafts were
 * updated. They were not. It then admitted, unprompted:
 *
 *   "worst part: I spoke as if the draft had been updated before I'd properly
 *    confirmed it. That's a trust error, not a copy error."
 *
 * Exactly right, and not fixable by telling a model to be careful. A model
 * that has just composed the perfect caption genuinely believes the work is
 * done; the sentence "I've updated the draft" is the natural next token
 * whether or not a tool ever ran. Every instruction added against it competes
 * with fluency, and fluency wins.
 *
 * So it is checked instead. A turn that CLAIMS a change to something outside
 * the chat must contain a tool call that could have made that change. When it
 * does not, the claim is replaced with the truth and an offer to actually do
 * it — because the reply is otherwise indistinguishable from success, and the
 * owner only finds out by opening Mixpost.
 *
 * Deliberately narrow. It catches assertions about drafts, posts and
 * publishing — the things that exist outside the conversation and cannot be
 * verified by reading it. Discussing, proposing and rewriting in chat are all
 * real work and are left alone.
 */

/** Tools that genuinely change something outside the conversation. */
export const WRITE_TOOLS = new Set([
  'draft_post', 'publish_to_social', 'manage_posts', 'approve_proposal',
  'save_output', 'schedule_post', 'update_post', 'caption_video',
  'tighten_video', 'create_collage', 'generate_image', 'upload_media',
  'design_graphic', 'export_design', 'sync_brand_to_canva',
])

/**
 * Past-tense assertions that a stored thing changed.
 *
 * Past tense only. "I'll update the draft" is a promise and fine; "I've
 * updated the draft" is a statement of fact about a database row. The
 * difference is the entire point.
 */
const CLAIM_PATTERNS: readonly RegExp[] = [
  /\bI(?:'ve| have)\s+(?:now\s+)?(?:updated|amended|edited|revised|corrected|replaced|fixed)\s+(?:the\s+|your\s+|both\s+|all\s+)?(?:\w+\s+){0,3}?(?:drafts?|posts?|captions?)\b/i,
  /\bI(?:'ve| have)\s+(?:now\s+)?(?:drafted|scheduled|published|posted|queued)\b/i,
  /\b(?:the\s+|your\s+|both\s+|all\s+)?(?:drafts?|posts?)\s+(?:has|have)\s+been\s+(?:updated|amended|edited|revised|corrected|replaced|drafted|scheduled|published)\b/i,
  /\bdone\s*[—–-]\s*(?:drafts?|posts?)\s+updated\b/i,
  /\bI(?:'ve| have)\s+(?:now\s+)?(?:pushed|sent|synced)\s+(?:it|them|that|these|those)?\s*to\s+mixpost\b/i,
]

export interface ClaimCheck {
  /** The reply asserts a stored change. */
  claimed: boolean
  /** A tool that could have made it actually ran. */
  backed: boolean
  /** The sentence that made the claim, for the log. */
  evidence: string | null
}

/** Which tools ran this turn, from the AI SDK's step record. */
export function toolNamesFrom(steps: unknown): string[] {
  if (!Array.isArray(steps)) return []
  const names: string[] = []
  for (const step of steps as Array<{ toolCalls?: Array<{ toolName?: unknown }> }>) {
    for (const call of step.toolCalls ?? []) {
      if (typeof call.toolName === 'string') names.push(call.toolName)
    }
  }
  return names
}

/**
 * A short record of what this turn actually changed.
 *
 * Kept beside the reply so the NEXT turn can read it. The Director could
 * always see what it SAID and never what it DID — which is how one request
 * became six drafts, and how "you did them already" was answered by doing it
 * twice more. Its own prose is not evidence of its own actions.
 *
 * Only writes. A read tells the next turn nothing it cannot see in the answer.
 */
export function actionsFrom(steps: unknown): string[] {
  if (!Array.isArray(steps)) return []
  const actions: string[] = []

  for (const step of steps as Array<{
    toolCalls?: Array<{ toolName?: unknown; input?: unknown }>
  }>) {
    for (const call of step.toolCalls ?? []) {
      const name = typeof call.toolName === 'string' ? call.toolName : null
      if (!name || !WRITE_TOOLS.has(name)) continue

      // A hint of WHAT it acted on, so "drafted for instagram" is
      // distinguishable from "drafted for facebook" a turn later.
      const input = (call.input ?? {}) as Record<string, unknown>
      const detail = [input.platform, input.media_item_id, input.post_id]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .slice(0, 2)
        .join(' ')

      actions.push(detail ? `${name} (${detail})` : name)
    }
  }

  // Deduped: the same tool twice in one turn is one fact worth carrying.
  return [...new Set(actions)]
}

export function checkClaims(response: string, toolNames: readonly string[]): ClaimCheck {
  const backed = toolNames.some((name) => WRITE_TOOLS.has(name))

  for (const pattern of CLAIM_PATTERNS) {
    const match = response.match(pattern)
    if (match) return { claimed: true, backed, evidence: match[0] }
  }
  return { claimed: false, backed, evidence: null }
}

/**
 * What to say instead.
 *
 * Not an apology and not a refusal — the work in the reply is usually good,
 * and throwing it away would be its own waste. The copy stays; only the false
 * sentence about it being filed is replaced, and the owner is given the one
 * word that makes it true.
 */
export function correctionNotice(): string {
  return '\n\n---\nOne correction: that has NOT been saved to the draft yet — the copy above is'
    + ' written but nothing outside this chat has changed. Say "apply it" and I will make the'
    + ' change to the actual draft and confirm what I did.'
}

/**
 * The reply, with any unbacked claim answered honestly.
 *
 * Returns the response unchanged when the claim is backed by a real tool call,
 * which is the ordinary case.
 */
export function enforceClaims(
  response: string,
  steps: unknown,
): { response: string; corrected: boolean; evidence: string | null } {
  const check = checkClaims(response, toolNamesFrom(steps))
  if (!check.claimed || check.backed) {
    return { response, corrected: false, evidence: check.evidence }
  }
  return {
    response: response + correctionNotice(),
    corrected: true,
    evidence: check.evidence,
  }
}
