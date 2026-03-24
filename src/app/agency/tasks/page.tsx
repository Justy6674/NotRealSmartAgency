'use client'

export const dynamic = 'force-dynamic'

import { TaskBoard } from '@/components/agency/TaskBoard'
import { CreateTaskDialog } from '@/components/agency/CreateTaskDialog'
import { useState } from 'react'

export default function TasksPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">Task Board</h1>
        <CreateTaskDialog onCreated={() => setRefreshKey(k => k + 1)} />
      </div>
      <TaskBoard key={refreshKey} />
    </div>
  )
}
