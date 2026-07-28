import { isTelegramExecutionRequest } from './telegram-execution-contract'

const GENERIC_HANDOFF = /(?:i can help with|what(?:'s| is) the most pressing|what specifically did you want|send a marketing request whenever|when you are ready)/i
const TERMINAL_QUESTION = /\?\s*$/
const INTAKE_FORM = /(?:paste the product|use this format|what result matters most|sales,?\s*engagement,?\s*or brand awareness|\bproduct:\s*$)/im

/**
 * Explicit Telegram tasks must end in actual work, not another intake menu.
 * This detects clearly generic hand-offs and caption-form stalls.
 */
export function needsTelegramResponseRepair(message: string, response: string): boolean {
  return isTelegramExecutionRequest(message) && (
    GENERIC_HANDOFF.test(response)
    || INTAKE_FORM.test(response)
    || TERMINAL_QUESTION.test(response.trim())
  )
}

export function buildTelegramResponseRepairPrompt(message: string, response: string): string {
  return `The Telegram owner asked: ${message}

Your previous answer below failed because it handed the task back instead of completing it:
${response}

Return the completed answer now. Do not describe your capabilities, ask what the owner wants, or end with any question. Keep only the specific finding or deliverable, supporting evidence or reasoning, and one recommended next action.

If this was a caption / hashtag / description ask: return the finished caption text, a trailing 3–5 hashtag line, and (only if asked) one short angle line. Do not ask for product, platform, or outcome first.

If the available rendered website evidence is limited, state that limitation plainly. Do not infer missing content, JavaScript rendering, search-engine indexing, traffic, conversion, or visitor behaviour from unavailable evidence. Use clean plain text, never Markdown.`
}
