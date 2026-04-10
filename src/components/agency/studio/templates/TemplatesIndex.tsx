'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Copy, Trash2, FileText, Pencil, AlertCircle, Sparkles } from 'lucide-react'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useTemplates } from '@/hooks/useTemplates'
import { useRouter } from 'next/navigation'
import type { PostTemplate } from '@/types/database'

interface TemplatesIndexProps {
  brandId: string | null
  brandName?: string
}

/**
 * Grid/list of post templates for the active brand. Used on
 * `/agency/studio/templates` as the landing page.
 *
 * Phase 6 of the Mixpost UI port. Mirrors the behaviour of
 * `Workspace/Templates/Index.vue` from Mixpost Pro but adapted to
 * NRS's single-workspace model (one brand at a time via the agency
 * store).
 */
export function TemplatesIndex({ brandId, brandName }: TemplatesIndexProps) {
  const router = useRouter()
  const { templates, loading, error, deleteTemplate, duplicateTemplate, createTemplate } = useTemplates(brandId)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Unique platforms for the filter dropdown.
  const platforms = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) if (t.platform) set.add(t.platform)
    return Array.from(set).sort()
  }, [templates])

  // Filtered list — search by name + caption, filter by platform.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter(t => {
      if (platformFilter !== 'all') {
        if (platformFilter === 'all_platforms' && t.platform !== null) return false
        if (platformFilter !== 'all_platforms' && t.platform !== platformFilter) return false
      }
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.caption_template.toLowerCase().includes(q)
      )
    })
  }, [templates, search, platformFilter])

  const handleCreate = async () => {
    if (!brandId) return
    const created = await createTemplate({
      brandId,
      name: 'Untitled template',
      captionTemplate: '',
      defaultHashtags: [],
      platform: null,
      variables: [],
    })
    if (created) router.push(`/agency/studio/templates/${created.id}`)
  }

  const handleDuplicate = async (template: PostTemplate) => {
    const copy = await duplicateTemplate(template)
    if (copy) router.push(`/agency/studio/templates/${copy.id}`)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const ok = await deleteTemplate(id)
    setDeletingId(null)
    setConfirmId(null)
    if (!ok) {
      // keep confirm open so user can retry
      setConfirmId(id)
    }
  }

  if (!brandId) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="text-base font-medium">Select a brand</h3>
          <p className="text-sm text-muted-foreground">
            Choose a brand from the sidebar to manage its templates.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-6 py-4">
      {/* Director Assist */}
      <DirectorAssistBar
        brandName={brandName ?? null}
        buttons={[
          {
            label: 'Create templates for my brand',
            prompt: `Create a set of platform-specific post templates with {variables} for ${brandName ?? 'this brand'}. Include templates for Instagram, Facebook, LinkedIn, TikTok and X. Use our brand voice and include default hashtags. Use the save_output tool to store each template.`,
          },
          {
            label: 'Review my templates',
            prompt: `Audit the existing post templates for ${brandName ?? 'this brand'}. Check coverage across platforms, variable usage, hashtag quality, and brand voice consistency. Identify gaps and suggest improvements. Use query_outputs to review what we have.`,
          },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Post templates</h2>
          <p className="text-xs text-muted-foreground">
            Reusable caption templates with variables for {brandName ?? 'this brand'}.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.55_0.1_240)] px-3 py-2 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New template
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
            placeholder="Search templates..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={platformFilter}
          onChange={e => setPlatformFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All platforms</option>
          <option value="all_platforms">Cross-platform only</option>
          {platforms.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && templates.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted/20" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">No templates yet</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create your first reusable caption template.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.55_0.1_240)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)]"
          >
            <Plus className="h-3 w-3" />
            Create template
          </button>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && templates.length > 0 && filtered.length === 0 && (
        <div className="rounded-md border border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No templates match your filters.
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(template => {
            const snippet = template.caption_template.slice(0, 120)
            const isConfirming = confirmId === template.id
            const isDeleting = deletingId === template.id
            return (
              <div
                key={template.id}
                className="group flex flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/agency/studio/templates/${template.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="text-sm font-medium truncate">{template.name}</h3>
                    {template.platform && (
                      <span className="inline-block mt-0.5 text-[10px] text-muted-foreground capitalize">
                        {template.platform}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    title="Improve with Director"
                    onClick={() =>
                      sendToDirector(
                        `Improve this post template called "${template.name}" for ${brandName ?? 'this brand'}. Current caption: "${template.caption_template.slice(0, 200)}". Hashtags: ${template.default_hashtags.map(t => `#${t}`).join(' ') || 'none'}. Suggest a better caption, stronger hashtags, and any missing {variables}. Keep our brand voice.`
                      )
                    }
                    className="shrink-0 rounded-full bg-amber-500/10 p-1 text-amber-400 hover:bg-amber-500/20 transition-colours"
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                </div>

                <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap">
                  {snippet || <span className="italic">Empty caption</span>}
                  {template.caption_template.length > 120 && '...'}
                </p>

                {template.default_hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.default_hashtags.slice(0, 4).map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                    {template.default_hashtags.length > 4 && (
                      <span className="text-[9px] text-muted-foreground/60">
                        +{template.default_hashtags.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {Array.isArray(template.variables) && template.variables.length > 0 && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {template.variables.length} variable{template.variables.length === 1 ? '' : 's'}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-destructive">Delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(template.id)}
                        disabled={isDeleting}
                        className="rounded bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/30 disabled:opacity-60"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes'}
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
                    <>
                      <Link
                        href={`/agency/studio/templates/${template.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(template)}
                          title="Duplicate"
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(template.id)}
                          title="Delete"
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
