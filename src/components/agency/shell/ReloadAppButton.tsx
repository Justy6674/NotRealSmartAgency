'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { hardReloadApp } from '@/lib/pwa/hard-reload'

/**
 * Always on the persistent chrome. A Dock / installed copy has no address
 * bar, so there is no other way to pick up a new deploy.
 */
export function ReloadAppButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      title="Reload the latest version"
      aria-label="Reload the latest version"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void hardReloadApp()
      }}
      className={
        className
        ?? 'flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60'
      }
    >
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
    </button>
  )
}
