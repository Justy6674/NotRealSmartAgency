/**
 * Nothing internal ever reaches the people using this.
 *
 * The owner's colleague opened the product for the first time and read:
 *
 *   new row for relation "telegram_project_sessions" violates check
 *   constraint "telegram_project_sessions_check"
 *
 * posted into a group chat by the bot. That is a table name, a constraint name
 * and a Postgres error class, shown to a non-technical person as their
 * introduction to the software.
 *
 * It happened because eighty-four separate places did the same reasonable-
 * looking thing: `return \`Failed: ${error.message}\``. Each one is a small
 * decision; together they are a policy of leaking whatever the database
 * happens to say. So the decision is made once, here.
 *
 * The real error is ALWAYS logged. Nothing is hidden from whoever is
 * debugging — only from whoever is working.
 */

/**
 * Fragments that mean an error came from inside the machine.
 *
 * Deliberately an allow-nothing test rather than a deny-list of bad words: if
 * a message matches any of these it is internal, and if it matches none of
 * them it STILL is not repeated unless a caller explicitly says it is safe.
 */
const INTERNAL_MARKERS = [
  /violates .*constraint/i,
  /new row for relation/i,
  /null value in column/i,
  /column .* does not exist/i,
  /relation ".*" does not exist/i,
  /permission denied/i,
  /row-level security/i,
  /invalid input (?:syntax|value)/i,
  /SQLSTATE/i,
  /duplicate key value/i,
  /statement timeout/i,
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed/i,
  /\bat \/?[\w./-]+:\d+:\d+/,          // a stack frame
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // a UUID
  /\b(?:supabase|postgres|postgrest|pgrst)\b/i,
]

export function looksInternal(message: string): boolean {
  return INTERNAL_MARKERS.some((marker) => marker.test(message))
}

export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(err)
}

/**
 * Log the real thing; return something a person can act on.
 *
 * `scope` is for the log, so a fault can be found. `fallback` is what the
 * person reads, and it should say what did not happen and what they can do —
 * never what the database thought about it.
 */
export function userSafeError(scope: string, err: unknown, fallback: string): string {
  const real = messageOf(err)
  console.error(`[${scope}] ${real}`)
  return fallback
}

/**
 * For the few cases where an upstream message IS worth repeating — a platform
 * saying "caption too long", say — but only when it is demonstrably not
 * internal, and only up to a sane length.
 *
 * Anything failing the test falls back, so a new and unfamiliar error string
 * cannot become the first leak of the next class.
 */
export function relayIfSafe(scope: string, err: unknown, fallback: string, limit = 160): string {
  const real = messageOf(err)
  console.error(`[${scope}] ${real}`)
  if (!real.trim() || looksInternal(real) || real.length > limit) return fallback
  return real
}
