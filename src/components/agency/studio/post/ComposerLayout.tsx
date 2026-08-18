'use client'

import type { ReactNode } from 'react'

interface ComposerLayoutProps {
  editor: ReactNode
  preview: ReactNode
  actionBar: ReactNode
}

/**
 * Split-pane composer — editor scrolls, preview sits on the same paper family,
 * action bar pinned. Matches dept-social.html density (26px gutters).
 */
export function ComposerLayout({ editor, preview, actionBar }: ComposerLayoutProps) {
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg, oklch(0.985 0.002 240))' }}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="min-h-0 flex-1 overflow-y-auto px-[26px] py-[18px]"
          style={{ background: 'var(--bg, oklch(0.985 0.002 240))' }}
        >
          {editor}
        </div>

        <div
          className="hidden min-h-0 flex-1 overflow-y-auto border-l lg:block"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel-2, oklch(0.975 0.004 240))',
          }}
        >
          <div className="sticky top-0 px-[26px] py-[18px]">{preview}</div>
        </div>
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
