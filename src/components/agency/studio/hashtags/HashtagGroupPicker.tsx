'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Hash, Plus, X, ChevronDown, Settings } from 'lucide-react'

interface HashtagGroup {
  id: string
  name: string
  tags: string[]
  category: string | null
}

interface HashtagGroupPickerProps {
  brandId: string
  onInsert: (tags: string[]) => void
}

export function HashtagGroupPicker({ brandId, onInsert }: HashtagGroupPickerProps) {
  const [groups, setGroups] = useState<HashtagGroup[]>([])
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTags, setNewTags] = useState('')

  const fetchGroups = useCallback(async () => {
    const res = await fetch(`/api/hashtag-groups?brandId=${brandId}`)
    if (res.ok) setGroups(await res.json())
  }, [brandId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const handleCreate = async () => {
    if (!newName.trim() || !newTags.trim()) return
    const tags = newTags.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
    const res = await fetch('/api/hashtag-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, name: newName.trim(), tags }),
    })
    if (res.ok) {
      setNewName('')
      setNewTags('')
      setShowCreate(false)
      fetchGroups()
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/hashtag-groups?id=${id}`, { method: 'DELETE' })
    fetchGroups()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Hash className="h-3 w-3" />
        Groups
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 w-64 rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Hashtag groups
            </span>
            <Link
              href="/agency/studio/hashtags"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-2.5 w-2.5" />
              Manage groups
            </Link>
          </div>
          <div className="p-2 space-y-1">
            {groups.length === 0 && !showCreate && (
              <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                No hashtag groups yet. Create one below.
              </p>
            )}

            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => { onInsert(group.tags); setOpen(false) }}
                  className="flex-1 text-left"
                >
                  <span className="text-xs font-medium">{group.name}</span>
                  <span className="ml-1.5 text-[9px] text-muted-foreground">
                    ({group.tags.length} tags)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(group.id)}
                  className="p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Create new */}
            {showCreate ? (
              <div className="border-t border-border pt-2 mt-1 space-y-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Group name..."
                  autoFocus
                  className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  placeholder="tag1, tag2, tag3..."
                  className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1">
                  <button onClick={handleCreate} className="rounded bg-[oklch(0.55_0.1_240)] px-2 py-1 text-[10px] font-medium text-white hover:bg-[oklch(0.50_0.1_240)]">
                    Save
                  </button>
                  <button onClick={() => setShowCreate(false)} className="text-[10px] text-muted-foreground hover:text-foreground px-2">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                New group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
