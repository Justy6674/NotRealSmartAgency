/**
 * The two platforms that are connected without a sign-in page.
 *
 * Depended on by: `/api/zernio/connect/bluesky`, `/api/zernio/connect/telegram`.
 *
 * Every other platform in `connect.ts` hands the browser to the platform's own
 * sign-in and takes the result back. Two do not:
 *
 *   - **Bluesky** has no sign-in page for other applications at all. The owner
 *     generates an app password in their own settings and pastes it in. It goes
 *     straight through to the publisher on this server and is never written
 *     down, never logged, never put in a URL and never sent back to the browser.
 *   - **Telegram** runs backwards. The publisher mints a short code, the owner
 *     adds a bot to their channel and sends it that code, and the connection
 *     completes on Telegram's side with nothing to come back to. So we poll.
 *
 * ── Why the calls live here and not in the routes ──────────────────────
 *
 * Both endpoints have a shape that is easy to get subtly wrong and impossible
 * to detect afterwards, because a wrong path under zernio.com/api/v1 answers
 * **HTTP 200 with an HTML page** rather than 404 (measured 2026-08-18, see
 * `errors.ts`). `zernioConnectRequest` reads the content type before the status
 * for exactly that reason, and it is the only way either of these is called.
 * Paths and body shapes below were read off the publisher's own OpenAPI
 * document and the generated SDK types on 2026-08-19 — never from memory.
 *
 * ── The state string that is not a state ───────────────────────────────
 *
 * Bluesky's connect takes a `state` of the literal form `{userId}-{profileId}`.
 * It is not a CSRF token and it is not ours: it is how the publisher works out
 * which workspace user and which profile the new account belongs to. The user
 * id is the publisher's own idea of who our API key is, which is why it is
 * fetched rather than guessed.
 */

import {
  readConnectedAccount,
  zernioConnectRequest,
  type ConnectedAccount,
} from './connect'
import { ZernioError, ZernioHtmlResponseError } from './errors'

/* ── Bluesky ────────────────────────────────────────────────────────────── */

/**
 * The handle and app password were not accepted.
 *
 * Its own class so a route can say the one useful thing — check the handle,
 * check the app password has not been cancelled — instead of the house sentence
 * about not reaching a service, which sends the owner looking for a fault that
 * is not there. It carries no part of what was typed.
 */
export class BlueskyCredentialsRejected extends ZernioError {
  constructor(operation: string, status: number) {
    super(
      operation,
      `${operation}: the publisher refused the Bluesky credentials with HTTP ${status}. ` +
        'The handle or the app password is wrong, or the app password has been revoked. ' +
        'Nothing typed by the owner is recorded here or anywhere else.',
      { status },
    )
    this.name = 'BlueskyCredentialsRejected'
  }

  override get ownerMessage(): string {
    return (
      'Bluesky did not accept that handle and app password, so nothing has been connected. ' +
      'Check the handle is exactly as it appears under your posts, and that the app password ' +
      'has not been cancelled — if you are unsure, make a new one and try again.'
    )
  }
}

/**
 * Build the `{userId}-{profileId}` state, or refuse loudly.
 *
 * A dash is the separator, so a dash inside either half would make the string
 * ambiguous and the publisher would split it somewhere we did not intend —
 * connecting the account to a profile that is not this brand's. Both halves are
 * 24-character hex ids today; if that ever changes this throws rather than
 * quietly sending a state that means something else.
 */
export function blueskyConnectState(userId: string, profileId: string): string {
  const operation = 'connect.bluesky.state'
  const user = userId.trim()
  const profile = profileId.trim()

  if (user === '' || profile === '') {
    throw new ZernioError(
      operation,
      `${operation}: cannot build the connect state without both a workspace user id and a profile id.`,
    )
  }
  if (user.includes('-') || profile.includes('-')) {
    throw new ZernioError(
      operation,
      `${operation}: the state is {userId}-{profileId} and one of them already contains a dash, ` +
        'so the publisher would split it in the wrong place. Refusing rather than connecting to a guess.',
    )
  }

  return `${user}-${profile}`
}

/**
 * Who the publisher thinks our API key is.
 *
 * Cached for the life of the server process: it is a property of the key, not
 * of the request, and it does not change while the key does not. The cache is
 * only ever populated from a successful call, so a failed lookup is retried
 * rather than remembered.
 */
let cachedWorkspaceUserId: string | null = null

export async function currentZernioUserId(): Promise<string> {
  if (cachedWorkspaceUserId) return cachedWorkspaceUserId

  const operation = 'users.listUsers'
  const payload = await zernioConnectRequest<{ currentUserId?: unknown }>(operation, '/users')
  const id = typeof payload?.currentUserId === 'string' ? payload.currentUserId.trim() : ''

  if (id === '') {
    throw new ZernioError(
      operation,
      `${operation}: the publisher did not say which workspace user this key belongs to, ` +
        'so the Bluesky connect state cannot be built.',
    )
  }

  cachedWorkspaceUserId = id
  return id
}

/** Test seam. Never called by the routes. */
export function resetZernioUserIdCache(): void {
  cachedWorkspaceUserId = null
}

/**
 * Hand the app password to the publisher and take back an account.
 *
 * The credential is a function argument and a request body and nothing else. It
 * is not returned, not attached to an error, and not part of any log line here
 * or in `zernioConnectRequest`.
 */
export async function connectBlueskyAccount(input: {
  identifier: string
  appPassword: string
  profileId: string
}): Promise<ConnectedAccount> {
  const operation = 'connect.bluesky.credentials'

  const state = blueskyConnectState(await currentZernioUserId(), input.profileId)

  let payload: Record<string, unknown>
  try {
    payload = await zernioConnectRequest<Record<string, unknown>>(
      operation,
      '/connect/bluesky/credentials',
      {
        method: 'POST',
        body: {
          identifier: input.identifier,
          appPassword: input.appPassword,
          state,
        },
      },
    )
  } catch (err) {
    /*
     * A 400 here is the owner's typing, not our request.
     *
     * Our own fields are checked before the call and the state is built by the
     * function above, which refuses rather than guessing — so what is left for
     * the publisher to reject is the handle and the app password. An HTML body
     * is excluded deliberately: that is a wrong path, which is our bug and must
     * never be reported to the owner as a bad password.
     */
    if (
      err instanceof ZernioError &&
      !(err instanceof ZernioHtmlResponseError) &&
      (err.status === 400 || err.status === 422)
    ) {
      throw new BlueskyCredentialsRejected(operation, err.status)
    }
    throw err
  }

  return readConnectedAccount(operation, payload)
}

/* ── Telegram ───────────────────────────────────────────────────────────── */

export interface TelegramConnectCode {
  code: string
  /** ISO instant the publisher says the code dies. Absent when it did not say. */
  expiresAt: string | null
  /** The bot the owner messages, without the leading @. */
  botUsername: string | null
  /** The publisher's own steps. Shown in preference to ours when it sends them. */
  instructions: string[]
}

/**
 * Ask for a code.
 *
 * The publisher models this as a GET even though it mints something — that is
 * its shape, not a mistake here.
 */
export async function startTelegramConnect(profileId: string): Promise<TelegramConnectCode> {
  const operation = 'connect.telegram.code'

  const payload = await zernioConnectRequest<{
    code?: unknown
    expiresAt?: unknown
    botUsername?: unknown
    instructions?: unknown
  }>(operation, '/connect/telegram', { query: { profileId } })

  const code = typeof payload?.code === 'string' ? payload.code.trim() : ''
  if (code === '') {
    throw new ZernioError(
      operation,
      `${operation}: the publisher returned no access code, so there is nothing for the owner to send.`,
    )
  }

  return {
    code,
    expiresAt: typeof payload?.expiresAt === 'string' && payload.expiresAt.trim() !== ''
      ? payload.expiresAt
      : null,
    botUsername: typeof payload?.botUsername === 'string' && payload.botUsername.trim() !== ''
      ? payload.botUsername.replace(/^@/, '')
      : null,
    instructions: Array.isArray(payload?.instructions)
      ? payload.instructions.filter((line): line is string => typeof line === 'string' && line.trim() !== '')
      : [],
  }
}

export type TelegramConnectStatus =
  | { status: 'pending'; expiresAt: string | null }
  /** `chatTitle` is what the owner will recognise; the account is what we map. */
  | { status: 'connected'; account: ConnectedAccount; chatTitle: string | null }
  | { status: 'expired' }

/**
 * Has the code been used yet.
 *
 * Three answers and no fourth. An unrecognised status is a fault rather than a
 * fourth kind of "not yet", because a poll that treats an unknown answer as
 * pending spins on a dead code until the give-up clock, and tells the owner
 * nothing about why.
 *
 * A 404 is folded into `expired`: the publisher forgets a code once it is past
 * its window, and from the owner's side "gone" and "expired" are the same
 * event with the same fix — ask for a new one.
 */
export async function checkTelegramConnect(code: string): Promise<TelegramConnectStatus> {
  const operation = 'connect.telegram.status'

  let payload: Record<string, unknown>
  try {
    payload = await zernioConnectRequest<Record<string, unknown>>(operation, '/connect/telegram', {
      method: 'PATCH',
      query: { code },
    })
  } catch (err) {
    if (err instanceof ZernioError && !(err instanceof ZernioHtmlResponseError) && err.status === 404) {
      return { status: 'expired' }
    }
    throw err
  }

  const status = typeof payload?.status === 'string' ? payload.status : ''

  if (status === 'pending') {
    return {
      status: 'pending',
      expiresAt: typeof payload.expiresAt === 'string' && payload.expiresAt.trim() !== ''
        ? payload.expiresAt
        : null,
    }
  }

  if (status === 'expired') return { status: 'expired' }

  if (status === 'connected') {
    return {
      status: 'connected',
      account: readConnectedAccount(operation, payload),
      chatTitle: typeof payload.chatTitle === 'string' && payload.chatTitle.trim() !== ''
        ? payload.chatTitle
        : null,
    }
  }

  throw new ZernioError(
    operation,
    `${operation}: the publisher answered with a status this code does not recognise (${status || 'none'}).`,
  )
}
