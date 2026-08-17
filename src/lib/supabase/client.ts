import { createBrowserClient } from '@supabase/ssr'

/**
 * Automated Chrome (Puppeteer, Playwright, Cursor's browser connection)
 * sets `navigator.webdriver` and leaves Web Locks orphaned. gotrue waits
 * 5s on `lock:sb-…-auth-token`, steals, and can hang forever — login stuck
 * on "Signing in...". The mcp-login page already avoids this by not
 * persisting a session. The main login must persist the session, so we
 * swap the lock instead of turning persistence off.
 *
 * Normal Chrome is unchanged: it keeps the default navigator.locks so
 * two tabs cannot corrupt the same session.
 */
const inFlight = new Map<string, Promise<unknown>>()

async function inProcessAuthLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = inFlight.get(name) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  inFlight.set(
    name,
    previous.then(() => gate).catch(() => gate),
  )
  try {
    await previous.catch(() => undefined)
    return await fn()
  } finally {
    release()
  }
}

export function createClient() {
  const automated =
    typeof navigator !== 'undefined' && Boolean(navigator.webdriver)

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    automated ? { auth: { lock: inProcessAuthLock } } : undefined,
  )
}
