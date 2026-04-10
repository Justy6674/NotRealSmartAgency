'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import {
  Plus,
  Search,
  Hash,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface HashtagGroup {
  id: string
  brand_id: string
  name: string
  tags: string[]
  category: string | null
  created_at: string
  updated_at: string
}

interface HashtagManagerPageProps {
  brandId: string | null
}

interface EditorState {
  name: string
  category: string
  tags: string[]
  tagInput: string
}

const EMPTY_EDITOR: EditorState = {
  name: '',
  category: '',
  tags: [],
  tagInput: '',
}

/**
 * Full CRUD page for hashtag groups. Lists all groups for the active
 * brand and lets the user create/edit/delete inline. Opens from the
 * `/agency/studio/hashtags` route.
 *
 * Phase 6 of the Mixpost UI port.
 */
export function HashtagManagerPage({ brandId }: HashtagManagerPageProps) {
  const [groups, setGroups] = useState<HashtagGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchGroups = useCallback(async () => {
    if (!brandId) {
      setGroups([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hashtag-groups?brandId=${brandId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load hashtag groups')
      setGroups(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void fetchGroups()
  }, [fetchGroups])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) if (g.category) set.add(g.category)
    return Array.from(set).sort()
  }, [groups])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return groups.filter(g => {
      if (categoryFilter !== 'all') {
        if (categoryFilter === '__none__' && g.category) return false
        if (categoryFilter !== '__none__' && g.category !== categoryFilter) return false
      }
      if (!q) return true
      return (
        g.name.toLowerCase().includes(q) ||
        g.tags.some(t => t.toLowerCase().includes(q)) ||
        (g.category?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [groups, search, categoryFilter])

  const startEdit = (group: HashtagGroup) => {
    setEditingId(group.id)
    setEditor({
      name: group.name,
      category: group.category ?? '',
      tags: group.tags,
      tagInput: '',
    })
    setCreating(false)
  }

  const startCreate = () => {
    setEditingId(null)
    setEditor(EMPTY_EDITOR)
    setCreating(true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCreating(false)
    setEditor(EMPTY_EDITOR)
  }

  const addTag = () => {
    const raw = editor.tagInput.trim().replace(/^#/, '')
    if (!raw) return
    if (editor.tags.includes(raw)) {
      setEditor(e => ({ ...e, tagInput: '' }))
      return
    }
    setEditor(e => ({ ...e, tags: [...e.tags, raw], tagInput: '' }))
  }

  const removeTag = (tag: string) => {
    setEditor(e => ({ ...e, tags: e.tags.filter(t => t !== tag) }))
  }

  const handleSave = async () => {
    if (!editor.name.trim() || editor.tags.length === 0 || !brandId) return
    setSaving(true)
    setError(null)
    try {
      if (creating) {
        const res = await fetch('/api/hashtag-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId,
            name: editor.name.trim(),
            tags: editor.tags,
            category: editor.category.trim() || null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create group')
        const created = await res.json()
        setGroups(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        cancelEdit()
      } else if (editingId) {
        const res = await fetch('/api/hashtag-groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            name: editor.name.trim(),
            tags: editor.tags,
            category: editor.category.trim() || null,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update group')
        const updated = await res.json()
        setGroups(prev => prev.map(g => (g.id === updated.id ? updated : g)))
        cancelEdit()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/hashtag-groups?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to delete group')
      setGroups(prev => prev.filter(g => g.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (!brandId) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="text-base font-medium">Select a brand</h3>
          <p className="text-sm text-muted-foreground">
            Choose a brand from the sidebar to manage its hashtag groups.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-6 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Hashtag groups</h2>
          <p className="text-xs text-muted-foreground">
            Reusable sets of tags you can insert into any post.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.55_0.1_240)] px-3 py-2 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New group
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups or tags..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All categories</option>
          <option value="__none__">Uncategorised</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* New group editor (at top when creating) */}
      {creating && (
        <div className="rounded-lg border border-[oklch(0.55_0.1_240)]/40 bg-[oklch(0.55_0.1_240)]/5 p-4">
          <GroupEditorForm
            editor={editor}
            setEditor={setEditor}
            addTag={addTag}
            removeTag={removeTag}
            saving={saving}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground w-[30px]"></th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Category</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Tags</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && !creating && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {groups.length === 0 ? (
                    <div className="space-y-2">
                      <Hash className="h-6 w-6 mx-auto text-muted-foreground/60" />
                      <p>No hashtag groups yet.</p>
                      <button
                        type="button"
                        onClick={startCreate}
                        className="text-[oklch(0.55_0.1_240)] hover:underline"
                      >
                        Create your first group
                      </button>
                    </div>
                  ) : (
                    'No groups match your filters.'
                  )}
                </td>
              </tr>
            )}

            {filtered.map(group => {
              const isEditing = editingId === group.id
              const isConfirming = confirmId === group.id

              return (
                <Fragment key={group.id}>
                  <tr
                    className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => (isEditing ? cancelEdit() : startEdit(group))}
                        className="text-muted-foreground hover:text-foreground"
                        title={isEditing ? 'Collapse' : 'Expand'}
                      >
                        {isEditing ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(group)}
                        className="font-medium text-left hover:text-[oklch(0.55_0.1_240)]"
                      >
                        {group.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {group.category || <span className="italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {group.tags.length}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(group.id)}
                            className="rounded bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/30"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(group)}
                            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(group.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="border-b border-border bg-muted/20">
                      <td colSpan={5} className="px-3 py-3">
                        <GroupEditorForm
                          editor={editor}
                          setEditor={setEditor}
                          addTag={addTag}
                          removeTag={removeTag}
                          saving={saving}
                          onSave={handleSave}
                          onCancel={cancelEdit}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface GroupEditorFormProps {
  editor: EditorState
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>
  addTag: () => void
  removeTag: (tag: string) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

function GroupEditorForm({
  editor,
  setEditor,
  addTag,
  removeTag,
  saving,
  onSave,
  onCancel,
}: GroupEditorFormProps) {
  const canSave = editor.name.trim().length > 0 && editor.tags.length > 0

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">Name</span>
          <input
            type="text"
            value={editor.name}
            onChange={e => setEditor(v => ({ ...v, name: e.target.value }))}
            placeholder="e.g. Core brand tags"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">Category</span>
          <input
            type="text"
            value={editor.category}
            onChange={e => setEditor(v => ({ ...v, category: e.target.value }))}
            placeholder="e.g. core, campaign, seasonal"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Tags</span>
        <div className="flex flex-wrap gap-1.5 rounded border border-input bg-background px-2 py-1.5 min-h-[36px]">
          {editor.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={editor.tagInput}
            onChange={e => setEditor(v => ({ ...v, tagInput: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag()
              } else if (e.key === 'Backspace' && !editor.tagInput && editor.tags.length > 0) {
                removeTag(editor.tags[editor.tags.length - 1])
              }
            }}
            onBlur={addTag}
            placeholder={editor.tags.length === 0 ? 'Type a tag and press Enter' : ''}
            className="flex-1 min-w-[140px] bg-transparent text-[11px] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-1 rounded bg-[oklch(0.55_0.1_240)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[oklch(0.50_0.1_240)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
      </div>
    </div>
  )
}
