'use client'

import type { ReactNode } from 'react'

interface ComposerLayoutProps {
  editor: ReactNode
  preview: ReactNode
  actionBar: ReactNode
}

/**
 * Professional split-pane composer layout.
 * Left: editor (scrollable). Right: preview (sticky). Bottom: action bar (sticky).
 * Stacks vertically on mobile.
 */
export function ComposerLayout({ editor, preview, actionBar }: ComposerLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Editor pane (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {editor}
        </div>

        {/* Right — Preview pane (sticky, hidden on mobile) */}
        <div
          className="hidden lg:block flex-1 overflow-y-auto border-l border-border bg-muted/50"
        >
          <div className="sticky top-0 p-4 lg:p-6">
            {preview}
          </div>
        </div>
      </div>

      {/* Bottom — Action bar (sticky) */}
      <div
        className="flex-shrink-0 border-t border-border px-4 py-3 lg:px-6 bg-card/95 backdrop-blur-sm"
      >
        {actionBar}
      </div>
    </div>
  )
}
