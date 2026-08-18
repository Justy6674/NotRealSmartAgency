'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, FileText, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useTemplates } from '@/hooks/useTemplates'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import { extractVariables, resolveTemplate } from '@/lib/template-variables'
import type { PostTemplate } from '@/types/database'

interface TemplatesIndexProps {
  brandId: string | null
  brandName?: string
  /**
   * The route family this index and its editor live in.
   *
   * Every link here used to be hard-coded to `/agency/studio/templates/{id}`,
   * so pressing Edit or New template from inside the Social department threw
   * the owner out of it — different sidebar, different tab strip, no way back
   * except the browser's Back button. Templates belong to Social now, so that
   * is the default.
   */
  basePath?: string
  /** Where "Use" takes the caption. Same reasoning as `basePath`. */
  composePath?: string
}

/**
 * The templates index.
 *
 * Mixpost's card carries **Use** and a dropdown holding exactly Edit and
 * Delete — no duplicate. Duplicate came out for the same reason it is absent
 * there: a copied template that is then edited is a new template, and the
 * shortest route to one is New template with the words already in the clipboard.
 * Keeping it meant three ways to end up with "Untitled template (copy) (copy)".
 *
 * **Use** is the action this page existed for and did not have. It resolves the
 * template's variables, then hands the words to the composer through the same
 * desk-action queue the Director uses, so the caption arrives in the editor
 * with an undo behind it rather than being pasted somewhere the owner then has
 * to find.
 */
export function TemplatesIndex({
  brandId,
  brandName,
  basePath = '/agency/social/templates',
  composePath = '/agency/social/compose',
}: TemplatesIndexProps) {
  const router = useRouter()
  const { templates, loading, error, deleteTemplate, createTemplate } = useTemplates(brandId)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuId) return
    const away = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuId(null)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [menuId])

  const platforms = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) if (t.platform) set.add(t.platform)
    return Array.from(set).sort()
  }, [templates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      if (platformFilter !== 'all') {
        if (platformFilter === 'all_platforms' && t.platform !== null) return false
        if (platformFilter !== 'all_platforms' && t.platform !== platformFilter) return false
      }
      if (!q) return true
      return t.name.toLowerCase().includes(q) || t.caption_template.toLowerCase().includes(q)
    })
  }, [templates, search, platformFilter])

  const handleCreate = async () => {
    if (!brandId || creating) return
    setCreating(true)
    try {
      const created = await createTemplate({
        brandId,
        name: 'Untitled template',
        captionTemplate: '',
        defaultHashtags: [],
        platform: null,
        variables: [],
      })
      if (created) router.push(`${basePath}/${created.id}`)
    } finally {
      setCreating(false)
    }
  }

  /**
   * Put this template's words into the composer.
   *
   * Variables that are still unfilled are left as they are rather than being
   * silently emptied — `{offer}` in the box is a visible thing to replace,
   * whereas a gap in a sentence is something to miss. The brand's own name is
   * the one substitution made here, because it is the one we can be sure of.
   */
  const handleUse = (template: PostTemplate) => {
    if (!brandId) return
    const unresolved: Record<string, string> = {}
    for (const key of extractVariables(template.caption_template)) {
      unresolved[key] = `{${key}}`
    }
    const caption = resolveTemplate(template.caption_template, unresolved, brandName ?? '')

    useComposeDeskStore.getState().enqueueDeskActions({
      brandId,
      actions: [
        { type: 'set_master_caption', caption },
        ...(template.default_hashtags.length > 0
          ? [{ type: 'set_hashtags' as const, hashtags: template.default_hashtags }]
          : []),
      ],
      hashtagsAreSuggested: true,
    })
    router.push(composePath)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const ok = await deleteTemplate(id)
    setDeletingId(null)
    setConfirmId(ok ? null : id)
  }

  if (!brandId) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="space-y-3 text-center">
          <AlertCircle className="mx-auto h-9 w-9" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
          <h3 className="text-[14px] font-semibold">Choose a business</h3>
          <p className="text-[12.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            Templates are kept per business. Pick one from the sidebar.
          </p>
        </div>
      </div>
    )
  }

  const quiet = {
    borderColor: 'var(--line, oklch(0.915 0.007 240))',
    background: 'var(--panel, oklch(1 0 0))',
    color: 'var(--ink, oklch(0.20 0.014 240))',
  }

  return (
    <div className="space-y-5" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Templates</h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            Captions you reuse, with the bits that change left as blanks.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold disabled:opacity-60"
          style={{
            background: 'var(--brand-deep, oklch(0.33 0.08 240))',
            color: 'var(--brand-ink, oklch(1 0 0))',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New template
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-8 w-full rounded-lg border pl-8 pr-2 text-[12.5px] focus:outline-none"
            style={quiet}
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          aria-label="Filter by platform"
          className="h-8 rounded-lg border px-2 text-[12.5px] focus:outline-none"
          style={quiet}
        >
          <option value="all">All platforms</option>
          <option value="all_platforms">Works anywhere</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          className="rounded-lg border px-3 py-2 text-[12.5px]"
          style={{ borderColor: 'oklch(0.55 0.17 27 / 0.3)', background: 'oklch(0.55 0.17 27 / 0.07)' }}
        >
          {error}
        </div>
      )}

      {loading && templates.length === 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border"
              style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
            />
          ))}
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div
          className="flex h-64 flex-col items-center justify-center space-y-3 rounded-xl border border-dashed text-center"
          style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
        >
          <FileText className="h-7 w-7" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
          <div>
            <h3 className="text-[13.5px] font-semibold">No templates yet</h3>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
              Write a caption once, leave the changing bits blank, reuse it forever.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-[6px] text-[12px] font-semibold disabled:opacity-60"
            style={{
              background: 'var(--brand-deep, oklch(0.33 0.08 240))',
              color: 'var(--brand-ink, oklch(1 0 0))',
            }}
          >
            <Plus className="h-3 w-3" />
            Create one
          </button>
        </div>
      )}

      {!loading && templates.length > 0 && filtered.length === 0 && (
        <div
          className="rounded-lg border px-4 py-6 text-center text-[12.5px]"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel-2, oklch(0.975 0.004 240))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          Nothing matches that.
        </div>
      )}

      {/* Mixpost's masonry at three columns — cards are different heights
          because captions are, and forcing a row height crops the one useful
          thing on the card. */}
      {filtered.length > 0 && (
        <div className="columns-1 gap-3 md:columns-2 lg:columns-3">
          {filtered.map((template) => {
            const snippet = template.caption_template.slice(0, 160)
            const isConfirming = confirmId === template.id
            const isDeleting = deletingId === template.id
            const variableCount = Array.isArray(template.variables) ? template.variables.length : 0
            return (
              <div
                key={template.id}
                className="mb-3 flex break-inside-avoid flex-col rounded-xl border p-3 transition-shadow hover:shadow-sm"
                style={{
                  borderColor: 'var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`${basePath}/${template.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate text-[13.5px] font-semibold">{template.name}</h3>
                    <span
                      className="mt-0.5 block text-[11px] capitalize"
                      style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                    >
                      {template.platform ?? 'Works anywhere'}
                      {variableCount > 0 ? ` · ${variableCount} blank${variableCount === 1 ? '' : 's'}` : ''}
                    </span>
                  </Link>
                  <button
                    type="button"
                    title="Ask the Director to improve this"
                    aria-label="Ask the Director to improve this"
                    onClick={() =>
                      sendToDirector(
                        `Improve this post template called "${template.name}" for ${brandName ?? 'this brand'}. Current caption: "${template.caption_template.slice(0, 200)}". Hashtags: ${template.default_hashtags.map((t) => `#${t}`).join(' ') || 'none'}. Suggest a better caption, stronger hashtags, and any missing {variables}. Keep our brand voice.`,
                      )
                    }
                    className="shrink-0 rounded-full p-1"
                    style={{ background: 'var(--brand-wash, oklch(0.966 0.026 240))', color: 'var(--brand-deep, oklch(0.33 0.08 240))' }}
                  >
                    <Sparkles className="h-3 w-3" />
                  </button>
                </div>

                <p
                  className="mt-2 line-clamp-4 whitespace-pre-wrap text-[12px]"
                  style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
                >
                  {snippet || <span className="italic">No words yet</span>}
                  {template.caption_template.length > 160 && '…'}
                </p>

                {template.default_hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.default_hashtags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{
                          background: 'var(--panel-2, oklch(0.975 0.004 240))',
                          color: 'var(--ink-3, oklch(0.615 0.011 240))',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                    {template.default_hashtags.length > 4 && (
                      <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
                        +{template.default_hashtags.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div
                  className="mt-3 flex items-center justify-between gap-2 border-t pt-2"
                  style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
                >
                  {isConfirming ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]" style={{ color: 'var(--stop, oklch(0.55 0.17 27))' }}>
                        Delete this template?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(template.id)}
                        disabled={isDeleting}
                        className="rounded px-2 py-0.5 text-[11px] font-semibold disabled:opacity-60"
                        style={{ background: 'oklch(0.55 0.17 27 / 0.12)', color: 'var(--stop, oklch(0.55 0.17 27))' }}
                      >
                        {isDeleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-[11px]"
                        style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
                      >
                        Keep it
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUse(template)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-[6px] text-[12px] font-semibold"
                        style={{
                          background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                          color: 'var(--brand-ink, oklch(1 0 0))',
                        }}
                      >
                        Use
                      </button>

                      <div className="relative" ref={menuId === template.id ? menuRef : undefined}>
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={menuId === template.id}
                          aria-label={`Options for ${template.name}`}
                          onClick={() => setMenuId((id) => (id === template.id ? null : template.id))}
                          className="rounded-md p-1.5"
                          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === template.id ? (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border py-1 shadow-lg"
                            style={{
                              borderColor: 'var(--line, oklch(0.915 0.007 240))',
                              background: 'var(--panel, oklch(1 0 0))',
                            }}
                          >
                            <Link
                              href={`${basePath}/${template.id}`}
                              role="menuitem"
                              className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]"
                              onClick={() => setMenuId(null)}
                            >
                              <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--ink-3)' }} />
                              Edit
                            </Link>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => { setMenuId(null); setConfirmId(template.id) }}
                              className="flex w-full items-center gap-2 px-3 py-[7px] text-left text-[12.5px] hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]"
                              style={{ color: 'var(--stop, oklch(0.55 0.17 27))' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : null}
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
