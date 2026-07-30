/**
 * The Macro Board — one screen showing every project at once.
 *
 * Every other screen in NRS shows a single project, so seeing the state of all
 * of them meant selecting each in turn and reading four surfaces per project.
 * This assembles the same signals into one ranked view of what needs a person.
 *
 * The logic lives here rather than in the route so it can be tested without a
 * database or a browser: the route fetches, this decides.
 *
 * Two rules run through all of it:
 *
 *  - **Unknown is never zero.** A source that could not be reached reports
 *    `null`, which renders as "not known" — never as "nothing connected".
 *    Silence looked exactly like a healthy empty state, which is how a
 *    de-authorised account went unnoticed.
 *  - **Nothing here names plumbing.** The owner is not a developer. Rows say
 *    what to do, not which service or status code produced them.
 */

/** Order of attention. Lower sorts first. */
export const URGENCY_ORDER = ['regulated', 'blocked', 'waiting'] as const
export type Urgency = (typeof URGENCY_ORDER)[number]

/** More than eight things to decide is a list nobody reads. */
export const MAX_DECISIONS = 8

/** Quiet projects collapse into one row once there are this many. */
export const MERGE_QUIET_AT = 3

export type DecisionKind =
  | 'unreviewed_regulated'
  | 'publishing_stopped'
  | 'needs_reconnecting'
  | 'awaiting_approval'
  | 'draft_waiting'
  | 'nothing_planned'

export interface BoardDecision {
  id: string
  projectId: string
  projectName: string
  kind: DecisionKind
  urgency: Urgency
  /** One line, shown as the row title. */
  headline: string
  /** One line of context under the headline. */
  detail: string
  /** Pre-written into the Director when the row is clicked. */
  suggestedAction: string
  /** Drives ordering within an urgency band — bigger is more pressing. */
  weight: number
}

export interface BoardProject {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  regulated: boolean
  /** null means the social connection could not be read, not that there are none. */
  accountCount: number | null
  /** Names of connected accounts that have stopped working. */
  needsReconnecting: string[]
  scheduledThisWeek: number
  publishedThisWeek: number
  failed: number
  unreviewedRegulated: number
  draftsWaiting: number
  awaitingApproval: number
  state: 'attention' | 'waiting' | 'steady' | 'quiet'
  /** Pre-written into the Director when the project tile is clicked. */
  suggestedAction: string
}

export interface MacroBoard {
  projects: BoardProject[]
  decisions: BoardDecision[]
  /** True when every project's social connections were readable. */
  connectionsKnown: boolean
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Inputs — deliberately minimal so tests can build them by hand.
// ---------------------------------------------------------------------------

export interface BoardProjectInput {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  compliance_flags?: { ahpra?: boolean; tga?: boolean } | null
}

export interface BoardPostInput {
  id: string
  brand_id: string
  status: string
  scheduled_at?: string | null
  published_at?: string | null
  caption?: string | null
  platform?: string | null
  metadata?: Record<string, unknown> | null
}

export interface BoardAccountInput {
  brandId: string
  accountName: string
  /** false means the connection has lapsed and will not publish. */
  authorized: boolean
}

export interface BoardApprovalInput {
  id: string
  brandId: string | null
  actionType: string
  createdAt: string
}

export interface BuildBoardInput {
  projects: BoardProjectInput[]
  posts: BoardPostInput[]
  /** null when the social connections could not be read at all. */
  accounts: BoardAccountInput[] | null
  approvals: BoardApprovalInput[]
  /** Injected so results are stable under test. */
  now: Date
}

// ---------------------------------------------------------------------------

function isRegulated(p: BoardProjectInput): boolean {
  return Boolean(p.compliance_flags?.ahpra || p.compliance_flags?.tga)
}

/**
 * Whether a scheduled post has a recorded review.
 *
 * Nothing stamps these fields today, so for a regulated project everything
 * scheduled reads as unreviewed — which is the honest answer, because no
 * review has in fact been recorded. When the approval path starts stamping
 * them the board narrows on its own, with no change here.
 */
export function hasRecordedReview(post: BoardPostInput): boolean {
  const meta = post.metadata ?? {}
  return Boolean(meta.compliance_reviewed || meta.approved_at || meta.approved_by)
}

function withinNextWeek(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return false
  const week = now.getTime() + 7 * 24 * 60 * 60 * 1000
  return at >= now.getTime() && at <= week
}

function withinLastWeek(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return false
  const week = now.getTime() - 7 * 24 * 60 * 60 * 1000
  return at <= now.getTime() && at >= week
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * Assemble the board.
 *
 * Ranking is regulated first, then blocked, then waiting; within a band the
 * heavier item wins, and ties break on project name so the order does not
 * shuffle between refreshes.
 */
export function buildMacroBoard(input: BuildBoardInput): MacroBoard {
  const { projects, posts, accounts, approvals, now } = input

  const postsByProject = new Map<string, BoardPostInput[]>()
  for (const post of posts) {
    const list = postsByProject.get(post.brand_id) ?? []
    list.push(post)
    postsByProject.set(post.brand_id, list)
  }

  const accountsByProject = new Map<string, BoardAccountInput[]>()
  if (accounts) {
    for (const account of accounts) {
      const list = accountsByProject.get(account.brandId) ?? []
      list.push(account)
      accountsByProject.set(account.brandId, list)
    }
  }

  const approvalsByProject = new Map<string, BoardApprovalInput[]>()
  for (const approval of approvals) {
    if (!approval.brandId) continue
    const list = approvalsByProject.get(approval.brandId) ?? []
    list.push(approval)
    approvalsByProject.set(approval.brandId, list)
  }

  const decisions: BoardDecision[] = []
  const boardProjects: BoardProject[] = []

  for (const project of projects) {
    const regulated = isRegulated(project)
    const own = postsByProject.get(project.id) ?? []
    const projectAccounts = accounts ? (accountsByProject.get(project.id) ?? []) : null
    const pendingApprovals = approvalsByProject.get(project.id) ?? []

    const scheduled = own.filter(
      (p) => p.status === 'scheduled' && withinNextWeek(p.scheduled_at, now),
    )
    const publishedThisWeek = own.filter(
      (p) => p.status === 'published' && withinLastWeek(p.published_at, now),
    ).length
    const failed = own.filter((p) => p.status === 'failed')
    const drafts = own.filter((p) => p.status === 'draft')
    const unreviewed = regulated ? scheduled.filter((p) => !hasRecordedReview(p)) : []
    const lapsed = (projectAccounts ?? []).filter((a) => !a.authorized)

    // --- regulated band ---------------------------------------------------
    if (unreviewed.length > 0) {
      decisions.push({
        id: `${project.id}:unreviewed`,
        projectId: project.id,
        projectName: project.name,
        kind: 'unreviewed_regulated',
        urgency: 'regulated',
        headline: `${unreviewed.length} ${plural(unreviewed.length, 'post is', 'posts are')} due to go out without your sign-off`,
        detail: `${project.name} advertises a regulated health service, so this needs your review before it publishes.`,
        suggestedAction: `Show me the ${unreviewed.length} ${plural(unreviewed.length, 'post', 'posts')} scheduled for ${project.name} that I have not signed off yet. Check each one against the advertising rules and tell me what to change.`,
        weight: unreviewed.length,
      })
    }

    // --- blocked band -----------------------------------------------------
    if (lapsed.length > 0) {
      const names = lapsed.map((a) => a.accountName).join(', ')
      decisions.push({
        id: `${project.id}:reconnect`,
        projectId: project.id,
        projectName: project.name,
        kind: 'needs_reconnecting',
        urgency: 'blocked',
        headline: `${names} needs reconnecting`,
        detail: `Nothing can go out to ${lapsed.length === 1 ? 'this account' : 'these accounts'} until the connection is renewed.`,
        suggestedAction: `The ${names} connection for ${project.name} has stopped working. Walk me through reconnecting it, one step at a time.`,
        weight: 100 + lapsed.length,
      })
    }

    if (failed.length > 0) {
      decisions.push({
        id: `${project.id}:failed`,
        projectId: project.id,
        projectName: project.name,
        kind: 'publishing_stopped',
        urgency: 'blocked',
        headline: `${failed.length} ${plural(failed.length, 'post', 'posts')} did not go out`,
        detail: `Written and scheduled, but ${plural(failed.length, 'it never published', 'they never published')}.`,
        suggestedAction: `${failed.length} ${plural(failed.length, 'post', 'posts')} for ${project.name} did not go out. Tell me in plain words why, and what you need from me to get ${plural(failed.length, 'it', 'them')} published.`,
        weight: 50 + failed.length,
      })
    }

    // --- waiting band -----------------------------------------------------
    if (pendingApprovals.length > 0) {
      decisions.push({
        id: `${project.id}:approvals`,
        projectId: project.id,
        projectName: project.name,
        kind: 'awaiting_approval',
        urgency: 'waiting',
        headline: `${pendingApprovals.length} ${plural(pendingApprovals.length, 'thing is', 'things are')} waiting on your yes`,
        detail: `Work is finished and paused until you approve it.`,
        suggestedAction: `Show me everything waiting on my approval for ${project.name}, one at a time, with your recommendation on each.`,
        weight: 20 + pendingApprovals.length,
      })
    }

    if (drafts.length > 0) {
      decisions.push({
        id: `${project.id}:drafts`,
        projectId: project.id,
        projectName: project.name,
        kind: 'draft_waiting',
        urgency: 'waiting',
        headline: `${drafts.length} ${plural(drafts.length, 'draft is', 'drafts are')} written but not scheduled`,
        detail: `Ready to go out once you pick a time.`,
        suggestedAction: `Show me the ${drafts.length} unscheduled ${plural(drafts.length, 'draft', 'drafts')} for ${project.name} and suggest when each should go out.`,
        weight: 10 + Math.min(drafts.length, 9),
      })
    }

    if (scheduled.length === 0 && drafts.length === 0 && failed.length === 0) {
      decisions.push({
        id: `${project.id}:empty`,
        projectId: project.id,
        projectName: project.name,
        kind: 'nothing_planned',
        urgency: 'waiting',
        headline: `Nothing planned this week`,
        detail: `${project.name} has no content written or scheduled for the next seven days.`,
        suggestedAction: `${project.name} has nothing going out this week. Suggest a week of content that fits the brand, and show me the drafts before anything is scheduled.`,
        weight: 1,
      })
    }

    const state: BoardProject['state'] =
      unreviewed.length > 0 || failed.length > 0 || lapsed.length > 0
        ? 'attention'
        : pendingApprovals.length > 0 || drafts.length > 0
          ? 'waiting'
          : scheduled.length > 0 || publishedThisWeek > 0
            ? 'steady'
            : 'quiet'

    const suggestedAction =
      unreviewed.length > 0
        ? `Check the ${unreviewed.length} scheduled ${plural(unreviewed.length, 'post', 'posts')} for ${project.name} against the advertising rules before ${plural(unreviewed.length, 'it goes', 'they go')} out.`
        : lapsed.length > 0
          ? `Help me reconnect ${lapsed.map((a) => a.accountName).join(', ')} for ${project.name}.`
          : failed.length > 0
            ? `Tell me why ${failed.length} ${plural(failed.length, 'post', 'posts')} for ${project.name} did not go out, and fix it.`
            : drafts.length > 0
              ? `Show me the unscheduled drafts for ${project.name} and suggest when each should go out.`
              : scheduled.length > 0
                ? `Show me what is going out for ${project.name} this week.`
                : `${project.name} has nothing planned. Suggest a week of content and show me the drafts first.`

    boardProjects.push({
      id: project.id,
      name: project.name,
      slug: project.slug,
      logoUrl: project.logo_url ?? null,
      regulated,
      accountCount: projectAccounts === null ? null : projectAccounts.length,
      needsReconnecting: lapsed.map((a) => a.accountName),
      scheduledThisWeek: scheduled.length,
      publishedThisWeek,
      failed: failed.length,
      unreviewedRegulated: unreviewed.length,
      draftsWaiting: drafts.length,
      awaitingApproval: pendingApprovals.length,
      state,
      suggestedAction,
    })
  }

  // A quiet project is worth one line, not eight. Run against the real
  // portfolio the list filled entirely with "nothing planned this week", which
  // is true of most projects most weeks and pushed everything else off. Merged,
  // it says the same thing in one row and leaves room for work that is stuck.
  const quiet = decisions.filter((d) => d.kind === 'nothing_planned')
  if (quiet.length >= MERGE_QUIET_AT) {
    const names = quiet.map((d) => d.projectName).sort((a, b) => a.localeCompare(b))
    const list = names.join(', ')
    for (const row of quiet) decisions.splice(decisions.indexOf(row), 1)
    decisions.push({
      id: 'quiet:merged',
      // Clicking opens the first of them; the action names all of them.
      projectId: quiet[0].projectId,
      projectName: list,
      kind: 'nothing_planned',
      urgency: 'waiting',
      headline: `${names.length} projects have nothing planned this week`,
      detail: list,
      suggestedAction: `${list} have nothing going out this week. Suggest a week of content for each, and show me the drafts before anything is scheduled.`,
      weight: 2,
    })
  }

  decisions.sort((a, b) => {
    const band = URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency)
    if (band !== 0) return band
    if (b.weight !== a.weight) return b.weight - a.weight
    return a.projectName.localeCompare(b.projectName)
  })

  return {
    projects: boardProjects,
    decisions: decisions.slice(0, MAX_DECISIONS),
    connectionsKnown: accounts !== null,
    generatedAt: now.toISOString(),
  }
}
