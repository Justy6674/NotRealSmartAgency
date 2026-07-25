const EXECUTION_VERB = /\b(scan|review|audit|analyse|analyze|check|research|compare|create|write|draft|build|make|plan|find|look\s+at)\b/i

/** A request with a concrete marketing verb should be completed, not triaged. */
export function isTelegramExecutionRequest(message: string): boolean {
  return EXECUTION_VERB.test(message)
}

/**
 * The Telegram channel is an owner control surface. Explicit work requests
 * must reach a finished, useful result rather than another intake question.
 */
export function buildTelegramExecutionContract(message: string): string {
  if (!isTelegramExecutionRequest(message)) return ''

  return `TELEGRAM EXECUTION CONTRACT
The owner gave this concrete request: ${message}
- Complete the requested work now using the active project context and any fresh source evidence already gathered.
- Do not send a menu of services, restate your capabilities, or ask what the owner wants to work on.
- Do not ask a clarifying question when the request can be completed from the project context. Ask only when a required source, approval, or decision is genuinely unavailable, and name that one blocker.
- Return a finished result: the finding or deliverable, the evidence or reasoning that supports it, and the one recommended next action.
- Do not use Markdown. Keep the result concise enough to read on Telegram.`
}
