'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle, Hash, X } from 'lucide-react'
import { useTemplates, type TemplateDraft, type TemplateVariableDef } from '@/hooks/useTemplates'
import { VariableManager } from './VariableManager'
import { VariableInserter } from './VariableInserter'
import { extractVariables, resolveTemplate, BUILT_IN_VARIABLES } from '@/lib/template-variables'
import { PLATFORM_LABELS } from '@/lib/mixpost/ui-tokens'
import type { PostTemplate } from '@/types/database'

interface TemplateEditorProps {
  brandId: string | null
  brandName?: string
  templateId: string
  /**
   * Where "Back" goes, and therefore which chrome the owner stays inside.
   *
   * This was hard-coded to `/agency/studio/templates`, so a template opened
   * from the Social department ejected him out of it — the sidebar, the tab
   * strip and the department he was working in all changed underneath him
   * because he pressed Edit. Defaulting to the Social route rather than the
   * Studio one, since Social is where templates now live.
   */
  basePath?: string
}

const PLATFORM_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'All platforms' },
  { value: 'facebook', label: PLATFORM_LABELS.facebook },
  { value: 'instagram', label: PLATFORM_LABELS.instagram },
  { value: 'linkedin', label: PLATFORM_LABELS.linkedin },
  { value: 'tiktok', label: PLATFORM_LABELS.tiktok },
  { value: 'youtube', label: PLATFORM_LABELS.youtube },
  { value: 'twitter', label: PLATFORM_LABELS.twitter },
  { value: 'threads', label: PLATFORM_LABELS.threads },
]

/**
 * Full-form editor for a single template. Loads the template by id,
 * presents inputs for name, platform, caption, hashtags, and variables,
 * then saves via `useTemplates.updateTemplate`.
 *
 * Phase 6 of the Mixpost UI port.
 */
export function TemplateEditor({
  brandId,
  brandName,
  templateId,
  basePath = '/agency/social/templates',
}: TemplateEditorProps) {
  const { templates, getTemplate, updateTemplate, loading: listLoading } = useTemplates(brandId)

  const [template, setTemplate] = useState<PostTemplate | null>(null)
  const [draft, setDraft] = useState<TemplateDraft>({
    name: '',
    captionTemplate: '',
    defaultHashtags: [],
    platform: null,
    variables: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [hashtagInput, setHashtagInput] = useState('')

  const captionRef = useRef<HTMLTextAreaElement>(null)

  // Load template — first check the cached list, then fetch if missing.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!brandId) return
      setLoading(true)
      setError(null)

      // Optimistically use the cached list if available
      const cachedMatch = templates.find(t => t.id === templateId)
      const loaded = cachedMatch ?? (await getTemplate(templateId))

      if (cancelled) return

      if (!loaded) {
        setError('Template not found.')
        setLoading(false)
        return
      }

      setTemplate(loaded)
      setDraft({
        name: loaded.name,
        captionTemplate: loaded.caption_template,
        defaultHashtags: loaded.default_hashtags ?? [],
        platform: loaded.platform,
        variables: (loaded.variables ?? []) as TemplateVariableDef[],
      })
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
    // We intentionally depend on templates.length so we pick up the list
    // once it's loaded, but don't thrash if the list reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, templateId, templates.length])

  const updateDraft = useCallback(<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  // Insert a variable token at the caret position in the caption textarea.
  const handleInsertVariable = (token: string) => {
    const el = captionRef.current
    if (!el) {
      updateDraft('captionTemplate', draft.captionTemplate + token)
      return
    }
    const start = el.selectionStart ?? draft.captionTemplate.length
    const end = el.selectionEnd ?? draft.captionTemplate.length
    const next = draft.captionTemplate.slice(0, start) + token + draft.captionTemplate.slice(end)
    updateDraft('captionTemplate', next)
    // Restore focus + move caret after inserted token on next tick
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  // Detect variables that are used in the caption but not defined —
  // show them as suggestions the user can add to the variable list.
  const usedKeys = extractVariables(draft.captionTemplate)
  const builtInKeys = new Set(BUILT_IN_VARIABLES.map(v => v.key))
  const declaredKeys = new Set(draft.variables.map(v => v.key))
  const orphanKeys = usedKeys.filter(k => !declaredKeys.has(k) && !builtInKeys.has(k))

  const addOrphan = (key: string) => {
    updateDraft('variables', [
      ...draft.variables,
      { key, label: key.replace(/_/g, ' '), type: 'text', default: '' },
    ])
  }

  // Hashtag handling — chips + input
  const addHashtag = () => {
    const raw = hashtagInput.trim().replace(/^#/, '')
    if (!raw) return
    if (draft.defaultHashtags.includes(raw)) {
      setHashtagInput('')
      return
    }
    updateDraft('defaultHashtags', [...draft.defaultHashtags, raw])
    setHashtagInput('')
  }

  const removeHashtag = (tag: string) => {
    updateDraft('defaultHashtags', draft.defaultHashtags.filter(t => t !== tag))
  }

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const updated = await updateTemplate(templateId, draft)
    setSaving(false)
    if (updated) {
      setTemplate(updated)
      setDirty(false)
    } else {
      setError('Failed to save template.')
    }
  }

  // Preview with resolved variables
  const previewValues: Record<string, string> = {}
  for (const v of draft.variables) {
    previewValues[v.key] = v.default ?? `<${v.label}>`
  }
  const preview = resolveTemplate(draft.captionTemplate, previewValues, brandName)

  if (!brandId) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a brand to edit templates.</p>
        </div>
      </div>
    )
  }

  if (loading || listLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Link
          href={basePath}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to templates
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={basePath}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span className="text-sm font-medium truncate max-w-md">
            {draft.name || 'Untitled template'}
          </span>
          {dirty && (
            <span className="text-[10px] text-muted-foreground italic">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] text-destructive">{error}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.55_0.1_240)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Body — 2 columns on wide, stacked on narrow */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-5 p-6">
          {/* Left column: main form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Name + platform */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  Template name
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={e => updateDraft('name', e.target.value)}
                  placeholder="e.g. Weekly product launch"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  Platform
                </label>
                <select
                  value={draft.platform ?? ''}
                  onChange={e => updateDraft('platform', e.target.value || null)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PLATFORM_OPTIONS.map(opt => (
                    <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
                  Caption template
                </label>
                <VariableInserter
                  variables={draft.variables}
                  onInsert={handleInsertVariable}
                />
              </div>
              <textarea
                ref={captionRef}
                value={draft.captionTemplate}
                onChange={e => updateDraft('captionTemplate', e.target.value)}
                placeholder="What do you want to say? Use {variable} for dynamic fields."
                rows={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Use single-brace syntax like <code className="text-foreground">{'{product}'}</code> or <code className="text-foreground">{'{brand}'}</code> for variables.
              </p>

              {orphanKeys.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 space-y-1">
                  <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Undefined variables used in caption:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {orphanKeys.map(key => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => addOrphan(key)}
                        className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                      >
                        + {`{${key}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Default hashtags
              </label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[34px]">
                {draft.defaultHashtags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeHashtag(tag)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={e => setHashtagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addHashtag()
                    } else if (e.key === 'Backspace' && !hashtagInput && draft.defaultHashtags.length > 0) {
                      removeHashtag(draft.defaultHashtags[draft.defaultHashtags.length - 1])
                    }
                  }}
                  onBlur={addHashtag}
                  placeholder={draft.defaultHashtags.length === 0 ? 'Type a tag and press Enter' : ''}
                  className="flex-1 min-w-[120px] bg-transparent text-[11px] focus:outline-none"
                />
              </div>
            </div>

            {/* Variables */}
            <VariableManager
              variables={draft.variables}
              onChange={vars => updateDraft('variables', vars)}
            />
          </div>

          {/* Right column: live preview */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase">
                Preview
              </h4>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-xs whitespace-pre-wrap text-foreground/90">
                  {preview || (
                    <span className="italic text-muted-foreground">
                      Write a caption to see the preview.
                    </span>
                  )}
                </p>
                {draft.defaultHashtags.length > 0 && (
                  <p className="mt-2 text-xs text-[oklch(0.55_0.1_240)]">
                    {draft.defaultHashtags.map(t => `#${t}`).join(' ')}
                  </p>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground">
                Preview uses variable defaults. Actual values are filled in when the template is applied.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
