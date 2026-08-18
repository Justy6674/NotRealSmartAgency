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

/**
 * Alt text, with the ceiling the platforms actually enforce.
 *
 * The limit here was a flat 1000 for everything. Pinterest cuts at 500, so a
 * 700-character description written in this box saved cleanly, looked right on
 * every screen, and was truncated mid-sentence on the one platform where the
 * description is doing the most work. The counter now warns from the SHORTEST
 * limit among the platforms that read alt text, and states which one that is,
 * so the number in the corner means something.
 *
 * Where alt text is used at all, measured against the publisher's own field
 * documentation rather than recalled: Instagram FEED images (not Reels, not
 * Stories), Facebook, Threads, X (1000), LinkedIn, Bluesky, and Pinterest
 * (500). Everywhere else it is accepted and ignored. Saying that plainly is
 * the difference between the owner writing alt text once and writing it
 * carefully.
 */

/** The tightest ceiling among the platforms that read this field. */
const ALT_TEXT_TIGHTEST = 500
const ALT_TEXT_TIGHTEST_ON = 'Pinterest'
/** The loosest, and therefore the hard stop on the input. */
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
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'That description could not be saved just now. Nothing has been changed.',
        )
      }
      const updated = (await res.json()) as MediaItem
      onSaved?.(updated)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'That description could not be saved just now. Nothing has been changed.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSuggest = () => {
    if (!item) return
    setGenerating(true)
    // Seeded from the description already worked out for this file. The
    // Director's caption endpoint can be wired here later for a live pass.
    const seed = item.ai_description?.trim() ?? ''
    if (seed) {
      setValue(seed.slice(0, ALT_TEXT_MAX))
    } else {
      setError('Nothing has been worked out about this file yet — run Smart retag from the library first.')
    }
    setGenerating(false)
  }

  const overTightest = value.length > ALT_TEXT_TIGHTEST
  const remaining = ALT_TEXT_MAX - value.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Describe this picture</DialogTitle>
          <DialogDescription>
            What someone would need told if they could not see it. Screen readers read it aloud, and
            search engines read it too.
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
                Description
              </label>
              <textarea
                id="alt-text-input"
                value={value}
                onChange={(e) => setValue(e.target.value.slice(0, ALT_TEXT_MAX))}
                rows={4}
                placeholder="A short description of what is shown…"
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
                  Start from what we know about this file
                </button>
                <span
                  className="tabular-nums"
                  style={overTightest ? { color: 'var(--warn, oklch(0.63 0.13 75))' } : undefined}
                >
                  {remaining} left
                </span>
              </div>
            </div>

            {/* Stated rather than left to be discovered at publish time. */}
            {overTightest ? (
              <p
                className="rounded-md border px-3 py-2 text-[11.5px] leading-relaxed"
                style={{
                  borderColor: 'var(--warn, oklch(0.63 0.13 75))',
                  background: 'var(--warn-wash, oklch(0.964 0.052 80))',
                  color: 'var(--ink, oklch(0.20 0.014 240))',
                }}
              >
                Over {ALT_TEXT_TIGHTEST} characters, {ALT_TEXT_TIGHTEST_ON} cuts the rest off. Put the
                important part first, or trim it back.
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Used on Instagram feed posts, Facebook, Threads, X, LinkedIn, Bluesky and Pinterest.
                Reels and Stories do not carry a description, so it is quietly ignored there.
              </p>
            )}

            {error && (
              <p
                className="rounded-md border px-3 py-2 text-xs"
                style={{
                  borderColor: 'oklch(0.55 0.17 27 / 0.3)',
                  background: 'oklch(0.55 0.17 27 / 0.07)',
                  color: 'var(--ink, oklch(0.20 0.014 240))',
                }}
              >
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
            Save description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
