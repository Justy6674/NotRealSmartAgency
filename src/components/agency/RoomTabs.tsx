'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROOMS, getActiveRoom } from '@/lib/room-config'

export function RoomTabs() {
  const pathname = usePathname() ?? ''
  const activeRoom = getActiveRoom(pathname)

  return (
    <nav className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
      {ROOMS.map((room) => {
        const isActive = activeRoom?.id === room.id
        const Icon = room.icon

        return (
          <Link
            key={room.id}
            href={room.href}
            role="tab"
            aria-selected={isActive}
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
  )
}
