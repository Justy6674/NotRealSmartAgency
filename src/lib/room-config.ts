export type RoomId = 'director' | 'studio' | 'command'

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
    subTabs: [
      { label: 'Studio', href: '/agency/studio', matchPrefixes: ['/agency/studio'], exactMatch: true },
      { label: 'Posts', href: '/agency/studio/posts', matchPrefixes: ['/agency/studio/posts'] },
      { label: 'Analytics', href: '/agency/studio/analytics', matchPrefixes: ['/agency/studio/analytics'] },
      { label: 'Templates', href: '/agency/studio/templates', matchPrefixes: ['/agency/studio/templates'] },
      { label: 'Hashtags', href: '/agency/studio/hashtags', matchPrefixes: ['/agency/studio/hashtags'] },
      { label: 'Schedule', href: '/agency/studio/posting-schedule', matchPrefixes: ['/agency/studio/posting-schedule'] },
      { label: 'Webhooks', href: '/agency/studio/webhooks', matchPrefixes: ['/agency/studio/webhooks'] },
      { label: 'Accounts', href: '/agency/studio/accounts', matchPrefixes: ['/agency/studio/accounts'] },
    ],
  },
  {
    id: 'command',
    label: 'Command Centre',
    shortLabel: 'Command',
    iconName: 'LayoutDashboard',
    href: '/agency/tasks',
    matchPrefixes: [
      '/agency/tasks',
      '/agency/agents',
      '/agency/approvals',
      '/agency/costs',
      '/agency/analytics',
      '/agency/activity',
      '/agency/settings',
      '/agency/team',
      '/agency/brands',
    ],
    subTabs: [
      { label: 'Tasks', href: '/agency/tasks', matchPrefixes: ['/agency/tasks'] },
      { label: 'Agents', href: '/agency/agents', matchPrefixes: ['/agency/agents'] },
      { label: 'Approvals', href: '/agency/approvals', matchPrefixes: ['/agency/approvals'] },
      { label: 'Costs', href: '/agency/costs', matchPrefixes: ['/agency/costs'] },
      { label: 'Analytics', href: '/agency/analytics', matchPrefixes: ['/agency/analytics'] },
      { label: 'Activity', href: '/agency/activity', matchPrefixes: ['/agency/activity'] },
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
