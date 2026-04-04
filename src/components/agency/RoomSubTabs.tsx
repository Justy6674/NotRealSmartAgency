'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getActiveRoom } from '@/lib/room-config'

export function RoomSubTabs() {
  const pathname = usePathname() ?? ''
  const activeRoom = getActiveRoom(pathname)

  if (!activeRoom?.subTabs?.length) return null

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
