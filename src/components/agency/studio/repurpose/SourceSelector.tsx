'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Link2, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type { Output } from '@/types/database'

type SourceType = 'outputs' | 'paste'

interface SourceSelectorProps {
  brandId: string | null
  onSourceSelect: (source: { type: 'output' | 'text' | 'url'; title: string; content: string; outputId?: string }) => void
  selectedSourceId?: string | null
}

export function SourceSelector({ brandId, onSourceSelect, selectedSourceId }: SourceSelectorProps) {
  const [sourceType, setSourceType] = useState<SourceType>('outputs')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const [pasteUrl, setPasteUrl] = useState('')
  const [expanded, setExpanded] = useState(true)

  // Fetch outputs
  useEffect(() => {
    if (!brandId || sourceType !== 'outputs') return
    setLoading(true)
    fetch(`/api/outputs?brandId=${brandId}&limit=50`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Output[] | { outputs: Output[] }) => {
        const list = Array.isArray(data) ? data : (data.outputs ?? [])
        setOutputs(list)
      })
      .catch(() => setOutputs([]))
      .finally(() => setLoading(false))
  }, [brandId, sourceType])

  const filteredOutputs = outputs.filter(o =>
    !searchQuery.trim() ||
    o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleOutputSelect = useCallback((output: Output) => {
    onSourceSelect({
      type: 'output',
      title: output.title,
      content: output.content,
      outputId: output.id,
    })
  }, [onSourceSelect])

  const handlePasteSubmit = useCallback(() => {
    if (pasteUrl.trim()) {
      onSourceSelect({
        type: 'url',
        title: pasteUrl.trim(),
        content: pasteContent.trim() || pasteUrl.trim(),
      })
    } else if (pasteContent.trim()) {
      onSourceSelect({
        type: 'text',
        title: pasteContent.trim().slice(0, 60) + (pasteContent.length > 60 ? '...' : ''),
        content: pasteContent.trim(),
      })
    }
  }, [pasteContent, pasteUrl, onSourceSelect])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[oklch(0.18_0.01_240)] transition-colors"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Source Content
        </h3>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Source type toggle */}
          <div className="flex gap-1 rounded-lg bg-[oklch(0.16_0.01_240)] p-1">
            <button
              type="button"
              onClick={() => setSourceType('outputs')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceType === 'outputs'
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <FileText className="h-3 w-3" />
              Past Outputs
            </button>
            <button
              type="button"
              onClick={() => setSourceType('paste')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceType === 'paste'
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <Link2 className="h-3 w-3" />
              Paste Text / URL
            </button>
          </div>

          {/* Outputs browser */}
          {sourceType === 'outputs' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search outputs..."
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOutputs.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-4">
                  {searchQuery ? 'No matching outputs' : 'No outputs yet'}
                </p>
              ) : (
                <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredOutputs.map(output => {
                    const isSelected = selectedSourceId === output.id
                    return (
                      <button
                        key={output.id}
                        type="button"
                        onClick={() => handleOutputSelect(output)}
                        className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                          isSelected
                            ? 'bg-[oklch(0.75_0.06_240)/0.15] ring-1 ring-[oklch(0.75_0.06_240)]'
                            : 'bg-[oklch(0.16_0.01_240)] hover:bg-[oklch(0.19_0.01_240)]'
                        }`}
                      >
                        <p className="text-xs font-medium text-foreground/90 truncate">
                          {output.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2 mt-0.5">
                          {output.content.slice(0, 120)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] rounded bg-[oklch(0.22_0.02_240)] px-1.5 py-0.5 text-muted-foreground uppercase">
                            {output.output_type}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40">
                            {new Date(output.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Paste content / URL */}
          {sourceType === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={pasteUrl}
                  onChange={e => setPasteUrl(e.target.value)}
                  placeholder="https://yourblog.com/article"
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Content
                </label>
                <textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="Paste your blog post, article, script, or any content to repurpose..."
                  rows={6}
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] resize-none font-[family-name:var(--font-ibm-plex-sans)]"
                />
              </div>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!pasteContent.trim() && !pasteUrl.trim()}
                className="flex items-center gap-2 rounded-lg bg-[oklch(0.22_0.03_240)] px-4 py-2 text-xs font-medium text-foreground hover:bg-[oklch(0.28_0.03_240)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Use This Content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
