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

/** A destination beneath a section. Renders as an indented, bulleted row. */
export interface NavChildLink {
  kind: 'link'
  id: string
  label: string
  href: string
  /**
   * Shown only when the business is regulated (AHPRA and/or TGA). These are the
   * rows the mockups mark `[care]` — they render in the warm care colour so a
   * compliance obligation never reads like ordinary furniture.
   */
  healthcareOnly?: boolean
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
 * Attention counts, supplied by whoever fetched them. Deliberately partial and
 * deliberately not defaulted: a section with no number is a section we have not
 * measured, and it renders bare. Rendering `0` for "we did not look" tells the
 * owner there is nothing waiting, which is a different and much worse claim.
 */
export type NavCounts = Partial<Record<NavSectionId, number>>

// ─── The list ─────────────────────────────────────────────────────────────────

/** Where `+ Create post` goes. The one primary manual action in the sidebar. */
export const CREATE_POST_HREF = '/agency/social/compose'

export const NAV_SECTIONS: NavSection[] = [
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
    id: 'social',
    label: 'Social media',
    icon: Share2,
    href: '/agency/social',
    children: [
      { kind: 'group', id: 'social-grp-content', label: 'Content' },
      { kind: 'link', id: 'social-posts', label: 'Posts', href: '/agency/social/posts' },
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
 * Prefix match, so a detail page keeps its parent lit: /agency/social/posts/abc
 * is still Posts. `exact` opts out for /agency, which prefixes everything.
 *
 * Exported because the department shell reads the same list to build its inner
 * tabs — one matcher, or the sidebar and the tab strip will eventually disagree
 * about which screen the owner is on.
 */
export function matchesRoute(href: string, pathname: string, exact = false): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isSectionActive(section: NavSection, pathname: string): boolean {
  if (matchesRoute(section.href, pathname, section.exact)) return true
  return (section.children ?? []).some(
    (child) => child.kind === 'link' && matchesRoute(child.href, pathname)
  )
}

export function isChildActive(child: NavChildLink, pathname: string): boolean {
  return matchesRoute(child.href, pathname)
}

/** The section that owns a route, for a department header or a page title. */
export function sectionForPath(pathname: string): NavSection | undefined {
  // Longest href first, so /agency/social wins over /agency for a social route
  // and Dashboard is only ever reached by its own exact match.
  return [...NAV_SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((section) => isSectionActive(section, pathname))
}
