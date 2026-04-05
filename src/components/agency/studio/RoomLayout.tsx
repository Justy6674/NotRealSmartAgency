'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'
import { useEffect } from 'react'

interface RoomLayoutProps {
  title: string
  children: React.ReactNode
}

export function RoomLayout({ title, children }: RoomLayoutProps) {
  const { activeBrandId, setChatPanelOpen } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  useEffect(() => {
    setChatPanelOpen(true)
  }, [setChatPanelOpen])

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
