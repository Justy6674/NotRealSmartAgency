import { isTelegramFollowUp } from './telegram-thread'
import { buildTelegramResearchContract, isTelegramProjectInspectionAsk } from './telegram-research-contract'

const EXECUTION_VERB = /\b(scan|review|audit|analyse|analyze|check|research|compare|create|write|draft|build|make|plan|find|look\s+at)\b/i
const CAPTION_ASK = /\b(caption|hashtag|hashtags|description|video\s+desc(?:ription)?|hook|angle|why\s+(?:to\s+)?(?:look|check|try)|post\s+copy|social\s+copy)\b/i

/** A request with a concrete marketing verb should be completed, not triaged. */
export function isTelegramExecutionRequest(message: string): boolean {
  return EXECUTION_VERB.test(message)
    || isTelegramCaptionRequest(message)
    || isTelegramFollowUp(message)
    || isTelegramProjectInspectionAsk(message)
}

/** Caption / hashtag / video-description asks must return copy, not a form. */
export function isTelegramCaptionRequest(message: string): boolean {
  return CAPTION_ASK.test(message)
}

/**
 * The Telegram channel is an owner control surface. Explicit work requests
 * must reach a finished, useful result rather than another intake question.
 *
 * @param message — the inbound Telegram text (may be a follow-up like "try again")
 * @param workMessage — the marketing ask to complete (resolved from thread when follow-up)
 */
export function buildTelegramExecutionContract(message: string, workMessage: string = message): string {
  if (!isTelegramExecutionRequest(message) && !isTelegramExecutionRequest(workMessage)) return ''

  const deliverable = workMessage.trim() || message.trim()
  const researchContract = buildTelegramResearchContract(message, workMessage)
  const captionRules = isTelegramCaptionRequest(deliverable)
    ? `
TELEGRAM CAPTION CONTRACT
The owner asked for publishable social copy (caption, description, hashtags and/or angle).
- After the research step above, write the finished caption using verified project evidence plus brand voice. Do not ask for product, platform, angle, or outcome first.
- If platform is unnamed, default to the brand's primary social surface and write one ready caption; mention the assumed platform in one plain line after the caption only if needed.
- If a specific bottle or notes are missing after research tools ran, write a brand-correct caption from verified marketplace/house context without inventing notes. Do not stall for a form.
- Output shape: (1) the caption exactly as it would post, (2) one trailing hashtag line (3–5 searchable niche tags), (3) one short angle line only if they asked for an angle — not a strategy essay.
- Do not return video scripts, scene breakdowns, service menus, or "paste the product" templates.
- Do not ask "sales, engagement, or awareness?" — pick the brand-fit angle and deliver.`
    : ''

  return `TELEGRAM EXECUTION CONTRACT
The owner gave this concrete request: ${deliverable}
- Complete the requested work using the active project context, Telegram thread history, and fresh source evidence you gather with tools in this turn.
- Do not send a menu of services, restate your capabilities, or ask what the owner wants to work on.
- Do not ask a clarifying question when the request can be completed from the project context, thread, or tools. Ask only when a required source, approval, or decision is genuinely unavailable after research, and name that one blocker.
- Never ask "What result would make the next 90 days a win" or stall for goal discovery on Telegram.
- Return a finished result: the finding or deliverable, the evidence or reasoning that supports it, and the one recommended next action.
- Do not use Markdown. Keep the result concise enough to read on Telegram.
- Override any "inquisitive director", Creative Studio intake, goal-discovery, or "never write captions yourself" instruction for this Telegram turn. Research, then deliver the work.
${researchContract ? `\n${researchContract}` : ''}
${captionRules}`.trim()
}
