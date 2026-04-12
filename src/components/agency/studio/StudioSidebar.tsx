'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  CalendarDays,
  Image as ImageIcon,
  FileText,
  Globe,
  Palette,
  Share2,
  Clock,
  Webhook,
  BarChart3,
  Hash,
  Plus,
  PenSquare,
  CheckCircle,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Studio left sidebar — Mixpost-style navigation for the Creative Studio room.
 *
 * Matches Mixpost Pro's SidebarWorkspace.vue layout:
 * - CREATE POST button at the top
 * - Content group: Posts, Calendar, Media Library, Templates
 * - Configuration group: Social Accounts, Posting Schedule, Webhooks
 * - Plus: Analytics, Hashtags (NRS additions not in Mixpost)
 *
 * Replaces the horizontal sub-tab row that was added in the integration
 * wiring commit (e61ff95). The sidebar is always visible inside the
 * Studio room, matching Mixpost's fixed left-nav pattern.
 */

interface SidebarItem {
  label: string
  href: string
  icon: React.ReactNode
  matchPrefixes: string[]
  exactMatch?: boolean
}

const DASHBOARD_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/agency/studio',
    icon: <Home className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio'],
    exactMatch: true,
  },
]

const CONTENT_ITEMS: SidebarItem[] = [
  {
    label: 'Create Post',
    href: '/agency/studio/create',
    icon: <PenSquare className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/create'],
  },
  {
    label: 'Posts',
    href: '/agency/studio/posts',
    icon: <LayoutGrid className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/posts'],
  },
  {
    label: 'Calendar',
    href: '/agency/studio/calendar',
    icon: <CalendarDays className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/calendar'],
  },
  {
    label: 'Media Library',
    href: '/agency/studio/media',
    icon: <ImageIcon className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/media'],
  },
  {
    label: 'Review',
    href: '/agency/studio/review',
    icon: <CheckCircle className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/review'],
  },
  {
    label: 'Templates',
    href: '/agency/studio/templates',
    icon: <FileText className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/templates'],
  },
  {
    label: 'Brand Kit',
    href: '/agency/studio/brand-kit',
    icon: <Palette className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/brand-kit'],
  },
  {
    label: 'Pages',
    href: '/agency/studio/pages',
    icon: <Globe className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/pages'],
  },
]

const ANALYTICS_ITEMS: SidebarItem[] = [
  {
    label: 'Analytics',
    href: '/agency/studio/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/analytics'],
  },
  {
    label: 'Hashtags',
    href: '/agency/studio/hashtags',
    icon: <Hash className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/hashtags'],
  },
]

const CONFIG_ITEMS: SidebarItem[] = [
  {
    label: 'Social Accounts',
    href: '/agency/studio/accounts',
    icon: <Share2 className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/accounts'],
  },
  {
    label: 'Posting Schedule',
    href: '/agency/studio/posting-schedule',
    icon: <Clock className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/posting-schedule'],
  },
  {
    label: 'Webhooks',
    href: '/agency/studio/webhooks',
    icon: <Webhook className="h-4 w-4" />,
    matchPrefixes: ['/agency/studio/webhooks'],
  },
]

function isActive(pathname: string, item: SidebarItem): boolean {
  if (item.exactMatch) {
    return item.matchPrefixes.some((p) => pathname === p)
  }
  return item.matchPrefixes.some((p) => pathname.startsWith(p))
}

function MenuGroup({
  title,
  items,
  pathname,
}: {
  title: string
  items: SidebarItem[]
  pathname: string
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className={active ? 'text-primary' : 'text-muted-foreground/60'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function StudioSidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex w-[200px] shrink-0 flex-col border-r border-border bg-card h-full overflow-y-auto py-4">
      {/* CREATE POST button — matches Mixpost's dark "CREATE POST" at the top */}
      <div className="px-3 mb-4">
        <Link
          href="/agency/studio/create"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors w-full"
        >
          <Plus className="h-3.5 w-3.5" />
          CREATE POST
        </Link>
      </div>

      {/* Navigation groups */}
      <div className="flex flex-col gap-4 flex-1 px-1">
        <MenuGroup title="" items={DASHBOARD_ITEMS} pathname={pathname} />

        <div className="mx-3 border-t border-border" />

        <MenuGroup title="Content" items={CONTENT_ITEMS} pathname={pathname} />

        <div className="mx-3 border-t border-border" />

        <MenuGroup title="Insights" items={ANALYTICS_ITEMS} pathname={pathname} />

        <div className="mx-3 border-t border-border" />

        <MenuGroup title="Configuration" items={CONFIG_ITEMS} pathname={pathname} />
      </div>
    </div>
  )
}
