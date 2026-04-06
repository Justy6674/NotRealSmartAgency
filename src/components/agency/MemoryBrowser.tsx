'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Trash2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// MemoryBrowser — shows and manages a brand's learned memories
// ---------------------------------------------------------------------------

interface Memory {
  id: string
  key: string
  value: string | Record<string, unknown>
  memory_type: string
  confidence: number
  source: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  namespace: string
}

const TYPE_LABELS: Record<string, string> = {
  brand_rule: 'Brand Rules',
  preference: 'Preferences',
  decision: 'Decisions',
  observation: 'Observations',
  metric: 'Metrics',
  conversation: 'Conversation Summaries',
}

const TYPE_COLOURS: Record<string, string> = {
  brand_rule:
    'bg-oklch(0.85_0.06_240) text-oklch(0.25_0.06_240)',
  preference:
    'bg-oklch(0.85_0.06_180) text-oklch(0.25_0.06_180)',
  decision:
    'bg-oklch(0.85_0.06_60) text-oklch(0.25_0.06_60)',
  observation:
    'bg-oklch(0.85_0.06_300) text-oklch(0.25_0.06_300)',
  metric:
    'bg-oklch(0.85_0.06_120) text-oklch(0.25_0.06_120)',
  conversation:
    'bg-oklch(0.85_0.03_240) text-oklch(0.25_0.03_240)',
}

function getFactText(value: Memory['value']): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    // Common patterns: { fact: "..." } or { summary: "..." } or { text: "..." }
    const v = value as Record<string, unknown>
    if (typeof v.fact === 'string') return v.fact
    if (typeof v.summary === 'string') return v.summary
    if (typeof v.text === 'string') return v.text
    return JSON.stringify(value)
  }
  return String(value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface MemoryBrowserProps {
  brandId: string
}

export function MemoryBrowser({ brandId }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set())

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/memories?brandId=${brandId}&limit=200`)
      if (res.ok) {
        const data = await res.json()
        setMemories(data)
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/memories?scope=single&id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete memory:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const res = await fetch(
        `/api/memories?scope=brand&brandId=${brandId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        setMemories([])
        setShowDeleteAll(false)
      }
    } catch (err) {
      console.error('Failed to delete all memories:', err)
    } finally {
      setDeletingAll(false)
    }
  }

  const toggleType = (type: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Group memories by type
  const grouped = memories.reduce<Record<string, Memory[]>>((acc, mem) => {
    const type = mem.memory_type || 'observation'
    if (!acc[type]) acc[type] = []
    acc[type].push(mem)
    return acc
  }, {})

  const typeOrder = [
    'brand_rule',
    'preference',
    'decision',
    'observation',
    'metric',
    'conversation',
  ]
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) =>
      (typeOrder.indexOf(a) === -1 ? 99 : typeOrder.indexOf(a)) -
      (typeOrder.indexOf(b) === -1 ? 99 : typeOrder.indexOf(b))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-centre gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading memories...
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-centre">
        <Brain className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No memories yet. Start chatting and I&apos;ll learn your preferences.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {memories.length} {memories.length === 1 ? 'memory' : 'memories'}{' '}
          learned
        </p>
        <div className="flex gap-2">
          <a
            href="/api/memories/export"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export All
          </a>
          {!showDeleteAll ? (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete All
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">
                Delete all memories for this brand?
              </span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
              >
                {deletingAll ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowDeleteAll(false)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grouped memory sections */}
      {sortedTypes.map((type) => {
        const items = grouped[type]
        const isCollapsed = collapsedTypes.has(type)
        const label = TYPE_LABELS[type] ?? type

        return (
          <div
            key={type}
            className="rounded-lg border bg-card overflow-hidden"
          >
            {/* Section header */}
            <button
              onClick={() => toggleType(type)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{label}</span>
              <span
                className={cn(
                  'ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  TYPE_COLOURS[type] ??
                    'bg-muted text-muted-foreground'
                )}
              >
                {items.length}
              </span>
            </button>

            {/* Memory items */}
            {!isCollapsed && (
              <div className="divide-y">
                {items.map((mem) => (
                  <div
                    key={mem.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm leading-relaxed">
                        {getFactText(mem.value)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {/* Confidence bar */}
                        <div className="flex items-center gap-1.5">
                          <span>Confidence</span>
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.round((mem.confidence ?? 0.5) * 100)}%`,
                              }}
                            />
                          </div>
                          <span>
                            {Math.round((mem.confidence ?? 0.5) * 100)}%
                          </span>
                        </div>

                        <span className="text-muted-foreground/50">|</span>

                        {/* Source badge */}
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase',
                            mem.source === 'llm'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {mem.source ?? 'regex'}
                        </span>

                        <span className="text-muted-foreground/50">|</span>

                        {/* Date */}
                        <span>Learned {formatDate(mem.updated_at)}</span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(mem.id)}
                      disabled={deletingId === mem.id}
                      className="opacity-0 group-hover:opacity-100 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                      title="Delete memory"
                    >
                      {deletingId === mem.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
