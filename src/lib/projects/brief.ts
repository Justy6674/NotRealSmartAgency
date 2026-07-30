/**
 * Everything an AI needs to work on a project, in one answer.
 *
 * A plugged-in client had to know which tool to call, in what order, to learn
 * anything about a project: one call for the brand contract, another for the
 * calendar, another for outputs — and nothing at all told it what was stale or
 * at risk. So it guessed, and guessing is how work came back off-brand.
 *
 * This is the single source both the plugged-in client and the web Director
 * read from, so the two cannot give different answers about the same project.
 * The callers gather; this decides.
 */

import type { BoardDecision, BoardProject } from '@/lib/macro/board'

/** How long a section may go unreviewed before it is stale. */
const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 90,
}

const DEFAULT_CADENCE_DAYS = 30

export interface BriefProjectInput {
  id: string
  name: string
  slug: string
  website_url?: string | null
  logo_url?: string | null
  description?: string | null
  brand_colours?: Record<string, string> | null
  compliance_flags?: { ahpra?: boolean; tga?: boolean } | null
  tone_of_voice?: { keywords?: string[]; avoid_words?: string[]; formality?: string; humour?: string } | null
  brand_dna_constraints?: { voice_rules?: string[]; banned_words?: string[]; never_do?: string[] } | null
  content_pillars?: string[] | null
}

export interface BriefSectionInput {
  section_key: string
  section_title: string
  section_data?: Record<string, unknown> | null
  rag_status?: string | null
  review_cadence?: string | null
  last_reviewed_at?: string | null
}

export interface StaleSection {
  key: string
  title: string
  /** null when it has never been reviewed at all. */
  daysOverdue: number | null
  empty: boolean
}

export interface ProjectBrief {
  project: {
    id: string
    name: string
    slug: string
    website: string | null
    regulated: boolean
    /** Plain description of which rules apply, or null. */
    regime: string | null
  }
  contract: {
    colours: Record<string, string> | null
    logo: string | null
    voiceKeywords: string[]
    avoidWords: string[]
    voiceRules: string[]
    neverDo: string[]
    contentPillars: string[]
    /** Parts of the contract that are not set, so an AI stops inventing them. */
    missing: string[]
  }
  atRisk: Array<{ headline: string; detail: string; urgency: BoardDecision['urgency'] }>
  stale: StaleSection[]
  /** Three things worth doing next, most pressing first. */
  nextActions: string[]
  /** One paragraph a client can read without parsing anything. */
  summary: string
}

export interface BuildBriefInput {
  project: BriefProjectInput
  sections: BriefSectionInput[]
  /** Decisions from the board that belong to this project. */
  risks: BoardDecision[]
  /** This project's row on the board, when it has one. */
  board: BoardProject | null
  now: Date
}

function daysBetween(from: string, now: Date): number {
  const then = new Date(from).getTime()
  if (Number.isNaN(then)) return 0
  return Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000))
}

function isEmpty(data: Record<string, unknown> | null | undefined): boolean {
  return !data || Object.keys(data).length === 0
}

/**
 * Which sections are past their own review date.
 *
 * A section that has never been reviewed counts as stale rather than as new.
 * Most sections in the portfolio have never been reviewed once, so treating
 * "never" as "not yet due" would report everything as healthy forever.
 */
export function findStaleSections(
  sections: readonly BriefSectionInput[],
  now: Date,
): StaleSection[] {
  const stale: StaleSection[] = []

  for (const section of sections) {
    const allowed = CADENCE_DAYS[section.review_cadence ?? ''] ?? DEFAULT_CADENCE_DAYS
    const empty = isEmpty(section.section_data)

    if (!section.last_reviewed_at) {
      stale.push({ key: section.section_key, title: section.section_title, daysOverdue: null, empty })
      continue
    }

    const age = daysBetween(section.last_reviewed_at, now)
    if (age > allowed) {
      stale.push({
        key: section.section_key,
        title: section.section_title,
        daysOverdue: age - allowed,
        empty,
      })
    }
  }

  // Never-reviewed first, then the most overdue.
  return stale.sort((a, b) => {
    if (a.daysOverdue === null && b.daysOverdue === null) return a.title.localeCompare(b.title)
    if (a.daysOverdue === null) return -1
    if (b.daysOverdue === null) return 1
    return b.daysOverdue - a.daysOverdue
  })
}

function describeRegime(flags: BriefProjectInput['compliance_flags']): string | null {
  const parts = [
    flags?.ahpra ? 'advertising a regulated health service' : null,
    flags?.tga ? 'therapeutic goods' : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' and ') : null
}

/**
 * What the brand contract does not have.
 *
 * Naming the gaps is the point: an AI told nothing about colours invents a
 * palette, which is how designs came back off-brand while the copy was right.
 */
function findMissing(project: BriefProjectInput): string[] {
  const missing: string[] = []
  if (!project.brand_colours || Object.keys(project.brand_colours).length === 0) {
    missing.push('brand colours')
  }
  if (!project.logo_url) missing.push('logo')
  if (!project.tone_of_voice?.keywords?.length) missing.push('voice keywords')
  if (!project.content_pillars?.length) missing.push('content pillars')
  if (!project.website_url) missing.push('website')
  return missing
}

/**
 * Assemble the brief.
 *
 * Next actions are ranked by consequence: something a regulator would care
 * about, then something that has stopped, then a gap that makes every future
 * piece of work wrong, then the oldest neglected section.
 */
export function buildProjectBrief(input: BuildBriefInput): ProjectBrief {
  const { project, sections, risks, board, now } = input

  const regime = describeRegime(project.compliance_flags)
  const regulated = regime !== null
  const stale = findStaleSections(sections, now)
  const missing = findMissing(project)

  const ordered = [...risks].sort((a, b) => {
    const rank = { regulated: 0, blocked: 1, waiting: 2 } as const
    return rank[a.urgency] - rank[b.urgency]
  })

  const actions: string[] = []

  // Waiting items are capped at one. Left uncapped they fill all three slots
  // on any busy project and push out the gaps and stale work, which is the
  // whole reason a brief exists rather than a queue.
  let waitingUsed = 0
  for (const risk of ordered) {
    if (actions.length >= 3) break
    if (risk.urgency === 'waiting') {
      if (waitingUsed >= 1) continue
      waitingUsed++
    }
    actions.push(risk.suggestedAction)
  }

  if (actions.length < 3 && missing.length > 0) {
    actions.push(
      `${project.name} has no ${missing.slice(0, 2).join(' and ')} recorded. Find ${missing.length === 1 ? 'it' : 'them'} from the website and save ${missing.length === 1 ? 'it' : 'them'}, so work stops being guessed.`,
    )
  }

  const neverReviewed = stale.filter((s) => s.daysOverdue === null)
  if (actions.length < 3 && stale.length > 0) {
    const worst = stale[0]
    actions.push(
      neverReviewed.length > 3
        ? `${neverReviewed.length} parts of ${project.name}'s plan have never been filled in. Start with ${worst.title} and work through them.`
        : `${worst.title} for ${project.name} is out of date. Review it and bring it current.`,
    )
  }

  // The board already raises an empty week as a risk, so adding it again here
  // put the same sentence in slots one and three.
  const emptyWeekAlreadyRaised = ordered.some((r) => r.kind === 'nothing_planned')
  if (actions.length < 3 && board && board.scheduledThisWeek === 0 && !emptyWeekAlreadyRaised) {
    actions.push(
      `${project.name} has nothing going out this week. Suggest a week of content and show the drafts before anything is scheduled.`,
    )
  }

  const summaryParts = [
    `${project.name}${regime ? ` is ${regime}, so everything it publishes is reviewed first` : ''}.`,
    board
      ? `${board.scheduledThisWeek} ${board.scheduledThisWeek === 1 ? 'post is' : 'posts are'} scheduled this week and ${board.draftsWaiting + board.awaitingApproval} ${board.draftsWaiting + board.awaitingApproval === 1 ? 'thing is' : 'things are'} waiting.`
      : null,
    ordered.length ? `${ordered.length} ${ordered.length === 1 ? 'thing needs' : 'things need'} a decision.` : 'Nothing is stuck.',
    missing.length ? `The brand record has no ${missing.join(', ')} — do not invent ${missing.length === 1 ? 'it' : 'them'}.` : 'The brand record is complete.',
    stale.length ? `${stale.length} of ${sections.length || stale.length} parts of the plan are out of date.` : null,
  ].filter(Boolean)

  return {
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      website: project.website_url ?? null,
      regulated,
      regime,
    },
    contract: {
      colours:
        project.brand_colours && Object.keys(project.brand_colours).length > 0
          ? project.brand_colours
          : null,
      logo: project.logo_url ?? null,
      voiceKeywords: project.tone_of_voice?.keywords ?? [],
      avoidWords: project.tone_of_voice?.avoid_words ?? [],
      voiceRules: project.brand_dna_constraints?.voice_rules ?? [],
      neverDo: project.brand_dna_constraints?.never_do ?? [],
      contentPillars: project.content_pillars ?? [],
      missing,
    },
    atRisk: ordered.map((r) => ({ headline: r.headline, detail: r.detail, urgency: r.urgency })),
    stale,
    nextActions: actions.slice(0, 3),
    summary: summaryParts.join(' '),
  }
}

/**
 * The brief as text, for a client that reads rather than parses.
 *
 * Both the plugged-in client and the Director render through this, so the two
 * cannot describe the same project differently.
 */
export function renderProjectBrief(brief: ProjectBrief): string {
  const lines: string[] = [`# ${brief.project.name}`, '', brief.summary, '']

  if (brief.project.regime) {
    lines.push(
      `**Rules apply:** ${brief.project.regime}. Content is reviewed before it publishes, and a review that does not pass is not published or saved.`,
      '',
    )
  }

  lines.push('## Brand contract — use these exactly, never substitute')
  if (brief.contract.colours) {
    lines.push('', '**Colours:**')
    for (const [role, hex] of Object.entries(brief.contract.colours)) lines.push(`- ${role}: ${hex}`)
  }
  if (brief.contract.logo) lines.push('', `**Logo:** ${brief.contract.logo}`)
  if (brief.contract.voiceKeywords.length) {
    lines.push('', `**Voice:** ${brief.contract.voiceKeywords.join(', ')}`)
  }
  if (brief.contract.avoidWords.length) {
    lines.push(`**Never use:** ${brief.contract.avoidWords.join(', ')}`)
  }
  if (brief.contract.voiceRules.length) {
    lines.push('', '**Voice rules:**')
    for (const rule of brief.contract.voiceRules) lines.push(`- ${rule}`)
  }
  if (brief.contract.neverDo.length) {
    lines.push('', '**Never do:**')
    for (const rule of brief.contract.neverDo) lines.push(`- ${rule}`)
  }
  if (brief.contract.contentPillars.length) {
    lines.push('', `**Content pillars:** ${brief.contract.contentPillars.join(', ')}`)
  }
  if (brief.contract.missing.length) {
    lines.push(
      '',
      `**Not recorded:** ${brief.contract.missing.join(', ')}. Leave these out rather than inventing them — an invented palette or logo is worse than none.`,
    )
  }

  if (brief.atRisk.length) {
    lines.push('', '## Needs a decision')
    for (const risk of brief.atRisk) lines.push(`- ${risk.headline} — ${risk.detail}`)
  }

  if (brief.stale.length) {
    const never = brief.stale.filter((s) => s.daysOverdue === null).length
    lines.push(
      '',
      '## Out of date',
      never > 0
        ? `${never} ${never === 1 ? 'part has' : 'parts have'} never been filled in. Oldest first: ${brief.stale.slice(0, 5).map((s) => s.title).join(', ')}.`
        : `${brief.stale.slice(0, 5).map((s) => `${s.title} (${s.daysOverdue} days over)`).join(', ')}.`,
    )
  }

  if (brief.nextActions.length) {
    lines.push('', '## Suggested next')
    brief.nextActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
  }

  return lines.join('\n')
}
