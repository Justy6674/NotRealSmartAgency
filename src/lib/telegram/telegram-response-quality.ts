import { isTelegramExecutionRequest } from './telegram-execution-contract'
import { needsTelegramResearchBeforeDeliver } from './telegram-research-contract'
import { isTelegramFollowUp } from './telegram-thread'

const GENERIC_HANDOFF = /(?:i can help with|what(?:'s| is) the most pressing|what specifically did you want|send a marketing request whenever|when you are ready)/i
const TERMINAL_QUESTION = /\?\s*$/
const INTAKE_FORM = /(?:paste the product|use this format|what result matters most|sales,?\s*engagement,?\s*or brand awareness|\bproduct:\s*$)/im
const GOAL_DISCOVERY_SPAM = /(?:what result would make the next 90 days a win|no active end-user outcome|standing instructions)/i
const RETRY_MENU = /(?:what exactly do you want me to retry|media review|the caption|the publish step|fragrance carousel)/i
const UNGROUNDED_STALL = /(?:i don'?t have (?:enough|any) (?:info|information|details|context)|send me (?:the|more) (?:product|details|info)|tell me (?:more )?about (?:the|your) product)/i

/**
 * Explicit Telegram tasks and follow-ups must end in actual work, not another
 * intake menu, goal-discovery loop, or retry picker.
 */
export function needsTelegramResponseRepair(message: string, response: string): boolean {
  const mustDeliver = isTelegramExecutionRequest(message) || isTelegramFollowUp(message)
  if (!mustDeliver) return false

  return GENERIC_HANDOFF.test(response)
    || INTAKE_FORM.test(response)
    || GOAL_DISCOVERY_SPAM.test(response)
    || RETRY_MENU.test(response)
    || UNGROUNDED_STALL.test(response)
    || TERMINAL_QUESTION.test(response.trim())
}

export function buildTelegramResponseRepairPrompt(message: string, response: string, workMessage?: string): string {
  const deliverable = (workMessage ?? message).trim()
  const needsResearch = needsTelegramResearchBeforeDeliver(message, deliverable)
  return `The Telegram owner asked: ${message}
${workMessage && workMessage !== message ? `Resolved prior work to complete: ${deliverable}` : ''}

Your previous answer below failed because it handed the task back, asked for goal discovery, stalled for product details, or offered a retry menu instead of completing the work:
${response}

${needsResearch
    ? `This turn requires RESEARCH THEN DELIVER. Use tools first when available: query_media (mode="analysis"), browse_page/scan_website on the brand site, web_search for real product facts, read_proforma when brand truth is thin. Never invent notes or claims. Never ask the owner to paste the product if tools can fill the gap. Then return the finished result.`
    : `Return the completed answer now.`} Do not describe your capabilities, ask what the owner wants, ask about a 90-day win, or end with any question. Keep only the specific finding or deliverable, supporting evidence or reasoning, and one recommended next action.

If this was a caption / hashtag / description ask (including after "try again"): after research, return the finished caption text, a trailing 3–5 hashtag line, and (only if asked) one short angle line. Do not ask for product, platform, or outcome first.

If the owner asked what they are doing / to research the active project: inspect recent media, drafts, website and brand profile with tools, then give a concrete marketing answer grounded in that evidence.

If the owner asked what they previously asked: quote the prior ask in one line, then deliver that work immediately.

If the available rendered website evidence is limited, state that limitation plainly. Do not infer missing content, JavaScript rendering, search-engine indexing, traffic, conversion, or visitor behaviour from unavailable evidence. Use clean plain text, never Markdown.`
}
