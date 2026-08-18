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
        const isActive = tab.exactMatch
          ? tab.matchPrefixes.some((p) => pathname === p)
          : tab.matchPrefixes.some((p) => pathname.startsWith(p))

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'bg-[var(--brand-wash)] font-semibold text-[var(--brand-deep)]'
                : 'bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
