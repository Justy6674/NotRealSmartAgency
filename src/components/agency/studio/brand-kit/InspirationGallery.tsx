'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, ExternalLink, Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { InspirationEntry } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface InspirationGalleryProps {
  brandId: string | null
}

export function InspirationGallery({ brandId }: InspirationGalleryProps) {
  const [entries, setEntries] = useState<InspirationEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) {
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('inspiration_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!cancelled && data) {
        setEntries(data as InspirationEntry[])
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [brandId])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <Lightbulb className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No inspiration saved yet. Ask the Director to research brands you admire.
        </p>
        <button
          type="button"
          onClick={() =>
            sendToDirector(
              'Research some inspiring marketing examples from brands I could learn from. Look at different industries and save the best ones to my inspiration library.'
            )
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colours"
        >
          <Sparkles className="h-3 w-3" />
          Find inspiration for me
        </button>
      </div>
    )
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="break-inside-avoid rounded-xl border border-border bg-card p-4 space-y-2.5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{entry.brand_name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{entry.industry}</p>
            </div>
            {entry.source_url && (
              <a
                href={entry.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colours"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* What they did */}
          <p className="text-xs text-foreground/80 leading-relaxed">{entry.what_they_did}</p>

          {/* Why it works */}
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            {entry.why_it_works}
          </p>

          {/* Transferable principle — highlighted */}
          <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
            <p className="text-[11px] font-medium text-primary leading-relaxed">
              {entry.transferable_principle}
            </p>
          </div>

          {/* Tags */}
          {entry.applicability_tags && entry.applicability_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.applicability_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Platform + format pills */}
          <div className="flex items-center gap-1.5">
            {entry.platform && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 capitalize">
                {entry.platform}
              </span>
            )}
            {entry.format && (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 capitalize">
                {entry.format.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Add more button */}
      <div className="break-inside-avoid flex justify-center pt-2">
        <button
          type="button"
          onClick={() =>
            sendToDirector('I want to save some brand inspiration. Help me capture marketing examples I admire.')
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colours"
        >
          <Sparkles className="h-3 w-3" />
          Add inspiration
        </button>
      </div>
    </div>
  )
}
