'use client'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'

interface CreateTaskDialogProps {
  onCreated: () => void
}

export function CreateTaskDialog({ onCreated }: CreateTaskDialogProps) {
  const { activeBrandId } = useAgencyStore()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as string,
  })

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setCreating(true)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        brand_id: activeBrandId,
        status: 'backlog',
      }),
    })
    setForm({ title: '', description: '', priority: 'medium' })
    setCreating(false)
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        + New Task
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">Create Task</p>
      <input
        type="text"
        placeholder="Task title..."
        value={form.title}
        onChange={e => setForm({ ...form, title: e.target.value })}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        autoFocus
      />
      <textarea
        placeholder="Description (optional)..."
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      />
      <select
        value={form.priority}
        onChange={e => setForm({ ...form, priority: e.target.value })}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="low">Low priority</option>
        <option value="medium">Medium priority</option>
        <option value="high">High priority</option>
        <option value="critical">Critical</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={creating || !form.title.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
