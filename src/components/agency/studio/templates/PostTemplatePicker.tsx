'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { extractVariables, resolveTemplate } from '@/lib/template-variables'

interface PostTemplate {
  id: string
  name: string
  caption_template: string
  default_hashtags: string[]
  platform: string | null
}

interface PostTemplatePickerProps {
  brandId: string
  brandName: string
  onApply: (caption: string, hashtags: string[]) => void
}

export function PostTemplatePicker({ brandId, brandName, onApply }: PostTemplatePickerProps) {
  const [templates, setTemplates] = useState<PostTemplate[]>([])
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<PostTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})

  const fetchTemplates = useCallback(async () => {
    const res = await fetch(`/api/post-templates?brandId=${brandId}`)
    if (res.ok) setTemplates(await res.json())
  }, [brandId])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleSelectTemplate = (template: PostTemplate) => {
    setSelectedTemplate(template)
    const vars = extractVariables(template.caption_template)
    const initial: Record<string, string> = {}
    for (const v of vars) {
      if (v === 'brand') initial[v] = brandName
      else initial[v] = ''
    }
    setVariableValues(initial)
  }

  const handleApply = () => {
    if (!selectedTemplate) return
    const resolved = resolveTemplate(selectedTemplate.caption_template, { ...variableValues }, brandName)
    onApply(resolved, selectedTemplate.default_hashtags)
    setSelectedTemplate(null)
    setOpen(false)
  }

  const previewText = selectedTemplate
    ? resolveTemplate(selectedTemplate.caption_template, { ...variableValues }, brandName)
    : ''

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="h-3 w-3" />
        Templates
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 w-80 rounded-lg border border-border bg-card shadow-xl">
          <div className="p-2">
            {!selectedTemplate ? (
              // Template list
              <div className="space-y-1">
                {templates.length === 0 && (
                  <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                    No templates yet. Create templates in Settings or ask the Director.
                  </p>
                )}
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full text-left rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs font-medium">{t.name}</span>
                    {t.platform && (
                      <span className="ml-1.5 text-[9px] text-muted-foreground capitalize">{t.platform}</span>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70 line-clamp-2">
                      {t.caption_template}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              // Variable fill form
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{selectedTemplate.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Back
                  </button>
                </div>

                {/* Variable inputs */}
                {Object.entries(variableValues).map(([key, value]) => (
                  <div key={key} className="space-y-0.5">
                    <label className="text-[9px] font-medium text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => setVariableValues(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={`Enter ${key}...`}
                      className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}

                {/* Preview */}
                <div className="rounded-md bg-muted/30 p-2">
                  <span className="text-[9px] font-medium text-muted-foreground">Preview:</span>
                  <p className="mt-1 text-[10px] text-foreground/70 line-clamp-4 whitespace-pre-wrap">
                    {previewText}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full rounded-md bg-[oklch(0.55_0.1_240)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] transition-colors"
                >
                  Use Template
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
