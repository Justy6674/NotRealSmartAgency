'use client'

import { Save, Loader2, Check, AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'

// Platform colour dots
const PLATFORM_COLOURS: Record<PostPlatform, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
  linkedin: 'bg-sky-400',
  twitter: 'bg-zinc-400',
}

interface CreatorActionBarProps {
  platforms: PostPlatform[]
  captionEmpty: boolean
  compliancePassed: boolean | null
  saving: boolean
  onSave: (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => void
}

/**
 * Scent Sell-style sticky bottom action bar.
 * Save Draft only — publishing moves to Schedule room after Review.
 * Create → Review → Schedule pipeline.
 */
export function CreatorActionBar({
  platforms,
  captionEmpty,
  compliancePassed,
  saving,
  onSave,
}: CreatorActionBarProps) {
  const disabled = saving || captionEmpty

  return (
    <div className="space-y-2">
      {/* Main bar */}
      <div className="flex items-center gap-3">
        {/* Left: platform dots + compliance */}
        <div className="flex items-center gap-2 shrink-0">
          {platforms.length > 0 && (
            <div className="flex items-center gap-1">
              {platforms.map(p => (
                <span key={p} className={cn('h-2 w-2 rounded-full', PLATFORM_COLOURS[p])} title={p} />
              ))}
            </div>
          )}
          {compliancePassed === true && (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {compliancePassed === false && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex gap-2 flex-1 justify-end">
          {/* Save Draft → goes to Review */}
          <button
            type="button"
            onClick={() => onSave('draft')}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colours disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
            <ArrowRight className="h-3.5 w-3.5 ml-1 opacity-60" />
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Saved drafts go to <strong>Review</strong> for approval, then <strong>Schedule</strong> for publishing.
        </p>
        {compliancePassed === false && (
          <span className="text-[10px] text-red-400 font-medium">Compliance issues detected</span>
        )}
      </div>
    </div>
  )
}
