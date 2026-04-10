'use client'

import { useState } from 'react'
import { Smile } from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void
  /** Optional label override for the trigger button */
  triggerLabel?: string
}

/**
 * Emoji picker launcher for the composer.
 *
 * Phase 3 of the Mixpost UI port. Wraps @emoji-mart/react in a
 * lightweight popover — uses NRS-native positioning (absolute +
 * backdrop click-out) rather than base-ui Popover so the emoji picker
 * keeps its own scroll/keyboard behaviour unaltered.
 *
 * Mixpost uses the same emoji-mart library via EmojiMart.vue — we use
 * the React version (cross-framework library, same UX).
 */
export function EmojiPickerPopover({ onSelect, triggerLabel }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Insert emoji"
      >
        <Smile className="h-3.5 w-3.5" />
        {triggerLabel && <span>{triggerLabel}</span>}
      </button>

      {open && (
        <>
          {/* Backdrop — click-out to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full mt-2 z-50 shadow-2xl rounded-lg overflow-hidden">
            <Picker
              data={data}
              onEmojiSelect={(e: { native?: string }) => {
                if (e?.native) onSelect(e.native)
                setOpen(false)
              }}
              theme="auto"
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={2}
            />
          </div>
        </>
      )}
    </div>
  )
}
