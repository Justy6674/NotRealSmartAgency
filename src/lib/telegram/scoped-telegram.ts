export interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<
    | { text: string; callback_data: string }
    | { text: string; url: string }
    | { text: string; web_app: { url: string } }
  >>
}

export type ScopedTelegramIntent =
  | { kind: 'pair'; code: string }
  | { kind: 'choose_project' }
  | { kind: 'select_project'; grantId: string }
  | { kind: 'connect_github'; scope: 'current' | 'all' }
  | { kind: 'marketing_request'; message: string }
  | { kind: 'ignore' }

const PAIR_CODE = /^\/start\s+nrs_pair_([a-f0-9]{32,128})$/i
const PROJECT_CALLBACK = /^nrs_project:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const NATURAL_GITHUB_CONNECTION = /^(?:please\s+)?(?:connect|link)\s+(?:(?:to|with)\s+)?(?:(?:all|every)\s+)?(?:my\s+)?git(?:[\s-]?hub)(?:\s+(?:account|repo(?:sitories)?|projects?))?(?:\s+(?:to|with)\s+(?:nrs|not\s+real\s+smart))?[.!?]*$/i
const NATURAL_PROJECT_PICKER = /^(?:please\s+)?(?:(?:change|switch|choose|show|list)\s+(?:(?:my|the)\s+)?projects?|(?:change|switch|move)\s+(?:my\s+)?project(?:\s+(?:to\s+)?[^.!?]+)?|(?:change|switch|move)\s+to\s+[^.!?]+|work\s+on\s+another\s+project)[.!?]*$/i

/**
 * A marketing request can never name a project to change its scope. Scope
 * changes only through a signed pairing code or an inline button that carries
 * an opaque access-grant ID.
 */
export function parseScopedTelegramIntent(
  text?: string,
  callbackData?: string,
): ScopedTelegramIntent {
  if (callbackData) {
    const callbackMatch = PROJECT_CALLBACK.exec(callbackData)
    return callbackMatch
      ? { kind: 'select_project', grantId: callbackMatch[1] }
      : { kind: 'ignore' }
  }

  const message = text?.trim()
  if (!message) return { kind: 'ignore' }

  const pairMatch = PAIR_CODE.exec(message)
  if (pairMatch) return { kind: 'pair', code: pairMatch[1].toLowerCase() }

  if (message.startsWith('/start') || message === '/projects' || message === '/project') {
    return { kind: 'choose_project' }
  }

  // Project names in prose deliberately never select a scope. A user can ask
  // for the picker naturally, then the signed inline button carries the grant.
  if (NATURAL_PROJECT_PICKER.test(message)) return { kind: 'choose_project' }

  if (message === '/connect') return { kind: 'connect_github', scope: 'current' }
  if (message === '/connect all') return { kind: 'connect_github', scope: 'all' }

  if (NATURAL_GITHUB_CONNECTION.test(message)) {
    return {
      kind: 'connect_github',
      scope: /\b(?:all|every)\b/i.test(message) ? 'all' : 'current',
    }
  }

  return { kind: 'marketing_request', message }
}

export function buildScopedProjectKeyboard(
  grants: ReadonlyArray<{ grantId: string; projectName: string }>,
): TelegramInlineKeyboard {
  return {
    inline_keyboard: grants.map((grant) => [{
      text: grant.projectName,
      callback_data: `nrs_project:${grant.grantId}`,
    }]),
  }
}

/**
 * Link THIS topic to a project, in one tap.
 *
 * A separate callback from the ordinary project picker because it does a
 * different thing: choosing a project sets what the next message is about,
 * whereas this binds a Telegram topic to a project permanently. Telling the
 * two apart matters — the topic id has to survive the round trip, and Telegram
 * gives back only the callback string.
 */
export function buildTopicLinkKeyboard(
  grants: ReadonlyArray<{ grantId: string; projectName: string }>,
  threadId: number,
): TelegramInlineKeyboard {
  return {
    inline_keyboard: grants.map((grant) => [{
      text: grant.projectName,
      callback_data: `nrs_topic:${threadId}:${grant.grantId}`,
    }]),
  }
}

/** "nrs_topic:5393:<grantId>" → the pieces, or null. */
export function parseTopicLink(callbackData: string): { threadId: number; grantId: string } | null {
  const match = /^nrs_topic:(\d+):(.+)$/.exec(callbackData)
  if (!match) return null
  const threadId = Number(match[1])
  return Number.isFinite(threadId) && match[2] ? { threadId, grantId: match[2] } : null
}

export function addMiniAppButton(keyboard: TelegramInlineKeyboard, url = 'https://www.notrealsmart.com.au/telegram'): TelegramInlineKeyboard {
  return { inline_keyboard: [...keyboard.inline_keyboard, [{ text: 'Open NRS Mini App', web_app: { url } }]] }
}
