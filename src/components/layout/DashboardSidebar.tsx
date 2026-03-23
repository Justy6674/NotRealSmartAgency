'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Check, Circle, Lock, Loader2 } from 'lucide-react'
import type { SubscriptionTier, PhaseStatus } from '@/types/database'
import { TIER_CONFIG } from '@/lib/constants'

interface SidebarPhase {
  id: string
  number: number
  slug: string
  title: string
  icon: string | null
  tier_required: SubscriptionTier
  category: string
}

interface UserPhaseStatus {
  phase_id: string
  status: PhaseStatus
}

interface DashboardSidebarProps {
  phases: SidebarPhase[]
  userPhases: UserPhaseStatus[]
  subscriptionTier: SubscriptionTier
}

const tierOrder: SubscriptionTier[] = ['free', 'starter', 'professional', 'practice']

function getStatusIcon(status: PhaseStatus | undefined, isLocked: boolean) {
  if (isLocked) return <Lock className="h-3.5 w-3.5 text-muted-foreground" />
  if (!status || status === 'not_started') return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === 'in_progress') return <Loader2 className="h-3.5 w-3.5 text-blue-500" />
  if (status === 'completed') return <Check className="h-3.5 w-3.5 text-green-600" />
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
}

export function DashboardSidebar({ phases, userPhases, subscriptionTier }: DashboardSidebarProps) {
  const pathname = usePathname()

  const statusMap = new Map(userPhases.map((up) => [up.phase_id, up.status]))
  const currentTierIndex = tierOrder.indexOf(subscriptionTier)

  const groupedPhases = phases.reduce<Record<string, SidebarPhase[]>>((acc, phase) => {
    if (!acc[phase.category]) acc[phase.category] = []
    acc[phase.category].push(phase)
    return acc
  }, {})

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r bg-muted/30">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Not<span className="text-primary">Real</span>Smart
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {Object.entries(groupedPhases).map(([category, categoryPhases]) => (
          <div key={category} className="mb-6">
            <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {category}
            </p>
            {categoryPhases.map((phase) => {
              const requiredTierIndex = tierOrder.indexOf(phase.tier_required)
              const isLocked = requiredTierIndex > currentTierIndex
              const status = statusMap.get(phase.id)
              const isActive = pathname === `/phases/${phase.slug}`

              return (
                <Link
                  key={phase.id}
                  href={isLocked ? '#' : `/phases/${phase.slug}`}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : isLocked
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  onClick={(e) => isLocked && e.preventDefault()}
                >
                  {getStatusIcon(status, isLocked)}
                  <span className="truncate flex-1">
                    {phase.number}. {phase.title}
                  </span>
                  {isLocked && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {TIER_CONFIG[phase.tier_required].label}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </ScrollArea>
    </aside>
  )
}
