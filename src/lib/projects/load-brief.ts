/**
 * Fetch everything a brief needs and assemble it.
 *
 * The one loader behind both the plugged-in client and the web Director. They
 * used to answer from whatever each happened to fetch, so the same question
 * about the same project could come back two different ways.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMacroBoard, type BoardAccountInput } from '@/lib/macro/board'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import { buildProjectBrief, renderProjectBrief, type ProjectBrief } from './brief'

export interface LoadBriefResult {
  brief: ProjectBrief
  /** The brief as text, for a caller that reads rather than parses. */
  text: string
}

/**
 * Build the brief for one project.
 *
 * Returns null when the project is not visible to this caller — the row is
 * fetched through whichever client was passed, so a connection that was never
 * granted a project simply does not find it.
 */
export async function loadProjectBrief(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<LoadBriefResult | null> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [projectResult, sectionsResult, postsResult, approvalsResult, mixpostAccounts] =
    await Promise.all([
      supabase
        .from('brands')
        .select(
          'id, name, slug, website_url, logo_url, description, brand_colours, compliance_flags, tone_of_voice, brand_dna_constraints, content_pillars, social_urls',
        )
        .eq('id', projectId)
        .maybeSingle(),

      supabase
        .from('brand_proforma_sections')
        .select('section_key, section_title, section_data, rag_status, review_cadence, last_reviewed_at')
        .eq('brand_id', projectId),

      supabase
        .from('scheduled_posts')
        .select('id, brand_id, status, scheduled_at, published_at, platform, metadata')
        .eq('brand_id', projectId)
        .gte('created_at', since.toISOString())
        .limit(500),

      supabase
        .from('approval_queue')
        .select('id, action_type, payload, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .limit(200),

      fetchMixpostAccounts(),
    ])

  const project = projectResult.data
  if (!project) return null

  // Unreadable connections stay null so the brief says "not known" rather than
  // reporting the project as having none.
  let accounts: BoardAccountInput[] | null = null
  if (mixpostAccounts) {
    const mapped = mapMixpostAccountsToBrands(mixpostAccounts, [project])
    accounts = (mapped[project.id] ?? []).map((a) => ({
      brandId: project.id,
      accountName: a.accountName,
      authorized: a.authorized,
    }))
  }

  const now = new Date()
  const board = buildMacroBoard({
    projects: [project],
    posts: postsResult.data ?? [],
    accounts,
    approvals: (approvalsResult.data ?? [])
      .map((a) => {
        const payload = (a.payload ?? {}) as Record<string, unknown>
        return {
          id: a.id,
          brandId: typeof payload.brand_id === 'string' ? payload.brand_id : null,
          actionType: a.action_type,
          createdAt: a.created_at,
        }
      })
      .filter((a) => a.brandId === project.id),
    now,
  })

  const brief = buildProjectBrief({
    project,
    sections: sectionsResult.data ?? [],
    risks: board.decisions.filter((d) => d.projectId === project.id),
    board: board.projects[0] ?? null,
    now,
  })

  return { brief, text: renderProjectBrief(brief) }
}

/**
 * A one-line state for each project, for a list that should say how things are
 * going rather than only what they are called.
 */
export function describeProjectState(row: {
  state: string
  scheduledThisWeek: number
  draftsWaiting: number
  awaitingApproval: number
  unreviewedRegulated: number
  failed: number
  needsReconnecting: string[]
  accountCount: number | null
}): string {
  if (row.unreviewedRegulated > 0) {
    return `${row.unreviewedRegulated} scheduled without sign-off — needs review before it publishes`
  }
  if (row.needsReconnecting.length > 0) {
    return `${row.needsReconnecting.join(', ')} needs reconnecting — nothing can go out to ${row.needsReconnecting.length === 1 ? 'it' : 'them'}`
  }
  if (row.failed > 0) return `${row.failed} did not go out`
  if (row.draftsWaiting + row.awaitingApproval > 0) {
    const n = row.draftsWaiting + row.awaitingApproval
    return `${n} ${n === 1 ? 'thing' : 'things'} waiting on the owner`
  }
  if (row.scheduledThisWeek > 0) return `${row.scheduledThisWeek} going out this week`
  return 'nothing planned this week'
}
