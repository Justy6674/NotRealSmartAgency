'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ACTIVE_AGENT_TYPES, AGENT_LABELS } from '@/types/database'
import { AGENT_ICONS, AgentAvatar } from './AgentAvatar'

export function AgentSidebar() {
  const { activeAgentType, setAgent } = useAgencyStore()

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Departments
        </span>
      </div>
      <ScrollArea className="flex-1 py-2">
        {ACTIVE_AGENT_TYPES.map((type) => {
          const Icon = AGENT_ICONS[type]
          const label = AGENT_LABELS[type]
          const isDirector = type === 'overall'
          const isActive = activeAgentType === type

          return (
            <button
              key={type}
              onClick={() => setAgent(type)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                isDirector && !isActive && 'border-b border-border mb-1'
              )}
            >
              <AgentAvatar agentType={type} size="sm" />
              <p className={cn('text-sm truncate', isActive && 'font-medium')}>
                {label}
              </p>
            </button>
          )
        })}
      </ScrollArea>
    </aside>
  )
}
