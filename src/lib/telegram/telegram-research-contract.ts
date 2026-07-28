/**
 * Telegram research-before-deliver contract.
 *
 * Caption/intake fixes made Telegram deliver copy instead of forms — but the
 * execution contract also told the model to write from static brand voice and
 * "evidence already gathered". That skipped live project research (media,
 * website, products, drafts). This module restores research-first behaviour
 * without re-enabling 90-day goal spam or MCP allowlist changes.
 *
 * Kept free of imports from telegram-execution-contract to avoid cycles —
 * execution-contract appends this research block.
 */

import { isTelegramFollowUp } from './telegram-thread'

/** Owner asks what the active project is doing / wants NRS to inspect it. */
const PROJECT_INSPECTION = /\b(?:what\s+am\s+i\s+doing|what\s+(?:have\s+i|i'?ve)\s+been\s+doing|research\s+what\s+i(?:'?m|\s+am)\s+doing|look\s+(?:at|into)\s+what\s+i(?:'?m|\s+am)\s+doing|what(?:'?s|\s+is)\s+(?:going\s+on|happening)\s+(?:with|on)\s+(?:my|this)\s+(?:brand|project|business)|inspect\s+(?:my|this)\s+(?:brand|project)|catch\s+me\s+up\s+on\s+(?:my|this)\s+(?:brand|project)|what\s+(?:should\s+i|can\s+i)\s+(?:post|market|promote)\s+(?:next|now|today))\b/i

/** Marketing deliverables that must be grounded in fresh project evidence. */
const MARKETING_DELIVERABLE = /\b(?:caption|hashtag|hashtags|description|hook|angle|post\s+copy|social\s+copy|review\s+(?:my\s+)?media|media\s+review|content\s+plan|launch\s+plan|audit|competitor|carousel|ad\s+copy|email\s+copy|blog|strategy|campaign|what\s+should\s+i\s+post|write\s+(?:a\s+)?(?:post|caption|copy)|draft\s+(?:a\s+)?(?:post|caption)|plan\s+(?:my\s+)?(?:week|content|posts)|scan|research|analyse|analyze|compare|create|build|make|find)\b/i

export function isTelegramProjectInspectionAsk(message: string): boolean {
  return PROJECT_INSPECTION.test(message.trim())
}

export function isTelegramMarketingDeliverableAsk(message: string): boolean {
  return MARKETING_DELIVERABLE.test(message.trim())
}

/**
 * True when this Telegram turn must gather fresh project evidence before
 * answering — not invent from training data or stall for a paste form.
 */
export function needsTelegramResearchBeforeDeliver(
  message: string,
  workMessage: string = message,
): boolean {
  const candidates = [message, workMessage]
  return candidates.some((text) => {
    const trimmed = text.trim()
    if (!trimmed) return false
    return isTelegramProjectInspectionAsk(trimmed)
      || isTelegramMarketingDeliverableAsk(trimmed)
      || isTelegramFollowUp(trimmed)
  })
}

/**
 * Mandatory research-before-deliver rules for Telegram marketing turns.
 * Empty string when the turn does not need research gating.
 */
export function buildTelegramResearchContract(
  message: string,
  workMessage: string = message,
): string {
  if (!needsTelegramResearchBeforeDeliver(message, workMessage)) return ''

  const deliverable = (workMessage.trim() || message.trim())
  const inspection = isTelegramProjectInspectionAsk(message)
    || isTelegramProjectInspectionAsk(workMessage)

  const inspectionBlock = inspection
    ? `
TELEGRAM PROJECT INSPECTION
The owner asked what they are doing / to research the active project ("${deliverable}").
- Treat this as an inspection of the ACTIVE project only — not a capability menu and not goal discovery.
- Gather evidence first with tools, then answer with a concrete marketing read of what is happening and what to do next.
- Prefer in order: query_media (mode="analysis") for recent uploads, query_calendar / draft queue context already in the prompt, browse_page or scan_website on the brand website when configured, read_proforma for brand truth, brand products/profile already loaded.
- End with one recommended marketing action grounded in that evidence. Never ask "what result would make the next 90 days a win".`
    : ''

  return `TELEGRAM RESEARCH-BEFORE-DELIVER CONTRACT
The owner expects finished marketing work grounded in THIS project's live evidence, not inventing from training data.
Active ask: ${deliverable}

MANDATORY ORDER (this overrides "answer first / never jump into tool calls" for this Telegram turn):
1. RESEARCH — call the tools that fill the gaps before you write the deliverable.
2. DELIVER — return the finished result in clean Telegram text.
3. ONE NEXT ACTION — one concrete recommended next step.

Required research tools when available for this project:
- Recent media / "review my media" / captions about a video or upload → query_media with mode="analysis" (full transcription + AI description). Never recommend from filename alone.
- Brand website / positioning / live offer / homepage claims → browse_page or scan_website on the brand's configured site. Do not invent pages, products, or claims.
- Product / fragrance / scent notes / specs → web_search and/or browse the brand product page. Never invent notes, ingredients, or features.
- Brand strategy / pillars / audience truth → read_proforma for the relevant section when the prompt summary is thin or stale.
- Calendar / drafts / "what should I post" → use CONTENT REVIEW QUEUE context plus query_media / query_calendar when needed.

Hard rules:
- Never invent product notes, claims, testimonials, metrics, or competitor facts.
- Never stall with "paste the product", intake forms, or sales-vs-engagement questions when tools can fill the gap from the active project.
- If a tool returns nothing useful, say what you checked and what is missing — then deliver the best grounded answer from verified brand profile only. Do not fake research.
- Do not re-open 90-day goal discovery on Telegram.
- Keep thread history; do not ask the owner to restate context you already have.
${inspectionBlock}`.trim()
}
