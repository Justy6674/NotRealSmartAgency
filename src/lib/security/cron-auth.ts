/**
 * The one place a cron/ops secret is checked.
 *
 * Every one of these routes used to write the check inline:
 *
 *     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401
 *
 * which reads as safe and is not. When `CRON_SECRET` is unset — a fresh
 * preview deployment, a renamed variable, a missing value in one Vercel
 * environment — the template interpolates to the literal string
 * `"Bearer undefined"`. The comparison then succeeds for anyone who sends that
 * header. The route did not become unreachable; it became public.
 *
 * That mattered most on /api/cron/publish-posts, which takes a service-role
 * client straight afterwards and publishes every due `scheduled_posts` row
 * across ALL tenants to real, connected social accounts. Four brands there
 * advertise regulated health services under AHPRA/TGA, so an unauthorised
 * publish is a compliance exposure, not only a bug.
 *
 * So the rule is fail closed: no secret configured means nobody is authorised,
 * including the caller who guessed the fallback. A cron that stops running is
 * loud and recoverable; a cron anyone can trigger is neither.
 *
 * The comparison is constant-time and written in plain JavaScript rather than
 * node:crypto's timingSafeEqual, so the helper is safe to import from a route
 * on any runtime.
 */

/** Compare two strings without leaking their common prefix through timing. */
function constantTimeEqual(a: string, b: string): boolean {
  // Length is not secret — an attacker controls their own header — but the
  // loop below needs a fixed bound, so mismatched lengths are folded into the
  // accumulator rather than returned early.
  let mismatch = a.length === b.length ? 0 : 1
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return mismatch === 0
}

/**
 * Is this request carrying the configured cron secret?
 *
 * Returns false when `CRON_SECRET` is unset or blank — that is the entire
 * point of the helper, so never "helpfully" allow the request through in a
 * non-production environment.
 */
export function isCronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get('authorization')
  if (!header) return false

  return constantTimeEqual(header, `Bearer ${secret}`)
}

/**
 * The body every one of these routes returns when the check fails.
 *
 * Deliberately says nothing about whether the secret is configured — an
 * unconfigured deployment and a wrong guess look identical from outside.
 */
export const CRON_UNAUTHORISED_BODY = { error: 'Unauthorised' } as const
