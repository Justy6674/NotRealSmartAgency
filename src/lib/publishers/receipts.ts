import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

export interface PublisherRunReceipt {
  scheduled_post_id: string
  account_id: string
  platform: string
  status: string
  external_permalink: string | null
  created_at: string
}

/**
 * One line the owner can read on a post row. Never names the transport.
 * Match is on the run row (external_post_id lives there), not the network name.
 */
export function ownerReceiptLine(run: PublisherRunReceipt): string {
  const network = ownerFacingPlatformLabel(run.platform)
  if (run.status === 'success') {
    return `On ${network} · ${relativeWhen(run.created_at)}`
  }
  if (run.status === 'failed') return `Didn’t send on ${network}`
  return `Sending to ${network}`
}

function relativeWhen(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return 'just now'
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
