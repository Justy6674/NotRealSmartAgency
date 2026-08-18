import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccountsHealth, listZernioAccounts } from '@/lib/zernio/accounts'
import { listZernioPosts } from '@/lib/zernio/posts'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import { countLivePosts, countWaitingOnYou, type DeskStatusRow } from '@/lib/posts/desk-status'
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
 * ── One definition per number ─────────────────────────────────────────
 * A count must mean what its label says, and two labels reading the same words
 * must mean the same thing. "Waiting on you" here used to be
 * `status IN ('draft','failed')` — 68 posts — while the Posts screen beside it
 * showed the 17 an assistant had written and the owner had not yet approved.
 * Both were called "Waiting on you". Neither route knew the other existed.
 *
 * So neither number is computed here any more: `@/lib/posts/desk-status` owns
 * the derivation and the screen reads the same functions. Same rule for the
 * Posts badge, which counted 121 rows beside a list showing 70 because 51 of
 * them were in the bin.
 *
 * ── Honesty ───────────────────────────────────────────────────────────
 * A number that could not be read is ABSENT, never 0. Absent renders bare;
 * zero renders "nothing is waiting", which is a claim we have not earned. Each
 * source is therefore settled independently: an unreachable publisher costs the
 * account subtitle and nothing else.
 */

/**
 * How many of this business's posts we will read to count them.
 *
 * The two numbers this route puts beside "Waiting on you" and "Posts" cannot
 * be asked of Postgres as a `count`, because neither is a value in the status
 * column: one is derived per row (see `@/lib/posts/desk-status`) and the other
 * has to skip the bin. So the rows come back and we count them here, using the
 * SAME function the screen uses.
 *
 * That means the walk is bounded, and a business with more history than the
 * bound has a real count we have not earned the right to state. It gets
 * `undefined` and the badge renders bare — see the honesty note above. The cap
 * is far above the largest live business (121 rows on 2026-08-18).
 */
const POST_ROW_CAP = 2000

function countOf(result: PromiseSettledResult<{ count: number | null; error: unknown }>): number | undefined {
  if (result.status !== 'fulfilled') return undefined
  if (result.value.error) return undefined
  return typeof result.value.count === 'number' ? result.value.count : undefined
}

interface DeskPostCounts {
  /** Posts that are not in the bin — the number the "All" tab shows. */
  posts?: number
  /** Posts an assistant wrote that the owner has not said yes to. */
  waiting?: number
}

/**
 * Both desk numbers, from one read of the rows.
 *
 * Absent rather than wrong whenever we did not see every row: `count` is the
 * true total from Postgres, so if fewer rows came back than it reports, the cap
 * truncated us and any number we produced would be a floor presented as exact.
 */
function deskCountsFrom(
  result: PromiseSettledResult<{ data: DeskStatusRow[] | null; count: number | null; error: unknown }>,
): DeskPostCounts {
  if (result.status !== 'fulfilled') return {}
  if (result.value.error) return {}
  const rows = result.value.data
  if (!Array.isArray(rows)) return {}
  const total = result.value.count
  if (typeof total === 'number' && total > rows.length) return {}
  return { posts: countLivePosts(rows), waiting: countWaitingOnYou(rows) }
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
    //
    // The posts row is a SELECT rather than a head-count because both numbers
    // it feeds are derived per row and neither exists as a status value. One
    // read, one derivation, so the badge and the screen cannot drift apart.
    const [deskPosts, mediaTotal, templatesTotal] = await Promise.allSettled([
      supabase
        .from('scheduled_posts')
        .select('id, status, metadata', { count: 'exact' })
        .eq('brand_id', brandId)
        .limit(POST_ROW_CAP),
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

    const desk = deskCountsFrom(deskPosts)
    if (deskPosts.status === 'rejected') {
      console.error('[nav-counts] posts could not be read', deskPosts.reason)
    }

    const counts: NavCounts = {}
    if (desk.waiting !== undefined) counts['social-waiting'] = desk.waiting
    if (needsReconnect !== undefined) counts['social-accounts'] = needsReconnect

    const tabCounts: Partial<Record<SocialTabCountId, number>> = {}
    if (desk.posts !== undefined) tabCounts.posts = desk.posts
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
