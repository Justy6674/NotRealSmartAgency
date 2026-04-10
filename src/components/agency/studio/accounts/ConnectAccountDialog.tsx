'use client'

import { X, ExternalLink } from 'lucide-react'
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

/**
 * "Connect new account" dialog on the Accounts management page.
 *
 * Each platform button links to its own NRS OAuth initiate endpoint
 * (`/api/oauth/{platform}/initiate`). The endpoint redirects the user
 * to the platform's consent screen. On callback, the account is saved
 * and the user returns here to click Refresh.
 *
 * Platforms without an NRS OAuth route (pinterest, threads, bluesky,
 * mastodon) fall back to the Mixpost admin accounts page.
 */

/** Platforms that have `/api/oauth/{key}/initiate` routes in NRS */
const OAUTH_PLATFORMS = new Set<PlatformKey>([
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
])

/** Meta platforms share the same OAuth initiate (Meta Graph API) */
function getOAuthPlatformKey(p: PlatformKey): string {
  if (p === 'instagram') return 'meta'
  if (p === 'facebook') return 'meta'
  return p
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

  const mixpostBase =
    process.env.NEXT_PUBLIC_MIXPOST_WEB_URL ??
    'https://mixpost.notrealsmart.com.au/mixpost'
  const workspaceUuid = process.env.NEXT_PUBLIC_MIXPOST_WORKSPACE_UUID ?? ''
  const mixpostAccountsUrl = workspaceUuid
    ? `${mixpostBase}/${workspaceUuid}/accounts`
    : `${mixpostBase}/accounts`

  function getConnectUrl(platform: PlatformKey): string {
    if (OAUTH_PLATFORMS.has(platform)) {
      const key = getOAuthPlatformKey(platform)
      const params = new URLSearchParams()
      if (activeBrandId) params.set('brandId', activeBrandId)
      params.set('platform', platform)
      return `/api/oauth/${key}/initiate?${params.toString()}`
    }
    // Fallback to Mixpost admin for platforms without NRS OAuth
    return mixpostAccountsUrl
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
            Pick the platform you want to connect. The OAuth flow happens in a secure popup — once you&apos;re done, click <strong>Refresh</strong> below and your new account will appear on this page.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => {
              const colour = PLATFORM_BRAND_COLOURS[p]
              const label = PLATFORM_LABELS[p]
              const hasOAuth = OAUTH_PLATFORMS.has(p)
              return (
                <a
                  key={p}
                  href={getConnectUrl(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:shadow-sm transition-all"
                  style={{ borderLeftWidth: 3, borderLeftColor: colour }}
                >
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: colour }}
                  >
                    {label.charAt(0)}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {hasOAuth ? (
                    <span className="text-[9px] text-emerald-500 shrink-0">Direct</span>
                  ) : (
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </a>
              )
            })}
          </div>

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
