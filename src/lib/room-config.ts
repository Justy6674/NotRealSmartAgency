export type RoomId = 'board' | 'director' | 'studio' | 'command'

export interface SubTabConfig {
  label: string
  href: string
  matchPrefixes: string[]
  /** When true, pathname must equal (not just startsWith) a matchPrefix */
  exactMatch?: boolean
}

export interface RoomConfig {
  id: RoomId
  label: string
  shortLabel: string
  iconName: 'MessageSquare' | 'Palette' | 'CalendarDays' | 'LayoutDashboard'
  href: string
  matchPrefixes: string[]
  subTabs?: SubTabConfig[]
}

export const ROOMS: RoomConfig[] = [
  {
    id: 'board',
    label: 'Today',
    shortLabel: 'Today',
    iconName: 'LayoutDashboard',
    href: '/agency/board',
    matchPrefixes: ['/agency/board'],
  },
  {
    id: 'director',
    label: "Director's Office",
    shortLabel: 'Director',
    iconName: 'MessageSquare',
    href: '/agency/chat',
    matchPrefixes: ['/agency/chat'],
  },
  {
    id: 'studio',
    label: 'Creative Studio',
    shortLabel: 'Studio',
    iconName: 'Palette',
    href: '/agency/studio',
    matchPrefixes: ['/agency/studio', '/agency/calendar'],
    // No subTabs — Studio uses a left sidebar (StudioSidebar.tsx) for navigation,
    // matching Mixpost Pro's layout. Sub-tabs removed to avoid double navigation.
  },
  {
    id: 'command',
    label: 'Command Centre',
    shortLabel: 'Command',
    iconName: 'LayoutDashboard',
    href: '/agency/tasks',
    matchPrefixes: [
      '/agency/tasks',
      '/agency/inbox',
      '/agency/agents',
      '/agency/approvals',
      '/agency/ads',
      '/agency/costs',
      '/agency/analytics',
      '/agency/activity',
      '/agency/settings',
      '/agency/team',
      '/agency/brands',
    ],
    subTabs: [
      { label: 'Tasks', href: '/agency/tasks', matchPrefixes: ['/agency/tasks'] },
      // Inbox sits second: a customer message waiting on a reply is the most
      // time-sensitive thing in the Command Centre. It is NOT a Studio item —
      // StudioSidebar is `hidden md:flex`, so anything filed there is
      // unreachable on a phone, and answering a DM is exactly the job Justin
      // does from a phone.
      { label: 'Inbox', href: '/agency/inbox', matchPrefixes: ['/agency/inbox'] },
      { label: 'Agents', href: '/agency/agents', matchPrefixes: ['/agency/agents'] },
      { label: 'Approvals', href: '/agency/approvals', matchPrefixes: ['/agency/approvals'] },
      // Ads sits immediately before Costs and Analytics: spend, then what the
      // spend cost, then what it returned. '/agency/ads' does not collide with
      // '/agency/agents' — startsWith compares the whole prefix, and 'agents'
      // does not begin with 'ads'.
      { label: 'Ads', href: '/agency/ads', matchPrefixes: ['/agency/ads'] },
      { label: 'Costs', href: '/agency/costs', matchPrefixes: ['/agency/costs'] },
      { label: 'Analytics', href: '/agency/analytics', matchPrefixes: ['/agency/analytics'] },
      { label: 'Activity', href: '/agency/activity', matchPrefixes: ['/agency/activity'] },
      // '/agency/settings' has no exactMatch, so this pill stays lit on
      // '/agency/settings/integrations' as well. The integration hub is
      // configuration you touch rarely, so it earns a link from the settings
      // page rather than a pill of its own.
      { label: 'Settings', href: '/agency/settings', matchPrefixes: ['/agency/settings'] },
      { label: 'Team', href: '/agency/team', matchPrefixes: ['/agency/team'] },
      { label: 'Brands', href: '/agency/brands', matchPrefixes: ['/agency/brands'] },
    ],
  },
]

export function getActiveRoom(pathname: string): RoomConfig | undefined {
  return ROOMS.find((room) =>
    room.matchPrefixes.some((prefix) => pathname.startsWith(prefix))
  )
}
