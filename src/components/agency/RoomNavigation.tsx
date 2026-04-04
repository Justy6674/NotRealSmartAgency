'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Palette, CalendarDays, LayoutDashboard, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROOMS, getActiveRoom } from '@/lib/room-config'

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare,
  Palette,
  CalendarDays,
  LayoutDashboard,
}

export function RoomNavigation() {
  const pathname = usePathname() ?? ''
  const activeRoom = getActiveRoom(pathname)

  return (
    <>
      {/* Room tabs — centred in header */}
      <nav className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
        {ROOMS.map((room) => {
          const isActive = activeRoom?.id === room.id
          const Icon = ICON_MAP[room.iconName] ?? MessageSquare

          return (
            <Link
              key={room.id}
              href={room.href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline lg:hidden">{room.shortLabel}</span>
              <span className="hidden lg:inline">{room.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export function RoomSubNavigation() {
  const pathname = usePathname() ?? ''
  const activeRoom = getActiveRoom(pathname)

  if (!activeRoom?.subTabs?.length) return <div className="hidden" />

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b px-4 py-2 overflow-x-auto">
      {activeRoom.subTabs.map((tab) => {
        const isActive = tab.matchPrefixes.some((p) => pathname.startsWith(p))

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
