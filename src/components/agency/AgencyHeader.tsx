'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { ComplianceBadge } from './ComplianceBadge'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Palette, LayoutDashboard, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROOMS, getActiveRoom } from '@/lib/room-config'
import type { Brand } from '@/types/database'

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare,
  Palette,
  LayoutDashboard,
}

export function AgencyHeader() {
  const { activeBrandId } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)
  const pathname = usePathname() ?? ''
  const activeRoom = getActiveRoom(pathname)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }

    fetch('/api/brands')
      .then(r => r.ok ? r.json() : [])
      .then((brands: Brand[]) => {
        const match = brands.find(b => b.id === activeBrandId)
        setBrand(match ?? null)
      })
      .catch(() => setBrand(null))
  }, [activeBrandId])

  return (
    <div className="flex flex-col">
      {/* Main header row */}
      <div className="flex h-12 shrink-0 items-center gap-3 px-4">
        {/* Brand logo + name — hidden on mobile to make room for tabs */}
        {brand && (
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="h-6 w-6 rounded object-cover" />
            ) : (
              <span
                className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold"
                style={{ background: 'oklch(0.25 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
              >
                {brand.name.charAt(0)}
              </span>
            )}
            <span className="text-sm font-medium text-foreground">{brand.name}</span>
          </div>
        )}

        {/* Compliance badges — hidden on mobile */}
        {brand && (
          <div className="hidden md:block">
            <ComplianceBadge
              ahpra={brand.compliance_flags?.ahpra}
              tga={brand.compliance_flags?.tga}
            />
          </div>
        )}

        {/* Room tabs — centred */}
        <div className="flex flex-1 items-center justify-center">
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
        </div>
      </div>

      {/* Sub-navigation — only for rooms with sub-tabs */}
      {activeRoom?.subTabs && activeRoom.subTabs.length > 0 && (
        <div className="flex items-center gap-1.5 border-t px-4 py-2 overflow-x-auto">
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
      )}
    </div>
  )
}
