'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil, Check } from 'lucide-react'
import type { MediaTag } from '@/types/database'

interface TagManagerProps {
  brandId: string
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  onTagsUpdated?: () => void
}

const TAG_COLOURS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

const TAG_CATEGORIES = ['campaign', 'product', 'season', 'mood', 'platform', 'other']

export function TagManager({ brandId, selectedTags, onSelectedTagsChange, onTagsUpdated }: TagManagerProps) {
  const [tags, setTags] = useState<MediaTag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColour, setNewColour] = useState('#6366f1')
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media-tags?brandId=${brandId}`)
      if (res.ok) setTags(await res.json())
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { fetchTags() }, [fetchTags])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/media-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        colour: newColour,
        category: newCategory || null,
        brandId,
      }),
    })
    if (res.ok) {
      setNewName('')
      setShowCreate(false)
      fetchTags()
      onTagsUpdated?.()
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    await fetch('/api/media-tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName.trim() }),
    })
    setEditingId(null)
    fetchTags()
    onTagsUpdated?.()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"?`)) return
    await fetch(`/api/media-tags?id=${id}`, { method: 'DELETE' })
    onSelectedTagsChange(selectedTags.filter(t => t !== name))
    fetchTags()
    onTagsUpdated?.()
  }

  const toggleTag = (name: string) => {
    onSelectedTagsChange(
      selectedTags.includes(name)
        ? selectedTags.filter(t => t !== name)
        : [...selectedTags, name]
    )
  }

  if (loading && tags.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Tags</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {/* Create tag form */}
      {showCreate && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted p-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Tag name..."
            autoFocus
            className="h-7 flex-1 min-w-[100px] rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="h-7 rounded border border-input bg-background px-1.5 text-xs focus:outline-none"
          >
            <option value="">Category...</option>
            {TAG_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {TAG_COLOURS.map(c => (
              <button
                key={c}
                onClick={() => setNewColour(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${
                  newColour === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded bg-[oklch(0.55_0.1_240)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tag chips */}
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.length > 0 && (
          <button
            onClick={() => onSelectedTagsChange([])}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted transition-colors"
          >
            Clear all
          </button>
        )}
        {tags.map(tag => {
          const isSelected = selectedTags.includes(tag.name)
          const isEditing = editingId === tag.id

          return (
            <div
              key={tag.id}
              className={`group relative inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-white/30 shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: `${tag.colour}20`,
                color: tag.colour,
                borderColor: tag.colour,
                border: `1px solid ${tag.colour}40`,
              }}
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(tag.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    className="h-4 w-20 bg-transparent text-[11px] focus:outline-none"
                  />
                  <button onClick={() => handleRename(tag.id)}>
                    <Check className="h-2.5 w-2.5" />
                  </button>
                </>
              ) : (
                <>
                  <span onClick={() => toggleTag(tag.name)}>{tag.name}</span>
                  {tag.category && (
                    <span className="opacity-50 text-[9px]">{tag.category}</span>
                  )}
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingId(tag.id); setEditName(tag.name) }}
                      className="hover:opacity-100 opacity-60"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(tag.id, tag.name) }}
                      className="hover:opacity-100 opacity-60"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
