'use client'

import { useEffect, useState } from 'react'
import { TaskCard } from './TaskCard'
import type { Task, AgentType, TaskStatus } from '@/types/database'

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
]

type TaskWithRelations = Task & {
  agent_registry?: { agent_type: AgentType; department: string; role: string } | null
  brands?: { name: string; slug: string } | null
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState<TaskStatus | 'all'>('all')

  useEffect(() => {
    const url = activeStatus === 'all'
      ? '/api/tasks'
      : `/api/tasks?status=${activeStatus}`

    fetch(url)
      .then(res => res.json())
      .then(data => { setTasks(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeStatus])

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStatus === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No tasks {activeStatus !== 'all' ? `with status "${activeStatus}"` : 'yet'}. Agents will create tasks as they work.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
