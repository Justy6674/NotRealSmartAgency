export interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<
    | { text: string; callback_data: string }
    | { text: string; url: string }
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

  if (message === '/connect') return { kind: 'connect_github', scope: 'current' }
  if (message === '/connect all') return { kind: 'connect_github', scope: 'all' }

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
