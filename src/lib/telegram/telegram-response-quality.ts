import { isTelegramExecutionRequest } from './telegram-execution-contract'

const GENERIC_HANDOFF = /(?:i can help with|what(?:'s| is) the most pressing|what specifically did you want|send a marketing request whenever|when you are ready)/i

/**
 * Explicit Telegram tasks must end in actual work, not another intake menu.
 * This detects only clearly generic hand-offs and leaves normal concise
 * answers alone.
 */
export function needsTelegramResponseRepair(message: string, response: string): boolean {
  return isTelegramExecutionRequest(message) && GENERIC_HANDOFF.test(response)
}

export function buildTelegramResponseRepairPrompt(message: string, response: string): string {
  return `The Telegram owner asked: ${message}

Your previous answer below failed because it handed the task back as a generic service menu:
${response}

Return the completed answer now. Do not describe your capabilities, ask what the owner wants, or end with a vague question. Keep only the specific finding or deliverable, supporting evidence or reasoning, and one recommended next action. Use clean plain text, never Markdown.`
}
