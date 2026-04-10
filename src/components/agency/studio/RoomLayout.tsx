'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'

interface RoomLayoutProps {
  title: string
  children: React.ReactNode
}

export function RoomLayout({ title, children }: RoomLayoutProps) {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Studio pages use a left sidebar that takes horizontal space.
  // Do NOT auto-open the chat panel — it overlaps the content.
  // Users can open it manually via the chat button.

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 px-6 pt-4 pb-2">
        <Link
          href="/agency/studio"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Studio
        </Link>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-6 pb-3">
        <StrategyBrief context={strategyContext} />
      </div>
      <div className="flex-1 px-6 pb-6">
        {children}
      </div>
    </div>
  )
}
