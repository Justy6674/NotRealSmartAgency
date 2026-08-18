import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * A route that reaches past RLS must first establish who is asking.
 *
 * `createAdminClient()` uses the service-role key. It bypasses Row Level
 * Security completely, so the database will hand it any row in any tenant
 * without argument. That is fine — several routes genuinely need it. What is
 * not fine is a route that does it and never works out who is on the other end
 * of the request, because then the only thing standing between one brand's data
 * and the whole internet is whether the caller can guess a uuid.
 *
 * This is not hypothetical. /api/zernio/connect, /api/zernio/accounts and
 * /api/zernio/analytics each called createAdminClient twice, read `brandId`
 * straight out of the query string, and checked nothing at all. Anyone holding
 * a brand uuid could read that brand's connected social accounts and its
 * analytics, or start an OAuth connect flow against it. One directory over,
 * /api/zernio/ads did the same job correctly — session client, getUser, and a
 * profileIdForOwnedBrand helper that scopes the brand lookup by user_id.
 *
 * The audit that found those three was a person reading files on one afternoon.
 * This test is the same audit, run on every commit, for ever. The point is not
 * that today's holes are closed; it is that the next one cannot be added
 * quietly.
 *
 * The rule: if a route.ts reaches for the service role, it must also contain a
 * recognised way of establishing the caller. Exceptions are recognised BY
 * MECHANISM, never by path — a list of blessed paths rots the moment somebody
 * adds a route, and worse, it silently blesses whatever that path later becomes.
 */

const ROOT = process.cwd()
const API = resolve(ROOT, 'src/app/api')

/**
 * The ways a caller can be established in this codebase.
 *
 * Each of these proves something about who is asking. Add to this list when a
 * genuinely new mechanism arrives — not to make a red test go green.
 *
 * Deliberately NOT here:
 *
 *   - An outbound `Authorization: Bearer ${process.env.SOME_API_KEY}` header.
 *     That authenticates US to a third party. It says nothing about the caller,
 *     and it is exactly what /api/zernio/connect had while being wide open.
 *   - A CSRF state cookie on its own. It proves the flow started in the same
 *     browser, which is worth having, but it is not an identity: the caller
 *     sets both halves. /api/oauth/meta/initiate minted that cookie for a
 *     brandId taken from the query string with nobody signed in, so the
 *     callback's "verified" state named a project the attacker had chosen and
 *     their own Facebook tokens were written onto it. Both halves of that pair
 *     now call getUser and resolve the brand through the workspace rules, the
 *     way /api/oauth/youtube/callback always did.
 */
interface Mechanism {
  /** Named the way it would be explained to someone fixing a failure. */
  readonly name: string
  readonly pattern: RegExp
}

const MECHANISMS: readonly Mechanism[] = [
  {
    name: 'a signed-in session (supabase.auth.getUser)',
    // `\bgetUser\s*\(` will not match getUserBrands( — the paren must follow.
    pattern: /\bauth\s*\.\s*getUser\s*\(|\bgetUser\s*\(/,
  },
  {
    name: 'a project-scoped API key (resolveApiKey)',
    pattern: /\bresolveApiKey\s*\(/,
  },
  {
    name: 'the cron secret, checked fail-closed (isCronAuthorised)',
    // `isCronAuthorised` (src/lib/security/cron-auth.ts) is the correct form.
    // A bare CRON_SECRET reference still counts as *a* mechanism here — such a
    // route does check a secret — but WHETHER that check fails open is a
    // separate and stricter test, below. Both matter: this list answers "is
    // anyone asked?", the fail-open test answers "can the answer be forged?".
    pattern: /\bisCronAuthorised\s*\(|\bCRON_SECRET\b/,
  },
  {
    name: 'a verified webhook signature',
    // Stripe's constructEvent, Mixpost's verifier, verifyZernioWebhook (HMAC
    // on the raw body, fail-closed), the raw HMAC compares used by Telegram,
    // and Telegram Mini App initData — which is itself an HMAC of the payload
    // against the bot token.
    pattern:
      /\bconstructEvent\s*\(|\bcreateHmac\s*\(|\btimingSafeEqual\s*\(|\bverify[A-Za-z]*Signature\s*\(|\bverifyZernioWebhook\s*\(|\bvalidateTelegram[A-Za-z]*InitData\s*\(/,
  },
  {
    name: 'a single-use secret the caller must present, stored only as a hash',
    // The media intake link (hashMediaIntakeToken) and the Telegram → GitHub
    // connect hand-off (hashGitHubConnectState). The caller holds an
    // unguessable token; the row is found by its hash and is one-use and
    // expiring. That is a credential, even though there is no session.
    pattern: /\bhash[A-Za-z]*(?:Token|State|Secret)\s*\(/,
  },
  {
    name: 'an OAuth client credential (client_secret plus a PKCE code_verifier)',
    // /api/mcp/token. The caller proves it is the registered client and that it
    // started the flow. Both halves are required — client_secret alone would
    // also match our own outbound calls.
    pattern:
      /\bclient_secret\b[\s\S]{0,800}?\bcode_verifier\b|\bcode_verifier\b[\s\S]{0,800}?\bclient_secret\b/,
  },
]

/**
 * Routes reviewed and deliberately left with no caller check, and why.
 *
 * This is the escape hatch of last resort, for a route whose correct behaviour
 * genuinely is to answer strangers. Every entry is a promise that the service
 * role cannot reach tenant content from there.
 *
 * The list may only ever shrink. A new hole gets fixed, not listed — and the
 * guards below make an entry that stops being true, or stops existing, fail.
 */
const REVIEWED: Record<string, string> = {
  'src/app/api/mcp/register/route.ts':
    'RFC 7591 dynamic client registration. Claude Desktop calls this before any ' +
    'credential exists, so it cannot require one. It only ever INSERTs a fresh ' +
    'random client_id/client_secret into oauth_clients; it reads nothing and ' +
    'touches no tenant table. Sign-in for the owner and every connected AI ' +
    'client goes through here.',
  'src/app/api/mcp/authorize/route.ts':
    'RFC 6749 authorization endpoint. By the spec this is the URL a browser is ' +
    'redirected to before anyone has logged in, so a caller check here would ' +
    'break MCP sign-in entirely. It reads one column (redirect_uris) from ' +
    'oauth_clients to validate the redirect target, then hands off to the login ' +
    'page. The actual identity is established downstream in /api/mcp/code, ' +
    'which does call auth.getUser.',
}

/** Every route.ts under src/app/api, recursively. */
function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...routeFiles(path))
    else if (entry === 'route.ts') out.push(path)
  }
  return out
}

/** Does this source reach past RLS with the service role? */
function usesServiceRole(source: string): boolean {
  return /\bcreateAdminClient\b/.test(source)
}

/** Which caller-establishing mechanisms appear in this source. */
function mechanismsIn(source: string): string[] {
  return MECHANISMS.filter((m) => m.pattern.test(source)).map((m) => m.name)
}

function relative(path: string): string {
  return path.replace(ROOT + '/', '')
}

test('every route using the service role establishes who is asking', () => {
  const offenders: string[] = []

  for (const file of routeFiles(API)) {
    const source = readFileSync(file, 'utf8')
    if (!usesServiceRole(source)) continue

    const path = relative(file)
    if (REVIEWED[path]) continue
    if (mechanismsIn(source).length > 0) continue

    const calls = source.match(/\bcreateAdminClient\s*\(/g)?.length ?? 0
    offenders.push(
      `${path}\n` +
        `    reaches past RLS (createAdminClient ×${calls}) but never establishes the caller.`,
    )
  }

  assert.deepEqual(
    offenders,
    [],
    '\n' +
      'These routes use the service-role key, which bypasses Row Level Security\n' +
      'completely, without ever working out who is asking. Anyone who can reach\n' +
      'the URL gets whatever the route reads.\n\n' +
      `${offenders.join('\n\n')}\n\n` +
      'Fix by establishing the caller, then scoping the query to them. One of:\n' +
      MECHANISMS.map((m) => `  - ${m.name}`).join('\n') +
      '\n\n' +
      'For a brand-scoped route copy src/app/api/zernio/ads/route.ts — session\n' +
      'client, getUser, then a brand lookup filtered by .eq(\'user_id\', user.id)\n' +
      'so an unowned brand id simply returns nothing. Do not invent a new shape.\n\n' +
      'If a route genuinely must answer strangers, add it to REVIEWED in this\n' +
      'file with a reason that says why the service role cannot reach tenant\n' +
      'data from there. Prefer a real mechanism; the list is a last resort.\n',
  )
})

test('a reviewed exception is still real', () => {
  // An exception that has quietly gained a proper caller check, or whose file
  // has been deleted or renamed, is stale. Left alone it would go on excusing
  // whatever later takes that path. The list must only ever shrink.
  const stale: string[] = []

  for (const [path, reason] of Object.entries(REVIEWED)) {
    const full = resolve(ROOT, path)

    if (!existsSync(full)) {
      stale.push(`${path} — no such file. Delete this entry from REVIEWED.`)
      continue
    }

    assert.ok(reason.trim().length > 40, `${path} — the exception needs a real reason, not a note`)

    const source = readFileSync(full, 'utf8')

    if (!usesServiceRole(source)) {
      stale.push(`${path} — no longer uses the service role. Delete this entry from REVIEWED.`)
      continue
    }

    const found = mechanismsIn(source)
    if (found.length > 0) {
      stale.push(
        `${path} — now checks the caller via ${found.join(', ')}. ` +
          'Delete this entry from REVIEWED; it no longer needs excusing.',
      )
    }
  }

  assert.deepEqual(stale, [], `\n${stale.join('\n')}\n`)
})

test('the guard is not vacuously passing', () => {
  // If the walk found nothing, or the patterns matched everything, this test
  // would pass however wide open the routes were.
  const files = routeFiles(API)
  assert.ok(files.length > 100, `expected the whole API tree, found ${files.length} routes`)

  const serviceRole = files.filter((f) => usesServiceRole(readFileSync(f, 'utf8')))
  assert.ok(
    serviceRole.length > 30,
    `expected many service-role routes, found ${serviceRole.length}`,
  )

  // The shape this test exists to catch: service role, brand id from the query
  // string, nobody asked who is calling.
  const hole = `
    import { createAdminClient } from '@/lib/supabase/admin'
    export async function GET(request: Request) {
      const brandId = new URL(request.url).searchParams.get('brandId')
      const supabase = createAdminClient()
      return Response.json(await supabase.from('brands').select('*').eq('id', brandId))
    }
  `
  assert.ok(usesServiceRole(hole), 'the service-role pattern must match the shape it exists to catch')
  assert.deepEqual(mechanismsIn(hole), [], 'an unauthenticated route must expose no mechanism')

  // An outbound key is not a caller check. This is what zernio/connect had.
  const outbound = `${hole}\n headers: { 'Authorization': \`Bearer \${process.env.ZERNIO_API_KEY}\` }`
  assert.deepEqual(
    mechanismsIn(outbound),
    [],
    'an outbound Authorization header must NOT count as establishing the caller',
  )

  // And the reference route must pass on its own merits.
  const ads = readFileSync(resolve(ROOT, 'src/app/api/zernio/ads/route.ts'), 'utf8')
  assert.ok(usesServiceRole(ads) === false, 'the reference route should not need the service role')
  assert.ok(
    mechanismsIn(ads).length > 0,
    'the reference route must demonstrate a recognised mechanism',
  )
})

test('each mechanism still matches a real route', () => {
  // A pattern that matches nothing in the tree is either a typo or a mechanism
  // that has been removed — and either way it is no longer protecting anything.
  const sources = routeFiles(API).map((f) => readFileSync(f, 'utf8'))
  const unused = MECHANISMS.filter((m) => !sources.some((s) => m.pattern.test(s))).map((m) => m.name)

  assert.deepEqual(
    unused,
    [],
    `\nThese mechanisms match no route, so they are excusing nothing:\n${unused.join('\n')}\n`,
  )
})

/**
 * ─── The cron secret must fail closed ───────────────────────────────────────
 *
 * The test above asks whether a route establishes its caller at all. This one
 * asks a harder question of the routes that answer "the cron secret": can that
 * answer be forged?
 *
 * Every one of these routes was written as
 *
 *     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401
 *
 * which is fail-OPEN. With CRON_SECRET unset — a preview deployment, a renamed
 * variable, a value missing from one Vercel environment — the template
 * interpolates to the literal `"Bearer undefined"`, and every caller who sends
 * that header is authorised. /api/cron/publish-posts then took a service-role
 * client and published every due scheduled_posts row, ACROSS ALL TENANTS, to
 * real connected accounts. Four brands on this platform advertise regulated
 * health services under AHPRA/TGA, so that is a compliance exposure at up to
 * $60K per offence, not merely a bug.
 *
 * The earlier version of this file only grepped for the string CRON_SECRET,
 * which is exactly why it could not see the difference between the safe form
 * and the unsafe one. It now reads the shape of the check.
 *
 * The safe forms, in order of preference:
 *   1. `isCronAuthorised(request)` from src/lib/security/cron-auth.ts.
 *   2. Reading the secret into a local and refusing when it is missing —
 *      `const secret = process.env.CRON_SECRET; if (!secret) return false`.
 */

/** Routes still on the fail-open form, each awaiting its own fix. */
const CRON_FAIL_OPEN_QUARANTINE: Record<string, string> = {
  // Empty, and it must stay empty. Every route that checks the cron secret now
  // does it through `isCronAuthorised`. Adding an entry here is declaring that
  // a route anyone can trigger is acceptable for now — which on this codebase
  // means a stranger reaching a service-role client, so it needs a reason
  // written down and an owner, not a quiet exemption.
}

/**
 * Does this source check CRON_SECRET in a way a stranger can satisfy?
 *
 * Returns null when the file has nothing to say about the cron secret.
 */
function cronCheckIsForgeable(file: string): string | null {
  // Comments go first. cron-auth.ts documents the exact broken form it exists
  // to replace, and a detector that cannot tell code from prose would flag the
  // fix as the bug.
  const source = file
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/[^\n]*$/gm, '')

  if (!/\bCRON_SECRET\b/.test(source) && !/\bisCronAuthorised\s*\(/.test(source)) return null

  // Direct interpolation of the env var into the compared string. This is the
  // whole bug: unset becomes the string "undefined" and the compare succeeds.
  if (/\$\{\s*process\.env\.CRON_SECRET\s*\}/.test(source)) {
    return 'interpolates process.env.CRON_SECRET straight into the compared string, ' +
      'so an unset secret authorises anyone sending `Bearer undefined`'
  }

  // Read into a local instead — safe only if the missing case is refused.
  const local = source.match(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*process\.env\.CRON_SECRET\b/)
  if (local) {
    const name = local[1]
    const guarded = new RegExp(`if\\s*\\(\\s*!\\s*${name}\\b`).test(source)
    if (!guarded) {
      return `reads the secret into \`${name}\` but never refuses when it is missing`
    }
  }

  return null
}

/** Every .ts/.tsx file under src, excluding tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

test('the cron secret is never checked in a way a stranger can satisfy', () => {
  const offenders: string[] = []

  for (const file of sourceFiles(resolve(ROOT, 'src'))) {
    const path = relative(file)
    if (CRON_FAIL_OPEN_QUARANTINE[path]) continue

    const problem = cronCheckIsForgeable(readFileSync(file, 'utf8'))
    if (problem) offenders.push(`${path}\n    ${problem}.`)
  }

  assert.deepEqual(
    offenders,
    [],
    '\n' +
      'These check CRON_SECRET in a form that authorises a stranger whenever the\n' +
      'secret is unset or blank:\n\n' +
      `${offenders.join('\n\n')}\n\n` +
      'Fix by importing isCronAuthorised from @/lib/security/cron-auth and\n' +
      'writing `if (!isCronAuthorised(request)) return 401`. It fails closed: no\n' +
      'secret configured means nobody is authorised. A cron that stops running is\n' +
      'loud and recoverable; a cron anyone can trigger is neither.\n\n' +
      'Do not add an entry to CRON_FAIL_OPEN_QUARANTINE to make this pass — that\n' +
      'list may only ever shrink.\n',
  )
})

test('a quarantined fail-open cron check is still real', () => {
  // The list is a record of work outstanding, not an exemption. An entry whose
  // file has been fixed, moved or deleted must go, or it will quietly excuse
  // whatever later takes that path.
  const stale: string[] = []

  for (const [path, reason] of Object.entries(CRON_FAIL_OPEN_QUARANTINE)) {
    const full = resolve(ROOT, path)

    if (!existsSync(full)) {
      stale.push(`${path} — no such file. Delete this entry.`)
      continue
    }

    assert.ok(reason.trim().length > 40, `${path} — the entry needs a real reason, not a note`)

    if (!cronCheckIsForgeable(readFileSync(full, 'utf8'))) {
      stale.push(`${path} — now checks the secret safely. Delete this entry; it is fixed.`)
    }
  }

  assert.deepEqual(stale, [], `\n${stale.join('\n')}\n`)
})

test('the fail-open guard is not vacuously passing', () => {
  // A detector that matches nothing would let the original bug straight back in.
  const unsafe = 'if (h !== `Bearer ${process.env.CRON_SECRET}`) return unauthorised()'
  assert.ok(cronCheckIsForgeable(unsafe), 'the exact shape this test exists to catch must be caught')

  const unguardedLocal =
    'const secret = process.env.CRON_SECRET\nif (h !== `Bearer ${secret}`) return unauthorised()'
  assert.ok(cronCheckIsForgeable(unguardedLocal), 'an unguarded local read is the same hole')

  const guardedLocal =
    'const secret = process.env.CRON_SECRET\nif (!secret) return false\nreturn h === `Bearer ${secret}`'
  assert.equal(cronCheckIsForgeable(guardedLocal), null, 'the guarded local form is safe')

  assert.equal(
    cronCheckIsForgeable('if (!isCronAuthorised(request)) return unauthorised()'),
    null,
    'the shared helper is the safe form',
  )
  assert.equal(cronCheckIsForgeable('const x = 1'), null, 'unrelated files are not implicated')

  // The helper itself must exist and must refuse an unset secret.
  const helper = readFileSync(resolve(ROOT, 'src/lib/security/cron-auth.ts'), 'utf8')
  assert.match(
    helper,
    /if\s*\(\s*!\s*secret\s*\)\s*return false/,
    'src/lib/security/cron-auth.ts must fail closed when CRON_SECRET is unset',
  )

  // And the routes that publish to live accounts must be on it, by name. These
  // are the ones where a forged trigger reaches a real audience.
  for (const path of [
    'src/app/api/cron/publish-posts/route.ts',
    'src/app/api/heartbeat/route.ts',
    'src/app/api/cron/daily-intel/route.ts',
    'src/app/api/cron/recover-director-jobs/route.ts',
    'src/app/api/cron/monitor-alerts/route.ts',
    'src/app/api/diagnostics/telegram/route.ts',
  ]) {
    const source = readFileSync(resolve(ROOT, path), 'utf8')
    assert.match(source, /\bisCronAuthorised\s*\(request\)/, `${path} must use the shared helper`)
    assert.ok(!CRON_FAIL_OPEN_QUARANTINE[path], `${path} is fixed and must not be quarantined`)
  }
})
