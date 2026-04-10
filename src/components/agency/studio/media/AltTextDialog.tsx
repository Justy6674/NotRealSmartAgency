'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { MediaItem } from '@/types/database'

interface AltTextDialogProps {
  item: MediaItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (item: MediaItem) => void
}

const ALT_TEXT_MAX = 1000

/**
 * Read alt text from the media item — stored in `metadata.alt_text` so we
 * don't need a database migration to ship this. The same convention is used
 * by the Director's process_media tool when generating accessibility text.
 */
function readAltText(item: MediaItem | null): string {
  if (!item) return ''
  const raw = (item.metadata as { alt_text?: unknown } | null)?.alt_text
  return typeof raw === 'string' ? raw : ''
}

export function AltTextDialog({ item, open, onOpenChange, onSaved }: AltTextDialogProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Sync incoming item -> local state when the dialog opens.
  useEffect(() => {
    if (open && item) {
      setValue(readAltText(item))
      setError(null)
    }
  }, [item, open])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, alt_text: value.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save alt text')
      }
      const updated = (await res.json()) as MediaItem
      onSaved?.(updated)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alt text')
    } finally {
      setSaving(false)
    }
  }

  const handleSuggest = () => {
    if (!item) return
    setGenerating(true)
    // For now, seed from existing AI description if any. The Director's
    // generate-captions endpoint can later be wired here for live suggestions.
    const seed = item.ai_description?.trim() ?? ''
    if (seed) {
      setValue(seed.slice(0, ALT_TEXT_MAX))
    } else {
      setError('No AI description available yet — try Smart Retag from the library.')
    }
    setGenerating(false)
  }

  const remaining = ALT_TEXT_MAX - value.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit alt text</DialogTitle>
          <DialogDescription>
            Describe what&apos;s in this media for screen readers and AI search. Used on every
            platform that supports accessibility text.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="truncate font-medium text-foreground">{item.file_name}</div>
              {item.ai_description && (
                <div className="mt-1 line-clamp-2 italic">{item.ai_description}</div>
              )}
            </div>

            <div>
              <label
                htmlFor="alt-text-input"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Alt text
              </label>
              <textarea
                id="alt-text-input"
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, ALT_TEXT_MAX))}
                rows={4}
                placeholder="A short description of what is shown..."
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[oklch(0.65_0.12_240)]/40"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={generating}
                  className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Suggest from AI description
                </button>
                <span className={remaining < 50 ? 'text-amber-400' : ''}>{remaining} left</span>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !item}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Save alt text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
