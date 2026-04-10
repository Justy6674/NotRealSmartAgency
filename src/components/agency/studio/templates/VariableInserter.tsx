'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Braces } from 'lucide-react'
import type { TemplateVariableDef } from '@/hooks/useTemplates'
import { BUILT_IN_VARIABLES } from '@/lib/template-variables'

interface VariableInserterProps {
  variables: TemplateVariableDef[]
  onInsert: (token: string) => void
}

/**
 * Dropdown button that inserts a `{variable_name}` token into whatever
 * caption editor is currently focused. Lists both the custom template
 * variables (from VariableManager) and NRS's built-in variables (brand,
 * date, product, etc.) so users have one place to pick from.
 *
 * Wire this to a RichCaptionEditor by passing an `onInsert` callback
 * that calls `editor.chain().focus().insertContent(token).run()`.
 */
export function VariableInserter({ variables, onInsert }: VariableInserterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const handlePick = (key: string) => {
    onInsert(`{${key}}`)
    setOpen(false)
  }

  const customKeys = new Set(variables.map(v => v.key))
  const builtInsToShow = BUILT_IN_VARIABLES.filter(v => !customKeys.has(v.key))

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Braces className="h-3 w-3" />
        Insert variable
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-border bg-card shadow-xl">
          <div className="max-h-72 overflow-y-auto p-1">
            {variables.length > 0 && (
              <>
                <div className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                  Template variables
                </div>
                {variables.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handlePick(v.key)}
                    className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-[10px] text-foreground block truncate">
                        {`{${v.key}}`}
                      </code>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {v.label}
                      </p>
                    </div>
                    <span className="text-[8px] uppercase text-muted-foreground/60">
                      {v.type ?? 'text'}
                    </span>
                  </button>
                ))}
              </>
            )}

            {builtInsToShow.length > 0 && (
              <>
                {variables.length > 0 && (
                  <div className="mx-2 my-1 border-t border-border" />
                )}
                <div className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                  Built-in variables
                </div>
                {builtInsToShow.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handlePick(v.key)}
                    className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-[10px] text-foreground block truncate">
                        {`{${v.key}}`}
                      </code>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {v.label}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {variables.length === 0 && builtInsToShow.length === 0 && (
              <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                No variables available.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
