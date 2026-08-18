'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  CalendarDays,
  Clock,
  Check,
  Pencil,
  SkipForward,
  Loader2,
  PenLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import type { PostPlatform } from '@/types/database'

const PLATFORM_NAME_MAP: Record<string, PostPlatform> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  twitter: 'twitter',
  youtube: 'youtube',
}

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  label: string
  icon: typeof Instagram
  bgClass: string
  textClass: string
  borderClass: string
}> = {
  instagram: { label: 'Instagram', icon: Instagram, bgClass: 'bg-pink-500/10', textClass: 'text-pink-400', borderClass: 'border-pink-500/20' },
  facebook: { label: 'Facebook', icon: Facebook, bgClass: 'bg-blue-500/10', textClass: 'text-blue-400', borderClass: 'border-blue-500/20' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, bgClass: 'bg-sky-500/10', textClass: 'text-sky-400', borderClass: 'border-sky-500/20' },
  twitter: { label: 'X', icon: Twitter, bgClass: 'bg-zinc-500/10', textClass: 'text-zinc-400', borderClass: 'border-zinc-500/20' },
  tiktok: { label: 'TikTok', icon: CalendarDays, bgClass: 'bg-cyan-500/10', textClass: 'text-cyan-400', borderClass: 'border-cyan-500/20' },
  youtube: { label: 'YouTube', icon: Youtube, bgClass: 'bg-red-500/10', textClass: 'text-red-400', borderClass: 'border-red-500/20' },
}

// ─── Status Badges ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-amber-500/15 text-amber-400' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/15 text-blue-400' },
  published: { label: 'Published', className: 'bg-emerald-500/15 text-emerald-400' },
  failed: { label: 'Failed', className: 'bg-red-500/15 text-red-400' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostPreviewCardProps {
  platform: string
  caption: string
  hashtags?: string[]
  hashtagsAreSuggested?: boolean
  scheduledAt?: string
  status: string
  postId?: string
  onApprove?: () => void
  onEdit?: () => void
  onSkip?: () => void
  showAddToCaption?: boolean
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PostPreviewCard({
  platform,
  caption,
  hashtags,
  hashtagsAreSuggested,
  scheduledAt,
  status,
  postId,
  onApprove,
  onEdit,
  onSkip,
  showAddToCaption,
}: PostPreviewCardProps) {
  const router = useRouter()
  const { activeBrandId } = useAgencyStore()
  const [actionState, setActionState] = useState<'idle' | 'approving' | 'approved' | 'added'>('idle')

  const handleAddToCaption = () => {
    if (!activeBrandId || !caption.trim()) return
    useComposeDeskStore.getState().setPendingCaptionApply({
      brandId: activeBrandId,
      caption: caption.trim(),
      hashtags: (hashtags ?? []).map((h) => h.replace(/^#+/, '').toLowerCase()),
      platforms: PLATFORM_NAME_MAP[platform.toLowerCase()]
        ? [PLATFORM_NAME_MAP[platform.toLowerCase()]]
        : undefined,
      hashtagsAreSuggested: true,
    })
    if (!window.location.pathname.startsWith('/agency/social')) {
      router.push('/agency/social')
    }
    setActionState('added')
  }

  const platformKey = platform.toLowerCase()
  const platformCfg = PLATFORM_CONFIG[platformKey] ?? {
    label: platform,
    icon: CalendarDays,
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  }
  const statusCfg = STATUS_CONFIG[status.toLowerCase()] ?? STATUS_CONFIG.draft

  const PlatformIcon = platformCfg.icon

  const handleApprove = () => {
    setActionState('approving')
    onApprove?.()
    // Optimistic — show approved after brief delay
    setTimeout(() => setActionState('approved'), 600)
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 my-2 max-w-md',
      platformCfg.borderClass,
      platformCfg.bgClass,
    )}>
      {/* Header: platform + status */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex items-center gap-2', platformCfg.textClass)}>
          <PlatformIcon className="h-4 w-4" />
          <span className="text-xs font-semibold">{platformCfg.label}</span>
        </div>
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusCfg.className)}>
          {statusCfg.label}
        </span>
      </div>

      {/* Caption */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {caption.length > 280 ? `${caption.slice(0, 280)}...` : caption}
      </p>

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {hashtagsAreSuggested && (
            <span className="block mb-1 text-[10px] uppercase tracking-wide opacity-80">
              Suggested tags
            </span>
          )}
          {hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
        </p>
      )}

      {/* Scheduled time */}
      {scheduledAt && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{scheduledAt}</span>
        </div>
      )}

      {/* Action buttons */}
      {(showAddToCaption || onApprove || onEdit || onSkip) && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
          {showAddToCaption && (
            <button
              type="button"
              onClick={handleAddToCaption}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: actionState === 'added' ? 'var(--brand-wash)' : 'var(--brand-deep)',
                color: actionState === 'added' ? 'var(--brand-deep)' : 'var(--brand-ink)',
              }}
            >
              {actionState === 'added' ? <Check className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
              {actionState === 'added' ? 'Added' : 'Add to caption'}
            </button>
          )}
          {onApprove && (
            <button
              onClick={handleApprove}
              disabled={actionState !== 'idle'}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors',
                actionState === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                actionState === 'approving' && 'opacity-70',
              )}
            >
              {actionState === 'approving' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : actionState === 'approved' ? (
                <Check className="h-3 w-3" />
              ) : null}
              {actionState === 'approved' ? 'Approved' : 'Approve'}
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="h-3 w-3" />
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  )
}
