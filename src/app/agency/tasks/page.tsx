'use client'

export const dynamic = 'force-dynamic'

import { TaskBoard } from '@/components/agency/TaskBoard'

export default function TasksPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Task Board</h1>
      <TaskBoard />
    </div>
  )
}
