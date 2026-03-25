'use client'

import { useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Competitor, CompetitorCategory } from '@/types/database'

interface CompetitorEditorProps {
  competitors: Competitor[]
  onChange: (competitors: Competitor[]) => void
}

const CATEGORY_LABELS: Record<CompetitorCategory, { label: string; colour: string }> = {
  direct: { label: 'Direct', colour: 'bg-red-500/15 text-red-400' },
  adjacent: { label: 'Adjacent', colour: 'bg-amber-500/15 text-amber-400' },
  aspirational: { label: 'Aspirational', colour: 'bg-blue-500/15 text-blue-400' },
  indirect: { label: 'Indirect', colour: 'bg-zinc-500/15 text-zinc-400' },
}

const EMPTY_COMPETITOR: Competitor = {
  name: '',
  url: '',
  notes: '',
  category: 'direct',
  why: '',
  watch_pages: [],
  keywords: [],
  is_active: true,
}

export function CompetitorEditor({ competitors, onChange }: CompetitorEditorProps) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Competitor>(EMPTY_COMPETITOR)
  const [showAdd, setShowAdd] = useState(false)

  const handleAdd = () => {
    if (!draft.name.trim() || !draft.url.trim()) return
    onChange([...competitors, { ...draft }])
    setDraft(EMPTY_COMPETITOR)
    setShowAdd(false)
  }

  const handleRemove = (index: number) => {
    onChange(competitors.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updated: Competitor) => {
    const next = [...competitors]
    next[index] = updated
    onChange(next)
    setEditing(null)
  }

  const handleToggleActive = (index: number) => {
    const next = [...competitors]
    next[index] = { ...next[index], is_active: !(next[index].is_active ?? true) }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Competitors ({competitors.length})
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Competitor
        </button>
      </div>

      {/* Competitor list */}
      {competitors.length === 0 && !showAdd && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No competitors set. Add competitors so your agents understand your market position.
        </p>
      )}

      {competitors.map((comp, i) => {
        const isEditing = editing === i
        const cat = CATEGORY_LABELS[comp.category ?? 'direct']
        const active = comp.is_active ?? true

        if (isEditing) {
          return (
            <CompetitorForm
              key={i}
              value={comp}
              onSave={(updated) => handleUpdate(i, updated)}
              onCancel={() => setEditing(null)}
            />
          )
        }

        return (
          <div
            key={i}
            className={cn(
              'rounded-lg border p-3 space-y-1.5 transition-opacity',
              !active && 'opacity-50'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', cat.colour)}>
                {cat.label}
              </span>
              <span className="text-sm font-medium">{comp.name}</span>
              <a
                href={comp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => handleToggleActive(i)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {active ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => setEditing(i)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            {comp.why && (
              <p className="text-xs text-muted-foreground italic">&quot;{comp.why}&quot;</p>
            )}
            {comp.watch_pages && comp.watch_pages.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Watching: {comp.watch_pages.join(', ')}
              </p>
            )}
          </div>
        )
      })}

      {/* Add form */}
      {showAdd && (
        <CompetitorForm
          value={draft}
          onSave={(comp) => { setDraft(EMPTY_COMPETITOR); onChange([...competitors, comp]); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
          isNew
        />
      )}
    </div>
  )
}

// ─── Competitor Form ─────────────────────────────────────────────────────────

function CompetitorForm({
  value,
  onSave,
  onCancel,
  isNew,
}: {
  value: Competitor
  onSave: (comp: Competitor) => void
  onCancel: () => void
  isNew?: boolean
}) {
  const [form, setForm] = useState(value)

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Name</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="My Weight Loss Clinic"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">URL</label>
          <input
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            placeholder="https://competitor.com.au"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">Category</label>
        <select
          value={form.category ?? 'direct'}
          onChange={e => setForm({ ...form, category: e.target.value as CompetitorCategory })}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        >
          <option value="direct">Direct — same market, same offering</option>
          <option value="adjacent">Adjacent — related market, different model</option>
          <option value="aspirational">Aspirational — where I want to be</option>
          <option value="indirect">Indirect — patients compare but different category</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">
          Why are they a competitor? (this gets fed to your AI agents)
        </label>
        <textarea
          value={form.why ?? ''}
          onChange={e => setForm({ ...form, why: e.target.value })}
          placeholder="e.g., They run face-to-face weight loss clinics in the same metro areas. Same demographic (35-55F). Their pricing is $50 cheaper per consult."
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Watch pages (comma-separated)</label>
          <input
            value={(form.watch_pages ?? []).join(', ')}
            onChange={e => setForm({ ...form, watch_pages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="/pricing, /blog, /changelog"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Alert keywords (comma-separated)</label>
          <input
            value={(form.keywords ?? []).join(', ')}
            onChange={e => setForm({ ...form, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="pricing, new feature, telehealth"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || !form.url.trim()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isNew ? 'Add' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
