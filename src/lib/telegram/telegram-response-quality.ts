import { isTelegramExecutionRequest } from './telegram-execution-contract'

const GENERIC_HANDOFF = /(?:i can help with|what(?:'s| is) the most pressing|what specifically did you want|send a marketing request whenever|when you are ready)/i
const TERMINAL_QUESTION = /\?\s*$/

/**
 * Explicit Telegram tasks must end in actual work, not another intake menu.
 * This detects only clearly generic hand-offs and leaves normal concise
 * answers alone.
 */
export function needsTelegramResponseRepair(message: string, response: string): boolean {
  return isTelegramExecutionRequest(message) && (
    GENERIC_HANDOFF.test(response) || TERMINAL_QUESTION.test(response.trim())
  )
}

export function buildTelegramResponseRepairPrompt(message: string, response: string): string {
  return `The Telegram owner asked: ${message}

Your previous answer below failed because it handed the task back instead of completing it:
${response}

Return the completed answer now. Do not describe your capabilities, ask what the owner wants, or end with any question. Keep only the specific finding or deliverable, supporting evidence or reasoning, and one recommended next action.

If the available website evidence is a thin raw HTML shell, state that it is insufficient for a full content or SEO audit. Do not infer missing content, JavaScript rendering, search-engine indexing, or visitor behaviour from that limitation. Use clean plain text, never Markdown.`
}
