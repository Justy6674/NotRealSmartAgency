'use client'

import type { ReactNode } from 'react'

interface ComposerLayoutProps {
  editor: ReactNode
  actionBar: ReactNode
}

/**
 * Single scrolling compose column — mockup `#p-compose`. Preview lives in the
 * column under the caption, not a competing right pane.
 */
export function ComposerLayout({ editor, actionBar }: ComposerLayoutProps) {
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg, oklch(0.985 0.002 240))' }}>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-[26px] py-[18px]"
        style={{ background: 'var(--bg, oklch(0.985 0.002 240))' }}
      >
        {editor}
      </div>

      <div
        className="shrink-0 border-t"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel, oklch(1 0 0))',
        }}
      >
        {actionBar}
      </div>
    </div>
  )
}
