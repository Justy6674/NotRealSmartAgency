/**
 * THE navigation list. One declaration, read by the sidebar and by anything
 * else that needs to know what a department is called or where it lives.
 *
 * The old shape — four "rooms" in room-config.ts plus ten command sub-tabs in
 * AgencyHeader — described the same destinations twice, in two files, with two
 * different vocabularies. The owner then saw a room strip AND a sub-tab strip
 * AND a studio sidebar, three levels of chrome competing to be the answer to
 * "where am I". This file replaces all three: twelve sections, flat, always
 * expanded, each owning its own sub-items.
 *
 * Rules that are load-bearing, not stylistic:
 *
 * 1. Labels are what a non-technical business owner would say out loud. Not
 *    "OAuth", not "webhooks", not "Mixpost", not "SEO". "Can AI find you", not
 *    "LLM visibility". If a label needs explaining, it is the wrong label.
 * 2. `healthcareOnly` items are hidden outright unless the business carries
 *    compliance_flags.ahpra or .tga. Scent Sell must never see an AHPRA row;
 *    Downscale must never be able to miss one.
 * 3. Nothing here knows about counts, brands or the current route. Those are
 *    inputs to the renderer, so this stays a description rather than a state.
 * 4. A STATE OF SOMETHING IS NOT A PLACE. "Waiting on you" is the approval
 *    queue, and the queue is not a thirteenth department — it is the Posts list
 *    with a filter on it. It therefore points at Posts with `?status=waiting`,
 *    never at a route of its own. The old shape made review a separate room and
 *    the owner ended up with two lists of the same posts that could disagree.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Globe,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Palette,
  PenLine,
  Plug,
  Search,
  Settings,
  Share2,
  Sparkles,
  Swords,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavSectionId =
  | 'dashboard'
  | 'business'
  | 'branding'
  | 'connections'
  | 'competitors'
  | 'google'
  | 'ai-search'
  | 'website'
  | 'blogging'
  | 'social'
  | 'advertising'
  | 'engagement'
  | 'settings'

/**
 * A query the row applies to the destination it shares with a sibling. Present
 * only on rows that are a VIEW of another row rather than a place of their own.
 *
 * It is split from `href` rather than parsed back out of it because the active
 * state has to be answered against `useSearchParams()`, which hands back
 * `status` and `waiting` as separate things. Storing the pair keeps the link
 * and the highlight reading from one declaration instead of two string parses
 * that drift.
 */
export interface NavChildFilter {
  param: string
  value: string
}

/**
 * The approval queue's filter, in one place. Exported because the Posts screen
 * has to read the same `?status=waiting` off the URL that this list writes into
 * it — a second hand-typed 'waiting' in the screen is how a link starts landing
 * on an unfiltered list without anything failing.
 */
export const WAITING_ON_YOU_FILTER: NavChildFilter = { param: 'status', value: 'waiting' }

/** A destination beneath a section. Renders as an indented, bulleted row. */
export interface NavChildLink {
  kind: 'link'
  id: string
  label: string
  /** Includes the query when the row is a filtered view — see `filter`. */
  href: string
  /**
   * Shown only when the business is regulated (AHPRA and/or TGA). These are the
   * rows the mockups mark `[care]` — they render in the warm care colour so a
   * compliance obligation never reads like ordinary furniture.
   */
  healthcareOnly?: boolean
  /**
   * Set when this row shows a filtered slice of the sibling above it. Two rows
   * then share a pathname, so the renderer needs the filter to tell which of
   * them the owner is actually looking at. See `activeChildId`.
   */
  filter?: NavChildFilter
  /**
   * Which number in `NavCounts` belongs on this row. Only queues carry one —
   * a count beside a row is read as "this much is waiting for you", so it is
   * declared per row rather than inferred from the id.
   */
  countId?: NavCountId
}

/**
 * A heading *inside* a section's sub-list — CONTENT / SETUP / RESULTS under
 * Social media. It is not a destination and never highlights. It exists because
 * "Posting schedule" and "Posts" are different kinds of work: one is set up once
 * and forgotten, the other is opened daily, and an undifferentiated list of
 * seven makes the daily ones harder to find.
 */
export interface NavChildGroup {
  kind: 'group'
  id: string
  label: string
}

export type NavChild = NavChildLink | NavChildGroup

export interface NavSection {
  id: NavSectionId
  label: string
  icon: LucideIcon
  href: string
  /**
   * Match the pathname exactly rather than by prefix. Only Dashboard needs it:
   * `/agency` is a prefix of every other route, so prefix-matching it would
   * light up Dashboard on every screen in the product.
   */
  exact?: boolean
  /** An uppercase divider rendered above this section ("THIS BUSINESS"). */
  groupLabel?: string
  children?: NavChild[]
  /** Same rule as NavChildLink. No section needs it yet; the filter is shared. */
  healthcareOnly?: boolean
}

/**
 * Everything that can carry an attention number: every section, plus the child
 * rows that are a queue rather than a place. Today that is only the approval
 * queue. It is a closed union so a typo in a fetcher is a type error rather
 * than a badge that silently never appears.
 */
export type NavCountId = NavSectionId | 'social-waiting'

/**
 * Attention counts, supplied by whoever fetched them. Deliberately partial and
 * deliberately not defaulted: a section with no number is a section we have not
 * measured, and it renders bare. Rendering `0` for "we did not look" tells the
 * owner there is nothing waiting, which is a different and much worse claim.
 *
 * Three are live today and they come from three different places, so this stays
 * one flat bag the caller fills in as far as it can rather than a shape that
 * has to be complete:
 *   blogging       — drafts not yet published
 *   engagement     — comments, messages and reviews not yet answered
 *   social-waiting — posts sitting in the approval queue (Scent Sell: 59)
 */
export type NavCounts = Partial<Record<NavCountId, number>>

// ─── The list ─────────────────────────────────────────────────────────────────

/** Where `+ Create post` goes. The one primary manual action in the sidebar. */
export const CREATE_POST_HREF = '/agency/social/compose'

/**
 * The section that is actually ready to use. Everything else can be greyed from
 * the sidebar so the product does not pretend twelve rooms are finished.
 */
export const READY_NAV_SECTION_ID: NavSectionId = 'social'

export function isReadyNavSection(id: NavSectionId): boolean {
  return id === READY_NAV_SECTION_ID
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'social',
    label: 'Social media',
    icon: Share2,
    href: '/agency/social',
    children: [
      { kind: 'group', id: 'social-grp-content', label: 'Content' },
      { kind: 'link', id: 'social-posts', label: 'Posts', href: '/agency/social/posts' },
      {
        // The approval queue. Directly under Posts because it IS Posts, held to
        // the ones that need a decision — see rule 4 at the top of the file.
        kind: 'link',
        id: 'social-waiting',
        label: 'Waiting on you',
        href: `/agency/social/posts?${WAITING_ON_YOU_FILTER.param}=${WAITING_ON_YOU_FILTER.value}`,
        filter: WAITING_ON_YOU_FILTER,
        countId: 'social-waiting',
      },
      { kind: 'link', id: 'social-calendar', label: 'Calendar', href: '/agency/social/calendar' },
      { kind: 'link', id: 'social-media', label: 'Media library', href: '/agency/social/media' },
      { kind: 'link', id: 'social-templates', label: 'Templates', href: '/agency/social/templates' },
      { kind: 'group', id: 'social-grp-setup', label: 'Setup' },
      { kind: 'link', id: 'social-accounts', label: 'Social accounts', href: '/agency/social/accounts' },
      { kind: 'link', id: 'social-schedule', label: 'Posting schedule', href: '/agency/social/schedule' },
      { kind: 'group', id: 'social-grp-results', label: 'Results' },
      { kind: 'link', id: 'social-analytics', label: 'Analytics', href: '/agency/social/analytics' },
    ],
  },

  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/agency',
    exact: true,
  },

  {
    id: 'business',
    label: 'Business analysis',
    icon: Building2,
    href: '/agency/business',
    children: [
      { kind: 'link', id: 'business-what', label: 'What the business is', href: '/agency/business/what' },
      { kind: 'link', id: 'business-customers', label: 'Who buys from you', href: '/agency/business/customers' },
      { kind: 'link', id: 'business-difference', label: 'What makes you different', href: '/agency/business/difference' },
      { kind: 'link', id: 'business-goals', label: 'Goals & targets', href: '/agency/business/goals' },
    ],
  },

  {
    id: 'branding',
    label: 'Branding & voice',
    icon: Palette,
    href: '/agency/branding',
    children: [
      { kind: 'link', id: 'branding-identity', label: 'Logo, colours, fonts', href: '/agency/branding/identity' },
      { kind: 'link', id: 'branding-voice', label: 'How you sound', href: '/agency/branding/voice' },
      { kind: 'link', id: 'branding-words', label: 'Words to use & avoid', href: '/agency/branding/words' },
      { kind: 'link', id: 'branding-topics', label: 'What you talk about', href: '/agency/branding/topics' },
    ],
  },

  {
    id: 'connections',
    label: 'Connections',
    icon: Plug,
    href: '/agency/connections',
    children: [
      { kind: 'link', id: 'connections-social', label: 'Social accounts', href: '/agency/connections/social' },
      { kind: 'link', id: 'connections-website', label: 'Your website', href: '/agency/connections/website' },
      { kind: 'link', id: 'connections-canva', label: 'Canva', href: '/agency/connections/canva' },
      { kind: 'link', id: 'connections-google', label: 'Google', href: '/agency/connections/google' },
      { kind: 'link', id: 'connections-code', label: 'Code & hosting', href: '/agency/connections/code' },
      { kind: 'link', id: 'connections-email', label: 'Email', href: '/agency/connections/email' },
    ],
  },

  {
    id: 'competitors',
    label: 'Competitors',
    icon: Swords,
    href: '/agency/competitors',
    children: [
      { kind: 'link', id: 'competitors-who', label: 'Who they are', href: '/agency/competitors/who' },
      { kind: 'link', id: 'competitors-posts', label: 'What they post', href: '/agency/competitors/posts' },
      { kind: 'link', id: 'competitors-rankings', label: 'What they rank for', href: '/agency/competitors/rankings' },
      { kind: 'link', id: 'competitors-gaps', label: 'Where you are behind', href: '/agency/competitors/gaps' },
    ],
  },

  {
    id: 'google',
    label: 'Google searchability',
    icon: Search,
    href: '/agency/google',
    children: [
      { kind: 'link', id: 'google-rankings', label: 'What you rank for', href: '/agency/google/rankings' },
      { kind: 'link', id: 'google-searches', label: 'What people search', href: '/agency/google/searches' },
      { kind: 'link', id: 'google-listing', label: 'Your Google listing', href: '/agency/google/listing' },
      { kind: 'link', id: 'google-local', label: 'Local & maps', href: '/agency/google/local' },
    ],
  },

  {
    id: 'ai-search',
    label: 'AI searchability',
    icon: Sparkles,
    href: '/agency/ai-search',
    children: [
      { kind: 'link', id: 'ai-search-visibility', label: 'Can AI find you', href: '/agency/ai-search/visibility' },
      { kind: 'link', id: 'ai-search-description', label: 'How AI describes you', href: '/agency/ai-search/description' },
      { kind: 'link', id: 'ai-search-fixes', label: 'What to fix', href: '/agency/ai-search/fixes' },
    ],
  },

  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    href: '/agency/website',
    children: [
      { kind: 'link', id: 'website-speed', label: 'Speed on phone & desktop', href: '/agency/website/speed' },
      { kind: 'link', id: 'website-pages', label: 'Pages', href: '/agency/website/pages' },
      { kind: 'link', id: 'website-structure', label: 'Structure & sitemap', href: '/agency/website/structure' },
      { kind: 'link', id: 'website-fixes', label: 'What to fix', href: '/agency/website/fixes' },
    ],
  },

  {
    id: 'blogging',
    label: 'Blogging',
    icon: PenLine,
    href: '/agency/blogging',
    children: [
      { kind: 'link', id: 'blogging-posts', label: 'Your posts', href: '/agency/blogging/posts' },
      { kind: 'link', id: 'blogging-ideas', label: 'What to write next', href: '/agency/blogging/ideas' },
      { kind: 'link', id: 'blogging-keywords', label: 'Search terms', href: '/agency/blogging/keywords' },
      { kind: 'link', id: 'blogging-images', label: 'Images', href: '/agency/blogging/images' },
      {
        kind: 'link',
        id: 'blogging-compliance',
        label: 'Checked before you publish',
        href: '/agency/blogging/compliance',
        healthcareOnly: true,
      },
    ],
  },

  {
    id: 'advertising',
    label: 'Advertising',
    icon: Megaphone,
    href: '/agency/advertising',
    children: [
      { kind: 'link', id: 'advertising-campaigns', label: 'Campaigns', href: '/agency/advertising/campaigns' },
      { kind: 'link', id: 'advertising-spend', label: 'What you are spending', href: '/agency/advertising/spend' },
      { kind: 'link', id: 'advertising-returns', label: 'What it is returning', href: '/agency/advertising/returns' },
      { kind: 'link', id: 'advertising-audiences', label: 'Audiences', href: '/agency/advertising/audiences' },
      {
        kind: 'link',
        id: 'advertising-health-rules',
        label: 'Ad rules for health',
        href: '/agency/advertising/health-rules',
        healthcareOnly: true,
      },
    ],
  },

  {
    id: 'engagement',
    label: 'Engagement',
    icon: MessageCircle,
    href: '/agency/engagement',
    children: [
      { kind: 'link', id: 'engagement-comments', label: 'Comments', href: '/agency/engagement/comments' },
      { kind: 'link', id: 'engagement-messages', label: 'Messages', href: '/agency/engagement/messages' },
      { kind: 'link', id: 'engagement-mentions', label: 'Mentions', href: '/agency/engagement/mentions' },
      { kind: 'link', id: 'engagement-reviews', label: 'Reviews', href: '/agency/engagement/reviews' },
    ],
  },

  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/agency/settings',
    groupLabel: 'This business',
    children: [
      { kind: 'link', id: 'settings-people', label: 'People & access', href: '/agency/settings/people' },
      { kind: 'link', id: 'settings-costs', label: 'What it costs', href: '/agency/settings/costs' },
      {
        kind: 'link',
        id: 'settings-compliance',
        label: 'Compliance record',
        href: '/agency/settings/compliance',
        healthcareOnly: true,
      },
    ],
  },
]

/**
 * Which sections the owner has turned Off. Stored as a JSON array of ids.
 * Default: Social is On, everything else is Off — unfinished rooms start grey
 * until he clicks On on that row.
 */
export const NAV_SECTION_OFF_KEY = 'nrs-nav-section-off'
/** Previous one-switch key. Read once so a "show all" click is not thrown away. */
export const NAV_DIM_UNREADY_LEGACY_KEY = 'nrs-nav-dim-unready'

export function defaultNavOffIds(): Set<NavSectionId> {
  return new Set(
    NAV_SECTIONS.map((section) => section.id).filter((id) => id !== READY_NAV_SECTION_ID),
  )
}

export function parseNavOffIds(raw: string | null, legacyAllDimmed?: string | null): Set<NavSectionId> {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return defaultNavOffIds()
      const known = new Set(NAV_SECTIONS.map((section) => section.id))
      return new Set(
        parsed.filter((id: unknown): id is NavSectionId =>
          typeof id === 'string' && known.has(id as NavSectionId),
        ),
      )
    } catch {
      return defaultNavOffIds()
    }
  }
  if (legacyAllDimmed === '0') return new Set()
  return defaultNavOffIds()
}

export function serializeNavOffIds(ids: Set<NavSectionId>): string {
  return JSON.stringify([...ids])
}

export function toggleNavOff(ids: Set<NavSectionId>, id: NavSectionId): Set<NavSectionId> {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// ─── Visibility ───────────────────────────────────────────────────────────────

/**
 * True when the business advertises regulated health services and the [care]
 * rows must appear. Takes the flags rather than a pre-computed boolean so the
 * OR lives in exactly one place — four brands' AHPRA/TGA exposure is not a rule
 * to be re-derived by every caller.
 */
export function isHealthcareBusiness(
  flags?: { ahpra?: boolean; tga?: boolean } | null
): boolean {
  return Boolean(flags?.ahpra || flags?.tga)
}

/** Children this business should actually see. */
export function visibleChildren(section: NavSection, healthcare: boolean): NavChild[] {
  const children = (section.children ?? []).filter(
    (child) => !(child.kind === 'link' && child.healthcareOnly && !healthcare)
  )

  // A group heading with nothing under it is a heading for an empty list. Drop
  // any that lost all their links to the healthcare filter.
  return children.filter((child, index) => {
    if (child.kind !== 'group') return true
    const next = children[index + 1]
    return Boolean(next && next.kind === 'link')
  })
}

/** Sections this business should actually see. */
export function visibleSections(healthcare: boolean): NavSection[] {
  return NAV_SECTIONS.filter((section) => !(section.healthcareOnly && !healthcare))
}

// ─── Route matching ───────────────────────────────────────────────────────────

/**
 * What can answer "what is `?status` set to right now". `useSearchParams()`
 * satisfies it as-is, and so does `new URLSearchParams('status=waiting')`, so
 * neither the caller nor a test has to build an adaptor.
 */
export interface NavFilterState {
  get(param: string): string | null
}

/** '/agency/social/posts?status=waiting' → '/agency/social/posts'. */
function hrefPath(href: string): string {
  const query = href.indexOf('?')
  return query === -1 ? href : href.slice(0, query)
}

/**
 * Prefix match, so a detail page keeps its parent lit: /agency/social/posts/abc
 * is still Posts. `exact` opts out for /agency, which prefixes everything.
 *
 * The query is stripped first. `usePathname()` never returns one, so comparing
 * a filtered row's full href against it would make that row permanently cold —
 * and would take its section down with it, because `isSectionActive` asks the
 * same question of every child.
 *
 * Exported because the department shell reads the same list to build its inner
 * tabs — one matcher, or the sidebar and the tab strip will eventually disagree
 * about which screen the owner is on.
 */
export function matchesRoute(href: string, pathname: string, exact = false): boolean {
  const path = hrefPath(href)
  if (exact) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function isSectionActive(section: NavSection, pathname: string): boolean {
  if (matchesRoute(section.href, pathname, section.exact)) return true
  return (section.children ?? []).some(
    (child) => child.kind === 'link' && matchesRoute(child.href, pathname)
  )
}

/**
 * Is this row the one being looked at? A plain row only has to match the path.
 * A filtered row also has to have its filter applied, or "Waiting on you" would
 * light up on the full Posts list, which is the opposite of what it means.
 *
 * It cannot see its siblings, so it will answer `true` for BOTH Posts and
 * Waiting on you while the queue filter is on. Use `activeChildId` to pick the
 * single winner; this stays exported for the one-row case.
 */
export function isChildActive(
  child: NavChildLink,
  pathname: string,
  filters?: NavFilterState | null
): boolean {
  if (!matchesRoute(child.href, pathname)) return false
  if (!child.filter) return true
  return filters?.get(child.filter.param) === child.filter.value
}

/**
 * The ONE child row to highlight, or none. A filtered view beats the row it
 * filters, so landing on Posts with `?status=waiting` lights Waiting on you and
 * leaves Posts quiet — two lit rows in a five-row list is worse than the wrong
 * one lit, because the owner cannot tell which click he is undoing.
 *
 * `filters` omitted means "nobody told us what is on the URL". The filtered row
 * then loses and the plain destination is lit, which is exactly today's
 * behaviour and never claims a filter is applied when we do not know.
 */
export function activeChildId(
  children: NavChild[],
  pathname: string,
  filters?: NavFilterState | null
): string | undefined {
  const links = children.filter((child): child is NavChildLink => child.kind === 'link')
  const filtered = links.find((child) => child.filter && isChildActive(child, pathname, filters))
  if (filtered) return filtered.id
  return links.find((child) => !child.filter && isChildActive(child, pathname, filters))?.id
}

/** The section that owns a route, for a department header or a page title. */
export function sectionForPath(pathname: string): NavSection | undefined {
  // Longest href first, so /agency/social wins over /agency for a social route
  // and Dashboard is only ever reached by its own exact match.
  return [...NAV_SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((section) => isSectionActive(section, pathname))
}
