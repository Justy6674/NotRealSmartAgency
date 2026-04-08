'use client'

import { Palette, ExternalLink, Plus } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { CanvaDesign } from '@/hooks/useStudioData'

interface CanvaDesignsCardProps {
  configured: boolean
  designs: CanvaDesign[]
  totalDesigns?: number
  brandName?: string | null
  onShowAll?: () => void
}

export function CanvaDesignsCard({ configured, designs, totalDesigns, brandName, onShowAll }: CanvaDesignsCardProps) {
  const handleNewDesign = () => {
    sendToDirector('Design a graphic for my brand')
  }

  const handleSetup = () => {
    sendToDirector('Help me connect my Canva account')
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">Canva Designs</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">Connect Canva to see your designs here.</p>
          <button
            onClick={handleSetup}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Connect Canva
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-foreground">Canva Designs</h3>
        </div>
        <button
          onClick={handleNewDesign}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {/* Filtering note */}
      {totalDesigns != null && totalDesigns > designs.length && brandName && (
        <p className="text-[10px] text-muted-foreground">
          Showing {designs.length} of {totalDesigns} designs matching &ldquo;{brandName}&rdquo;.{' '}
          {onShowAll && (
            <button onClick={onShowAll} className="text-primary hover:text-primary/80 transition-colors">
              Show all
            </button>
          )}
        </p>
      )}

      {designs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">
            {totalDesigns && totalDesigns > 0
              ? `No designs matching "${brandName ?? 'this brand'}". `
              : 'No designs found. '}
            Create one to get started.
          </p>
          <button
            onClick={handleNewDesign}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Create a design
          </button>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {designs.map(design => (
            <a
              key={design.id}
              href={design.edit_url ?? design.view_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group shrink-0 w-[120px] space-y-1.5"
            >
              {/* Thumbnail */}
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted border border-border">
                {design.thumbnail_url ? (
                  <img
                    src={design.thumbnail_url}
                    alt={design.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Palette className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Title */}
              <p className="text-[11px] text-muted-foreground truncate group-hover:text-foreground transition-colors">
                {design.title}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
