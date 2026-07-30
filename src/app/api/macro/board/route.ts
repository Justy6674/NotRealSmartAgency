import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import { buildMacroBoard, type BoardAccountInput, type BoardApprovalInput } from '@/lib/macro/board'

export const dynamic = 'force-dynamic'

/**
 * GET /api/macro/board
 *
 * Every active project in one response. Deliberately takes no project
 * parameter — seeing them all at once is the whole point.
 *
 * The decision of what matters lives in `@/lib/macro/board`; this only
 * gathers. The one judgement made here is about failure: if the social
 * connections cannot be read, `accounts` is passed as null so the board says
 * "not known" rather than reporting every project as having none.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Posts older than this cannot need a decision today, and fetching every
  // post ever written would grow without bound.
  const since = new Date()
  since.setDate(since.getDate() - 30)

  try {
    const [projectsResult, postsResult, approvalsResult, mixpostAccounts, tokensResult] = await Promise.all([
      supabase
        .from('brands')
        .select('id, name, slug, logo_url, compliance_flags, social_urls')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name'),

      supabase
        .from('scheduled_posts')
        .select('id, brand_id, status, scheduled_at, published_at, platform, metadata')
        .eq('user_id', user.id)
        .gte('created_at', since.toISOString())
        .limit(1000),

      supabase
        .from('approval_queue')
        .select('id, action_type, payload, task_id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200),

      fetchMixpostAccounts(),

      // Connections published to directly report when they stop working.
      // Without this the board can only say an account has already lapsed,
      // which is a week too late to do anything about.
      supabase
        .from('social_oauth_tokens')
        .select('brand_id, account_name, platform, expires_at, status')
        .eq('user_id', user.id)
        .eq('status', 'active'),
    ])

    const projects = projectsResult.data ?? []
    const posts = postsResult.data ?? []
    const rawApprovals = approvalsResult.data ?? []

    // Approvals only began recording their project recently. Older rows are
    // recovered through the task they came from, so existing work still lands
    // under the right project instead of disappearing from the board.
    const orphanTaskIds = rawApprovals
      .filter((a) => !(a.payload as Record<string, unknown> | null)?.brand_id && a.task_id)
      .map((a) => a.task_id as string)

    const taskBrand = new Map<string, string>()
    if (orphanTaskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, brand_id')
        .in('id', orphanTaskIds)
      for (const task of tasks ?? []) {
        if (task.brand_id) taskBrand.set(task.id, task.brand_id)
      }
    }

    const approvals: BoardApprovalInput[] = rawApprovals.map((a) => {
      const payload = (a.payload ?? {}) as Record<string, unknown>
      const fromPayload = typeof payload.brand_id === 'string' ? payload.brand_id : null
      return {
        id: a.id,
        brandId: fromPayload ?? (a.task_id ? taskBrand.get(a.task_id) ?? null : null),
        actionType: a.action_type,
        createdAt: a.created_at,
      }
    })

    // A null here means the source was unreachable. That is carried through
    // rather than flattened to an empty list — the two mean opposite things.
    let accounts: BoardAccountInput[] | null = null
    if (mixpostAccounts) {
      const mapped = mapMixpostAccountsToBrands(mixpostAccounts, projects)
      accounts = Object.entries(mapped).flatMap(([brandId, list]) =>
        list.map((account) => ({
          brandId,
          accountName: account.accountName,
          authorized: account.authorized,
        })),
      )
    }

    // Directly-connected accounts sit alongside the ones reached through the
    // publisher; both can stop working, and the owner does not distinguish.
    for (const token of tokensResult.data ?? []) {
      accounts = accounts ?? []
      accounts.push({
        brandId: token.brand_id,
        accountName: token.account_name ?? token.platform,
        authorized: true,
        expiresAt: token.expires_at,
      })
    }

    const board = buildMacroBoard({
      projects,
      posts,
      accounts,
      approvals,
      now: new Date(),
    })

    return NextResponse.json(board)
  } catch (err) {
    console.error('[macro/board] Error:', err)
    return NextResponse.json({ error: 'Failed to build the board' }, { status: 500 })
  }
}
