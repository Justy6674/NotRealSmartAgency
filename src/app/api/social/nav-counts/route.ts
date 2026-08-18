import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccountsHealth, listZernioAccounts } from '@/lib/zernio/accounts'
import { listZernioPosts } from '@/lib/zernio/posts'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import type { NavCounts, NavCountsPayload, SocialTabCountId } from '@/components/agency/shell/nav-sections'

export const dynamic = 'force-dynamic'

/**
 * Every number the shell puts on screen for one business, in one request.
 *
 * ── Why this route exists at all ───────────────────────────────────────
 * `AgencySidebar` has consumed a `counts` prop since it was written and nothing
 * has ever passed one, so no badge in the product could render — including
 * "Waiting on you", the one number the whole approval flow depends on the owner
 * seeing. Meanwhile the business selector counted connected accounts by asking
 * `/api/mixpost/accounts` with no brand at all, receiving the entire fallback
 * workspace, and describing another publisher's accounts to a subscriber whose
 * brand publishes somewhere else entirely.
 *
 * Both faults are the same fault: nobody owned the counting. This route owns
 * it. One caller, one answer, scoped to one business the signed-in person is
 * actually allowed to see.
 *
 * ── Isolation ─────────────────────────────────────────────────────────
 * `zernioProfileForBrand` is the same membership rule the Desk and chat routes
 * use, and it is what turns a brand id from the query string into something we
 * are allowed to count. Beyond it, every Zernio read goes through the service
 * layer, which re-filters to this profile's own accounts in OUR code — a Zernio
 * profile is an organisational boundary, never a security one.
 *
 * ── Honesty ───────────────────────────────────────────────────────────
 * A number that could not be read is ABSENT, never 0. Absent renders bare;
 * zero renders "nothing is waiting", which is a claim we have not earned. Each
 * source is therefore settled independently: an unreachable publisher costs the
 * account subtitle and nothing else.
 */

/** Posts that stop until the owner decides. Drafts and failures both do. */
const WAITING_STATUSES = ['draft', 'failed']

function countOf(result: PromiseSettledResult<{ count: number | null; error: unknown }>): number | undefined {
  if (result.status !== 'fulfilled') return undefined
  if (result.value.error) return undefined
  return typeof result.value.count === 'number' ? result.value.count : undefined
}

function accountsLine(count: number): string {
  if (count === 0) return 'No accounts connected'
  return count === 1 ? '1 account connected' : `${count} accounts connected`
}


/**
 * How many posts this business has actually published.
 *
 * ── The number this replaces ───────────────────────────────────────────
 * `pagination.total` on the listing is upstream's count BEFORE our own
 * account scoping runs. A subscriber on a shared publisher was shown the whole
 * team's history as their own: "210 posts" over three visible rows, and the
 * three rows were the true half. `listZernioPosts` filters to this profile's
 * accounts in our code, after the response is normalised, because a profile is
 * an organisational boundary and never a security one — so the honest count is
 * the number of rows that survive that filter, which means walking the pages.
 *
 * ── Why it can answer "I don't know" ───────────────────────────────────
 * The walk is bounded. A business with more history than the bound has a real
 * count we have not earned the right to state, so the caller gets `undefined`
 * and the badge renders bare. Absent is a fact; a rounded-down total presented
 * as exact is not.
 */
const PUBLISHED_SCAN_LIMIT = 100
const PUBLISHED_SCAN_MAX_PAGES = 5

async function countPublishedForProfile(profileId: string): Promise<number | undefined> {
  // Listed once. Every page below is filtered against this same set rather
  // than re-listing the accounts per page.
  const own = await listZernioAccounts({ profileId })
  const allowed = new Set(own.map((account) => account.id))
  if (allowed.size === 0) return 0

  let counted = 0
  for (let page = 1; page <= PUBLISHED_SCAN_MAX_PAGES; page += 1) {
    const result = await listZernioPosts({
      profileId,
      source: 'external',
      status: 'published',
      page,
      limit: PUBLISHED_SCAN_LIMIT,
      scopeToProfileAccounts: false,
    })
    counted += result.posts.filter((post) =>
      post.accountIds.some((id) => allowed.has(id)),
    ).length

    const pages = result.pagination.pages
    if (result.posts.length === 0) return counted
    if (Number.isFinite(pages) && page >= pages) return counted
  }
  return undefined
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — these numbers are kept per business.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: 'That business could not be found.' }, { status: 404 })
    }

    const profileId = access.brand.profileId

    // Our own tables first. These are cheap, indexed, and they are the numbers
    // that must not depend on a publisher being reachable.
    const [waiting, postsTotal, mediaTotal, templatesTotal] = await Promise.allSettled([
      supabase
        .from('scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('status', WAITING_STATUSES),
      supabase
        .from('scheduled_posts')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId),
      supabase
        .from('media_items')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId),
      supabase
        .from('post_templates')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId),
    ])

    // The publisher. Settled separately and never allowed to fail the request:
    // the approval queue is still the approval queue when Zernio is down.
    let connectedAccounts: number | undefined
    let needsReconnect: number | undefined
    let publishedTotal: number | undefined

    if (profileId) {
      const [connected, health, published] = await Promise.allSettled([
        listZernioAccounts({ profileId, status: 'connected' }),
        fetchZernioAccountsHealth(profileId),
        // `source` is compulsory: the API's own default hides every post
        // published outside this app, which is most of the history.
        countPublishedForProfile(profileId),
      ])

      if (connected.status === 'fulfilled') connectedAccounts = connected.value.length
      else console.error('[nav-counts] connected accounts could not be read', connected.reason)

      if (health.status === 'fulfilled') needsReconnect = health.value.summary.needsReconnect
      else console.error('[nav-counts] account health could not be read', health.reason)

      if (published.status === 'fulfilled') publishedTotal = published.value
      else console.error('[nav-counts] published history could not be read', published.reason)
    } else {
      // No profile linked: this business publishes on the self-hosted fallback,
      // which is what Justin's own brands run on. Same question, other engine.
      try {
        const [mixpostAccounts, allBrands] = await Promise.all([
          fetchMixpostAccounts(),
          supabase.from('brands').select('id, name, slug, social_urls').eq('user_id', access.brand.workspaceOwnerId),
        ])
        if (mixpostAccounts && allBrands.data) {
          const byBrand = mapMixpostAccountsToBrands(mixpostAccounts, allBrands.data)
          connectedAccounts = (byBrand[brandId] ?? []).length
        }
      } catch (err) {
        console.error('[nav-counts] fallback accounts could not be read', err)
      }
    }

    const counts: NavCounts = {}
    const waitingCount = countOf(waiting)
    if (waitingCount !== undefined) counts['social-waiting'] = waitingCount
    if (needsReconnect !== undefined) counts['social-accounts'] = needsReconnect

    const tabCounts: Partial<Record<SocialTabCountId, number>> = {}
    const posts = countOf(postsTotal)
    if (posts !== undefined) tabCounts.posts = posts
    const media = countOf(mediaTotal)
    if (media !== undefined) tabCounts.media = media
    const templates = countOf(templatesTotal)
    if (templates !== undefined) tabCounts.templates = templates

    const payload: NavCountsPayload = {
      brandId,
      counts,
      tabCounts,
      businessSubtitle: connectedAccounts === undefined ? null : accountsLine(connectedAccounts),
      ...(publishedTotal === undefined ? {} : { publishedTotal }),
    }

    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/social/nav-counts GET',
          err,
          'Those numbers could not be read just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}
