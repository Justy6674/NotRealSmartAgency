'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Download, PenLine, Loader2, ImageOff, RefreshCw } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
  edit_url: string | null
  view_url: string | null
  updated_at: string | null
}

interface DesignBrowsePanelProps {
  brand: Brand | null
}

export function DesignBrowsePanel({ brand }: DesignBrowsePanelProps) {
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDesign, setSelectedDesign] = useState<CanvaDesign | null>(null)

  const fetchDesigns = useCallback(async () => {
    if (!brand) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/canva/designs?brandId=${brand.id}`)
      const data = await res.json()

      setConfigured(data.configured !== false)
      setDesigns(data.designs ?? [])
      if (data.error) setError(data.error)
    } catch {
      setError('Failed to load designs')
    } finally {
      setLoading(false)
    }
  }, [brand])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const handleExport = (design: CanvaDesign) => {
    sendToDirector(
      `Export the Canva design "${design.title}" (ID: ${design.id}) as PNG. Save it to the media library for ${brand?.name ?? 'this brand'}.`
    )
  }

  const handleUseInPost = (design: CanvaDesign) => {
    sendToDirector(
      `Write a social media post for ${brand?.name ?? 'this brand'} to accompany the design "${design.title}". The design is ready in Canva (ID: ${design.id}).`
    )
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center space-y-3">
        <ImageOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Canva not connected. Connect your Canva account to browse designs.
        </p>
        <a
          href="/api/canva/auth"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect Canva
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Your Canva Designs ({designs.length})
        </h3>
        <button
          onClick={fetchDesigns}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs text-amber-400">{error}</p>
      )}

      {designs.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No designs found. Create one using the Create tab, or open Canva directly.
          </p>
        </div>
      ) : (
        <>
          {/* Design grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map(design => (
              <button
                key={design.id}
                onClick={() => setSelectedDesign(design)}
                className={`group rounded-xl border overflow-hidden text-left transition-all ${
                  selectedDesign?.id === design.id
                    ? 'border-primary/50 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="aspect-square bg-muted">
                  {design.thumbnail_url ? (
                    <img
                      src={design.thumbnail_url}
                      alt={design.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-foreground">{design.title}</p>
                  {design.updated_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(design.updated_at).toLocaleDateString('en-AU')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected design actions */}
          {selectedDesign && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground">{selectedDesign.title}</h4>
              <div className="flex flex-wrap gap-2">
                {selectedDesign.edit_url && (
                  <a
                    href={selectedDesign.edit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Edit in Canva
                  </a>
                )}
                <button
                  onClick={() => handleExport(selectedDesign)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
                <button
                  onClick={() => handleUseInPost(selectedDesign)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Use in Post
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
