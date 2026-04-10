'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Send } from 'lucide-react'
import { RichCaptionEditor } from '../post/RichCaptionEditor'

/**
 * CommentEditor — Phase 4b of the Mixpost UI port.
 *
 * Wraps RichCaptionEditor in compact mode for the comment thread on a
 * draft post. Pressing Enter (without Shift) posts the comment;
 * Shift+Enter inserts a line break. After a successful post the
 * editor clears and refocuses so the user can keep typing.
 *
 * The onSubmit callback is expected to throw on failure — the editor
 * surfaces the error inline so the user can retry without losing
 * their draft.
 */

interface CommentEditorProps {
  onSubmit: (body: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
}

export function CommentEditor({
  onSubmit,
  placeholder = 'Add a comment…',
  disabled = false,
}: CommentEditorProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Changing this key forces RichCaptionEditor to remount and clear
  // its TipTap state. Simpler than wiring a ref + imperative clear.
  const [editorKey, setEditorKey] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting || disabled) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setValue('')
      setEditorKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }, [value, submitting, disabled, onSubmit])

  // Enter-to-post shortcut. Wire it at the wrapper level so we can
  // check for the Shift modifier before TipTap handles the keydown
  // for a hard break.
  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        // Let TipTap see the Enter (for new paragraph) only if it's
        // explicitly Shift+Enter. Otherwise we preempt and submit.
        e.preventDefault()
        e.stopPropagation()
        handleSubmit()
      }
    }
    node.addEventListener('keydown', handler, true)
    return () => node.removeEventListener('keydown', handler, true)
  }, [handleSubmit])

  const canSubmit = value.trim().length > 0 && !submitting && !disabled

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur px-3 py-2">
      <div ref={wrapperRef} className="space-y-2">
        <RichCaptionEditor
          key={editorKey}
          value=""
          onChange={(plainText) => setValue(plainText)}
          placeholder={placeholder}
          compact
        />

        {error && (
          <p className="text-[11px] text-[oklch(0.65_0.2_25)]">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> to
            post, <kbd className="rounded bg-muted px-1 font-mono">Shift+Enter</kbd>{' '}
            for a new line.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Post comment
          </button>
        </div>
      </div>
    </div>
  )
}
