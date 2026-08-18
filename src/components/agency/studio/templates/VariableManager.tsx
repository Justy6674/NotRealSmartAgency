'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Variable } from 'lucide-react'
import type { TemplateVariableDef } from '@/hooks/useTemplates'

interface VariableManagerProps {
  variables: TemplateVariableDef[]
  onChange: (variables: TemplateVariableDef[]) => void
}

const VARIABLE_TYPES: Array<{ value: NonNullable<TemplateVariableDef['type']>; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'hashtag_group', label: 'Hashtag group' },
]

/**
 * Inline editor for a template's blanks.
 *
 * The owner sees "blanks"; the code says variables, because that is what the
 * stored field is called and renaming it would be a migration for a word. A
 * non-technical person reading "variable" on a caption screen reads maths.
 *
 * Variables are
 * referenced in the caption via `{key}` single-brace syntax, matching
 * NRS's existing `resolveTemplate()` helper.
 *
 * Each variable has:
 *  - key (snake_case identifier, used as `{key}` in the caption)
 *  - label (display name for the fill-in form)
 *  - type (text, date, select, hashtag_group)
 *  - default value
 *  - description (optional hint)
 *  - options (only for `select` type)
 */
export function VariableManager({ variables, onChange }: VariableManagerProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const normaliseKey = (raw: string) =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

  const addVariable = () => {
    // Pick a unique key
    let i = 1
    let key = 'variable_1'
    const existing = new Set(variables.map(v => v.key))
    while (existing.has(key)) {
      i += 1
      key = `variable_${i}`
    }
    const next: TemplateVariableDef = {
      key,
      label: `Variable ${i}`,
      type: 'text',
      default: '',
      description: '',
    }
    onChange([...variables, next])
    setExpandedKey(key)
  }

  const updateVariable = (index: number, patch: Partial<TemplateVariableDef>) => {
    const next = variables.slice()
    const existing = next[index]
    const merged: TemplateVariableDef = { ...existing, ...patch }

    // If key changed, normalise it and ensure uniqueness
    if (patch.key !== undefined) {
      let newKey = normaliseKey(patch.key)
      if (!newKey) newKey = existing.key
      const otherKeys = new Set(next.filter((_, i) => i !== index).map(v => v.key))
      let candidate = newKey
      let suffix = 1
      while (otherKeys.has(candidate)) {
        suffix += 1
        candidate = `${newKey}_${suffix}`
      }
      merged.key = candidate
      if (expandedKey === existing.key) setExpandedKey(candidate)
    }

    next[index] = merged
    onChange(next)
  }

  const removeVariable = (index: number) => {
    const removed = variables[index]
    onChange(variables.filter((_, i) => i !== index))
    if (expandedKey === removed.key) setExpandedKey(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Variable className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Blanks</span>
          <span className="text-[10px] text-muted-foreground">
            ({variables.length})
          </span>
        </div>
        <button
          type="button"
          onClick={addVariable}
          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add a blank
        </button>
      </div>

      {variables.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[10px] text-muted-foreground">
          No blanks yet. A blank is a bit of the caption that changes each time — write <code className="text-foreground">{'{product}'}</code> and you will be asked to fill it in whenever you use this template.
        </p>
      ) : (
        <div className="space-y-1.5">
          {variables.map((v, index) => {
            const isExpanded = expandedKey === v.key
            return (
              <div
                key={`${v.key}-${index}`}
                className="rounded-md border border-border bg-muted/20"
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : v.key)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <code className="text-[11px] text-foreground">{`{${v.key}}`}</code>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {v.label}
                  </span>
                  <span className="ml-auto text-[9px] text-muted-foreground uppercase">
                    {v.type ?? 'text'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVariable(index)}
                    className="text-muted-foreground/50 hover:text-destructive"
                    title="Remove this blank"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-2 py-2 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-medium text-muted-foreground">Key</span>
                        <input
                          type="text"
                          value={v.key}
                          onChange={e => updateVariable(index, { key: e.target.value })}
                          className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-medium text-muted-foreground">Label</span>
                        <input
                          type="text"
                          value={v.label}
                          onChange={e => updateVariable(index, { label: e.target.value })}
                          className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-medium text-muted-foreground">Type</span>
                        <select
                          value={v.type ?? 'text'}
                          onChange={e => updateVariable(index, { type: e.target.value as TemplateVariableDef['type'] })}
                          className="w-full h-6 rounded border border-input bg-background px-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {VARIABLE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9px] font-medium text-muted-foreground">Default</span>
                        <input
                          type="text"
                          value={v.default ?? ''}
                          onChange={e => updateVariable(index, { default: e.target.value })}
                          placeholder="Optional..."
                          className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                    </div>

                    <label className="block space-y-0.5">
                      <span className="text-[9px] font-medium text-muted-foreground">Description</span>
                      <input
                        type="text"
                        value={v.description ?? ''}
                        onChange={e => updateVariable(index, { description: e.target.value })}
                        placeholder="Hint shown when filling in..."
                        className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    {v.type === 'select' && (
                      <label className="block space-y-0.5">
                        <span className="text-[9px] font-medium text-muted-foreground">
                          Options (comma-separated)
                        </span>
                        <input
                          type="text"
                          value={(v.options ?? []).join(', ')}
                          onChange={e => updateVariable(index, {
                            options: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                          })}
                          placeholder="Option 1, Option 2, ..."
                          className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
