'use client'

import { useState } from 'react'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'

interface ConnectAccountDialogProps {
  onClose: () => void
  onRefresh: () => void
}

const PLATFORMS: PlatformKey[] = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'threads',
  'bluesky',
  'mastodon',
]

export function ConnectAccountDialog({ onClose, onRefresh }: ConnectAccountDialogProps) {
  const { activeBrandId } = useAgencyStore()
  const [connecting, setConnecting] = useState<PlatformKey | null>(null)

  const mixpostBase =
    process.env.NEXT_PUBLIC_MIXPOST_WEB_URL ??
    'https://mixpost.notrealsmart.com.au/mixpost'
  const workspaceUuid = process.env.NEXT_PUBLIC_MIXPOST_WORKSPACE_UUID ?? ''
  const mixpostAccountsUrl = workspaceUuid
    ? `${mixpostBase}/${workspaceUuid}/accounts`
    : `${mixpostBase}/accounts`

  const handleZernioConnect = async (platform: PlatformKey) => {
    if (!activeBrandId) return
    try {
      setConnecting(platform)
      const res = await fetch(`/api/zernio/connect?platform=${platform}&brandId=${activeBrandId}`)
      if (!res.ok) {
        const err = await res.json()
        alert(`Zernio connection error: ${err.error || 'Unknown error'}`)
        setConnecting(null)
        return
      }
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (e: any) {
      alert(`Connection error: ${e.message}`)
      setConnecting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Connect a new account</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            NRS is transitioning to Zernio infrastructure for SaaS accounts. Click a platform below to authorize it directly via Zernio (Phase 1 monetization test).
          </p>

          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => {
              const colour = PLATFORM_BRAND_COLOURS[p]
              const label = PLATFORM_LABELS[p]
              const isConnecting = connecting === p
              
              return (
                <button
                  key={p}
                  disabled={!!connecting}
                  onClick={() => handleZernioConnect(p)}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:shadow-sm transition-all text-left"
                  style={{ borderLeftWidth: 3, borderLeftColor: colour }}
                >
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: colour }}
                  >
                    {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : label.charAt(0)}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                </button>
              )
            })}
          </div>

          <p className="text-[10px] text-muted-foreground pt-2">
            Need a legacy Mixpost connection? <a href={mixpostAccountsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Click here to open Mixpost</a>.
          </p>

          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onRefresh()
                onClose()
              }}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Refresh accounts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
