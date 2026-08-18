'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Palette, RefreshCw } from 'lucide-react'

/**
 * The fourth source tab in the media library.
 *
 * Mixpost's fourth tab is "New design", and it only appears when Adobe Express
 * has been configured. We already have a design tool wired end to end — the
 * brand kits, the templates, the export and the import all exist — so the
 * fourth tab is that one instead. Swapping in a second design tool to match
 * Mixpost's choice literally would have meant a second set of credentials, a
 * second brand kit to keep in step, and two places to look for last week's
 * artwork.
 *
 * This is the modal's work, inline. The modal still exists for the "import a
 * batch, then carry on" flow; the tab is for the far more common one — the
 * owner is already in the library, looking for something he made this morning.
 * Importing writes into `media_items` through the existing route, so a design
 * that lands here is an ordinary library item afterwards, taggable and usable
 * everywhere, rather than a special kind of thing.
 */

interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
}

interface CanvaDesignPickerProps {
  brandId: string
  /** Called after at least one design has landed in the library. */
  onImported: () => void
}

const NOT_CONNECTED =
  'Your design tool is not connected to this desk yet, so there is nothing to show. ' +
  'Connect it from Settings and your designs appear here.'

const UNAVAILABLE =
  'Your designs could not be loaded just now. Nothing has been changed. Try again in a moment.'

export function CanvaDesignPicker({ brandId, onImported }: CanvaDesignPickerProps) {
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/canva/designs?brandId=${brandId}`)
      const data = (await res.json().catch(() => null)) as
        | { designs?: CanvaDesign[]; connected?: boolean; message?: string; error?: string }
        | null
      if (!res.ok) {
        setError(res.status === 401 || res.status === 403 ? NOT_CONNECTED : (data?.error ?? UNAVAILABLE))
        setDesigns([])
        return
      }
      if (data?.connected === false) {
        setError(NOT_CONNECTED)
        setDesigns([])
        return
      }
      setDesigns(Array.isArray(data?.designs) ? data.designs : [])
    } catch {
      setError(UNAVAILABLE)
      setDesigns([])
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { void load() }, [load])

  const handleImport = async (design: CanvaDesign) => {
    setImporting(design.id)
    setError(null)
    try {
      const res = await fetch('/api/canva/import-to-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, brandId, format: 'png' }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(
          body?.error ??
            `"${design.title}" could not be brought across just now. Nothing has been changed.`,
        )
        return
      }
      setImported((prev) => new Set(prev).add(design.id))
      onImported()
    } catch {
      setError(`"${design.title}" could not be brought across just now. Nothing has been changed.`)
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
          Your designs. Bring one across and it becomes an ordinary library item you can tag, caption and post.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-[6px] text-[12px] font-semibold disabled:opacity-50"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Check again
        </button>
      </div>

      {error ? (
        <p
          className="rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed"
          style={{
            borderColor: 'var(--warn, oklch(0.63 0.13 75))',
            background: 'var(--warn-wash, oklch(0.964 0.052 80))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-lg"
              style={{ background: 'var(--panel-2, oklch(0.975 0.004 240))' }}
            />
          ))}
        </div>
      ) : designs.length === 0 && !error ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center"
          style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
        >
          <Palette className="h-6 w-6" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
          <p className="text-[12.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            Nothing here yet. Anything you design will show up on this tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {designs.map((design) => {
            const isImported = imported.has(design.id)
            const isImporting = importing === design.id
            return (
              <button
                key={design.id}
                type="button"
                disabled={isImporting || isImported}
                onClick={() => void handleImport(design)}
                className="group relative overflow-hidden rounded-lg border text-left transition-all hover:shadow-sm disabled:cursor-default"
                style={{
                  borderColor: isImported
                    ? 'var(--ok, oklch(0.55 0.13 155))'
                    : 'var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                }}
              >
                <div
                  className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden"
                  style={{ background: 'var(--panel-2, oklch(0.975 0.004 240))' }}
                >
                  {design.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={design.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Palette className="h-5 w-5" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  {isImporting ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" style={{ color: 'var(--ink-3)' }} />
                  ) : isImported ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: 'var(--ok, oklch(0.55 0.13 155))' }} />
                  ) : null}
                  <span
                    className="truncate text-[11.5px]"
                    style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
                  >
                    {isImported ? 'In your library' : design.title || 'Untitled design'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
