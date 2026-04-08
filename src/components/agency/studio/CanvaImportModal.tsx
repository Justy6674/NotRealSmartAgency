'use client'

import { useState, useEffect } from 'react'
import { X, Download, Loader2, CheckCircle2, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'

interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
}

interface CanvaImportModalProps {
  onClose: () => void
  onImported: () => void
}

export function CanvaImportModal({ onClose, onImported }: CanvaImportModalProps) {
  const { activeBrandId } = useAgencyStore()
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeBrandId) return
    setLoading(true)
    fetch(`/api/canva/designs?brandId=${activeBrandId}`)
      .then(r => r.ok ? r.json() : { designs: [] })
      .then(data => setDesigns(data.designs ?? []))
      .catch(() => setDesigns([]))
      .finally(() => setLoading(false))
  }, [activeBrandId])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleImport = async () => {
    if (!activeBrandId || selectedIds.size === 0) return
    setImporting(true)
    setError(null)

    let successCount = 0
    for (const designId of selectedIds) {
      try {
        const res = await fetch('/api/canva/import-to-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            designId,
            brandId: activeBrandId,
            format: 'png',
          }),
        })
        if (res.ok) {
          successCount++
          setImportedIds(prev => new Set(prev).add(designId))
        } else {
          const err = await res.json().catch(() => ({}))
          console.error('[canva-import] Failed:', err)
        }
      } catch (err) {
        console.error('[canva-import] Error:', err)
      }
    }

    setImporting(false)
    if (successCount > 0) {
      onImported()
    }
    if (successCount < selectedIds.size) {
      setError(`${successCount} of ${selectedIds.size} imported. Some failed.`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-border bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-400" />
            <h2 className="text-sm font-semibold text-foreground">Import from Canva</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No Canva designs found. Create some in Canva first.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Select designs to import as images into your media library. Click to select, then Import.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {designs.map(design => {
                  const isSelected = selectedIds.has(design.id)
                  const isImported = importedIds.has(design.id)
                  return (
                    <button
                      key={design.id}
                      type="button"
                      onClick={() => !isImported && toggleSelect(design.id)}
                      disabled={isImported}
                      className={cn(
                        'relative rounded-lg border-2 overflow-hidden transition-all text-left',
                        isImported ? 'border-emerald-500 opacity-60' :
                        isSelected ? 'border-primary ring-1 ring-primary' :
                        'border-border hover:border-primary/50',
                      )}
                    >
                      <div className="aspect-square bg-muted">
                        {design.thumbnail_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={design.thumbnail_url}
                            alt={design.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Palette className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <p className="px-2 py-1.5 text-[10px] text-muted-foreground truncate">
                        {design.title}
                      </p>

                      {/* Selection / imported indicator */}
                      {isImported && (
                        <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500 p-0.5">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {isSelected && !isImported && (
                        <div className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5">
                          <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedIds.size > 0 && `${selectedIds.size} selected`}
            {error && <span className="text-amber-400 ml-2">{error}</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {importedIds.size > 0 ? 'Done' : 'Cancel'}
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {importing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing...</>
              ) : (
                <><Download className="h-3.5 w-3.5" /> Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
