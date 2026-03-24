'use client'

import { AgentAvatar } from './AgentAvatar'
import type { Task, AgentType } from '@/types/database'

interface TaskCardProps {
  task: Task & {
    agent_registry?: { agent_type: AgentType; department: string; role: string } | null
    brands?: { name: string; slug: string } | null
  }
}

const STATUS_COLOURS: Record<string, string> = {
  backlog: 'bg-stone-500/15 text-stone-400',
  assigned: 'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-amber-500/15 text-amber-400',
  review: 'bg-purple-500/15 text-purple-400',
  done: 'bg-emerald-500/15 text-emerald-400',
  blocked: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-stone-500/15 text-stone-500',
}

const PRIORITY_COLOURS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-foreground',
  low: 'text-muted-foreground',
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate ${PRIORITY_COLOURS[task.priority]}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOURS[task.status]}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        {task.agent_registry && (
          <div className="flex items-center gap-1">
            <AgentAvatar agentType={task.agent_registry.agent_type} size="sm" />
            <span>{task.agent_registry.department}</span>
          </div>
        )}
        {task.brands && (
          <span className="truncate">{task.brands.name}</span>
        )}
        {task.cost_cents > 0 && (
          <span>${(task.cost_cents / 100).toFixed(2)}</span>
        )}
      </div>
    </div>
  )
}
