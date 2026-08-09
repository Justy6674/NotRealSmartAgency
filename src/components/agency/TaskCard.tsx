'use client'

import { useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import type { Task, AgentType } from '@/types/database'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'

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
  const setBrand = useAgencyStore((state) => state.setBrand)
  const setConversation = useAgencyStore((state) => state.setConversation)
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)

  const continueWithDirector = async () => {
    setContinuing(true)
    setContinueError(null)

    try {
      const response = await fetch(`/api/tasks/${task.id}/continue-goal-review`, { method: 'POST' })
      const body = await response.json() as { directorPrompt?: string; error?: string }
      if (!response.ok || !body.directorPrompt) {
        throw new Error(body.error ?? 'NRS could not continue this review. Please try again.')
      }

      if (task.brand_id) {
        setBrand(task.brand_id)
        setConversation(null)
      }

      window.setTimeout(() => {
        sendToDirector(body.directorPrompt!)
      }, 300)
      window.dispatchEvent(new Event('nrs-task-updated'))
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : 'NRS could not continue this review. Please try again.')
    } finally {
      setContinuing(false)
    }
  }

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

      {task.status === 'review' && (
        <button
          type="button"
          onClick={() => void continueWithDirector()}
          disabled={continuing}
          className="mt-3 rounded-md border border-amber-500/30 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-300"
        >
          {continuing ? 'Opening the Director…' : 'Choose next step with the Director'}
        </button>
      )}
      {continueError && (
        <p className="mt-2 text-xs text-red-500" role="alert">{continueError}</p>
      )}
    </div>
  )
}
