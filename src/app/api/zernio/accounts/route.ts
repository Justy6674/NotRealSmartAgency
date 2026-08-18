import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts, getZernioClient } from '@/lib/zernio/client'
import { fetchZernioAccountsHealth } from '@/lib/zernio/accounts'

export const dynamic = 'force-dynamic'

/**
 * The social accounts connected to ONE brand the signed-in person owns, and
 * whether each of them can actually post.
 *
 * This route used to run on the service-role key — which bypasses Row Level
 * Security entirely — with `brandId` taken straight from the query string and
 * no check of any kind on the caller. Anyone who could reach the URL with a
 * brand uuid was handed that tenant's connected accounts: platforms, handles
 * and display names. There was no session, no API key, nothing.
 *
 * The shape is copied from /api/zernio/ads, one directory over, which does the
 * same job correctly: session client, `auth.getUser`, then a brand lookup
 * filtered by `user_id` so an unowned brand id matches no row.
 *
 * The service role is gone rather than merely gated. A signed-in owner reading
 * their own brand needs nothing that RLS would refuse them.
 *
 * 401 and 403 are deliberately different answers: 401 is "nobody is signed in",
 * 403 is "someone is, and this brand is not theirs". 403 also covers "no such
 * brand" on purpose — telling those apart would let a signed-in person work out
 * which brand ids exist.
 *
 * Who counts as "theirs" is decided by `zernioProfileForBrand` in src/lib/auth,
 * not restated here. It honours an accepted team admin the same way /api/brands
 * and the Desk do — this route being owner-only meant such a person saw an
 * empty accounts list with nothing on screen to explain it.
 *
 * ── Health is measured, never assumed ──────────────────────────────────
 * Every account used to leave here with no health at all and the browser
 * stamped `status: 'active'` on all of them. The dot was a constant. Measured
 * live on 2026-08-18: ten accounts, eight healthy, TWO IN WARNING, while the
 * desk said everything was fine — so the first the owner would have known about
 * an expiring token was a failed publish, which is the one moment he can do
 * nothing about it. The health lookup now travels with the list.
 *
 * ── What decides ownership ────────────────────────────────────────────
 * `fetchZernioAccounts(profileId)` and nothing else. The decoration pass below
 * asks the publisher for richer fields (avatar, follower count, whether the
 * owner ever switched the account on), and every one of those rows is discarded
 * unless its id is already in the scoped set. A publisher profile is an
 * organisational boundary, never a security one.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so no accounts could be read. Sign in and try again.'

const NOT_YOURS =
  'That brand could not be opened under this sign-in, so no accounts were read.'

const NO_BRAND =
  'Choose a business first — connected accounts are kept per business.'

export interface DeskSocialAccount {
  id: string
  platform: string
  displayName?: string
  username?: string
  /** Avatar on the platform. Absent is normal — several platforms give none. */
  image?: string
  /** Where this account lives on its own platform, for "View profile". */
  profileUrl?: string
  /** ISO date the account was connected, when the publisher records one. */
  connectedAt?: string
  followers?: number
  /**
   * false means the owner never switched this account on. Posting and the
   * scheduler skip it, so the grid must say so rather than showing it as
   * ordinary — an account that silently never posts is worse than a missing one.
   */
  enabled: boolean
  /** 'unknown' when no health row came back — absent is not the same as fine. */
  health: 'healthy' | 'warning' | 'error' | 'unknown'
  needsReconnect: boolean
  canPost: boolean
  tokenExpiresAt?: string
  issues: string[]
}

/** Rows off the wire, read defensively: `_id` here, `id` there, both accepted. */
function decorationOf(raw: unknown): {
  id: string
  image?: string
  profileUrl?: string
  connectedAt?: string
  followers?: number
  enabled: boolean
} | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = String(rec.id ?? rec._id ?? '')
  if (!id) return null
  const picture = rec.profilePicture
  const created = rec.createdAt ?? rec.connectedAt
  return {
    id,
    ...(typeof picture === 'string' && picture ? { image: picture } : {}),
    ...(typeof rec.profileUrl === 'string' ? { profileUrl: rec.profileUrl } : {}),
    ...(typeof created === 'string' ? { connectedAt: created } : {}),
    ...(typeof rec.followersCount === 'number' ? { followers: rec.followersCount } : {}),
    // Absent means the publisher did not say. Only an explicit false is a
    // switched-off account; treating silence as "off" would empty the grid.
    enabled: rec.enabled !== false,
  }
}

async function decorations(profileId: string): Promise<Map<string, ReturnType<typeof decorationOf>>> {
  const out = new Map<string, ReturnType<typeof decorationOf>>()
  try {
    const zernio = getZernioClient('accounts.listAccounts (decoration)')
    // No page/limit: the pair must travel together or the call answers 400, and
    // one brand's accounts are a short list.
    const result = await zernio.accounts.listAccounts({ query: { profileId } })
    const body = (result as { data?: unknown }).data as Record<string, unknown> | undefined
    const rows = Array.isArray(body?.accounts) ? body.accounts : []
    for (const row of rows) {
      const dec = decorationOf(row)
      if (dec) out.set(dec.id, dec)
    }
  } catch (err) {
    // Decoration only. A failure here costs an avatar, never the list, so it is
    // logged and swallowed rather than failing the whole page.
    console.error('[api/zernio/accounts] decoration pass failed', err)
  }
  return out
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const brandId = new URL(request.url).searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: NO_BRAND }, { status: 400 })

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    // Linked to no publisher profile, or no publisher key on this deployment.
    // Both are real answers about a brand this person owns, not failures.
    // `linked` is the signal the UI needs: a linked brand must not fall
    // through to the self-hosted workspace list, even when this list is empty.
    if (access.brand.profileId === null) {
      return NextResponse.json({ linked: false, accounts: [], summary: null })
    }

    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ linked: true, accounts: [], summary: null })
    }

    const profileId = access.brand.profileId
    const scoped = await fetchZernioAccounts(profileId)

    // Health and decoration are independent of each other and of the list.
    // Settled rather than awaited together so one slow lookup cannot take the
    // page down with it.
    const [healthResult, decorated] = await Promise.allSettled([
      fetchZernioAccountsHealth(profileId),
      decorations(profileId),
    ])

    const health = healthResult.status === 'fulfilled' ? healthResult.value : null
    if (healthResult.status === 'rejected') {
      console.error('[api/zernio/accounts] health lookup failed', healthResult.reason)
    }
    const byId = new Map((health?.accounts ?? []).map((entry) => [entry.accountId, entry]))
    const extras = decorated.status === 'fulfilled' ? decorated.value : new Map()

    const accounts: DeskSocialAccount[] = scoped.map((account) => {
      const entry = byId.get(account.id)
      const extra = extras.get(account.id) ?? null
      return {
        id: account.id,
        platform: account.platform,
        ...(account.displayName ? { displayName: account.displayName } : {}),
        ...(account.username ? { username: account.username } : {}),
        ...(extra?.image ? { image: extra.image } : {}),
        ...(extra?.profileUrl ? { profileUrl: extra.profileUrl } : {}),
        ...(extra?.connectedAt ? { connectedAt: extra.connectedAt } : {}),
        ...(typeof extra?.followers === 'number' ? { followers: extra.followers } : {}),
        enabled: extra?.enabled ?? true,
        // No health row is 'unknown', not 'healthy'. The whole point of this
        // change is that an unmeasured account stops reading as a fine one.
        health: entry?.status ?? 'unknown',
        needsReconnect: entry?.needsReconnect ?? false,
        canPost: entry?.canPost ?? true,
        ...(entry?.tokenExpiresAt ? { tokenExpiresAt: entry.tokenExpiresAt } : {}),
        issues: entry?.issues ?? [],
      }
    })

    const summary = {
      total: accounts.length,
      healthy: accounts.filter((a) => a.health === 'healthy').length,
      warning: accounts.filter((a) => a.health === 'warning').length,
      error: accounts.filter((a) => a.health === 'error').length,
      needsReconnect: accounts.filter((a) => a.needsReconnect).length,
      unknown: accounts.filter((a) => a.health === 'unknown').length,
    }

    return NextResponse.json({ linked: true, accounts, summary })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/accounts GET',
          err,
          'The connected accounts could not be read just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}

/**
 * Ownership for a write. Returns the profile id when this person may act on
 * this account, and null otherwise.
 *
 * The publisher validates an account id against the whole TEAM, not against a
 * profile, so without this check a signed-in subscriber could rename or remove
 * another subscriber's account by guessing an id. The check is ours because it
 * cannot be theirs.
 */
async function assertOwnsAccount(
  body: { brandId?: unknown; accountId?: unknown },
): Promise<{ ok: true; accountId: string } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 }) }
  }

  const brandId = typeof body.brandId === 'string' ? body.brandId : null
  const accountId = typeof body.accountId === 'string' ? body.accountId : null
  if (!brandId) {
    return { ok: false, response: NextResponse.json({ error: NO_BRAND }, { status: 400 }) }
  }
  if (!accountId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No account was named, so nothing was changed.' }, { status: 400 }),
    }
  }

  const access = await zernioProfileForBrand(supabase, user.id, brandId)
  if (access.access === 'denied' || access.brand.profileId === null) {
    return { ok: false, response: NextResponse.json({ error: NOT_YOURS }, { status: 403 }) }
  }

  const scoped = await fetchZernioAccounts(access.brand.profileId)
  if (!scoped.some((a) => a.id === accountId)) {
    return { ok: false, response: NextResponse.json({ error: NOT_YOURS }, { status: 403 }) }
  }

  return { ok: true, accountId }
}

/** Rename an account as it reads on the desk. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      brandId?: unknown
      accountId?: unknown
      displayName?: unknown
    }
    const owned = await assertOwnsAccount(body)
    if (!owned.ok) return owned.response

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
    if (!displayName) {
      return NextResponse.json(
        { error: 'Give the account a name first — nothing has been changed.' },
        { status: 400 },
      )
    }

    const zernio = getZernioClient('accounts.updateAccount')
    const result = await zernio.accounts.updateAccount({
      path: { accountId: owned.accountId },
      body: { displayName },
    })
    const failure = (result as { error?: unknown }).error
    if (failure) {
      console.error('[api/zernio/accounts] rename refused', failure)
      return NextResponse.json(
        { error: 'That account could not be renamed just now. Nothing has been changed.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, displayName })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/accounts PATCH',
          err,
          'That account could not be renamed just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}

/**
 * Remove an account from this business.
 *
 * Surfaced to the owner as "Remove", never "Delete account" — nothing on the
 * platform itself is touched, and a word that reads like it deletes his
 * Instagram is a word that stops him ever pressing the button he needs.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const owned = await assertOwnsAccount({
      brandId: searchParams.get('brandId') ?? undefined,
      accountId: searchParams.get('accountId') ?? undefined,
    })
    if (!owned.ok) return owned.response

    const zernio = getZernioClient('accounts.deleteAccount')
    const result = await zernio.accounts.deleteAccount({ path: { accountId: owned.accountId } })
    const failure = (result as { error?: unknown }).error
    if (failure) {
      console.error('[api/zernio/accounts] removal refused', failure)
      return NextResponse.json(
        { error: 'That account could not be removed just now. Nothing has been changed.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/accounts DELETE',
          err,
          'That account could not be removed just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}
