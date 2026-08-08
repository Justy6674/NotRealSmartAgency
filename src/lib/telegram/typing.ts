/**
 * The "…is typing" line while the Director works.
 *
 * A Director job runs for anything from a few seconds to a few minutes. The
 * acknowledgement says work has started, and then nothing moves — so on a
 * phone it reads as dead. Telegram's own typing indicator is the signal
 * everyone already understands, and its absence is why the app felt stalled.
 *
 * Telegram clears the indicator after about five seconds, so it has to be
 * re-sent while the work continues. Everything here is best-effort: a typing
 * indicator must never be the reason a job fails or a reply is delayed.
 */

/** Telegram drops the indicator after ~5s; refresh comfortably inside that. */
const REFRESH_MS = 4_000

/** Never hold the interval open longer than a job can run. */
const MAX_MS = 300_000

export interface TypingHandle {
  /** Stop refreshing. Safe to call more than once. */
  stop: () => void
}

export async function sendTypingAction({
  botToken,
  chatId,
  threadId,
  fetchImpl = fetch,
}: {
  botToken: string
  chatId: string
  threadId?: number
  fetchImpl?: typeof fetch
}): Promise<void> {
  try {
    await fetchImpl(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
        ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
      }),
    })
  } catch {
    // Silent by design. Nobody needs to know the typing dots failed.
  }
}

/**
 * Show typing until `stop()` is called.
 *
 * Returns immediately — the first action is sent without being awaited so the
 * work behind it is never held up by a cosmetic call.
 */
export function keepTyping({
  botToken,
  chatId,
  threadId,
  intervalMs = REFRESH_MS,
  maxMs = MAX_MS,
  fetchImpl = fetch,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
}: {
  botToken: string
  chatId: string
  threadId?: number
  intervalMs?: number
  maxMs?: number
  fetchImpl?: typeof fetch
  setIntervalImpl?: typeof setInterval
  clearIntervalImpl?: typeof clearInterval
}): TypingHandle {
  void sendTypingAction({ botToken, chatId, threadId, fetchImpl })

  let stopped = false
  const startedAt = Date.now()

  const timer = setIntervalImpl(() => {
    // A stuck job must not leave this refreshing forever in a warm instance.
    if (stopped || Date.now() - startedAt > maxMs) {
      clearIntervalImpl(timer)
      return
    }
    void sendTypingAction({ botToken, chatId, threadId, fetchImpl })
  }, intervalMs)

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      clearIntervalImpl(timer)
    },
  }
}
