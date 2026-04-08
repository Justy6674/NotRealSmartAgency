'use client'

import { Instagram, Facebook, Linkedin, Twitter, Youtube, Music2, Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentType } from './ContentTypeSection'
import type { PostPlatform } from '@/types/database'

interface PlatformDef {
  value: PostPlatform
  label: string
  icon: LucideIcon
  colour: string
  selectedBg: string
  charLimit: number
  formats: string
  compatibleTypes: ContentType[]
}

const PLATFORMS: PlatformDef[] = [
  {
    value: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    colour: 'text-pink-400',
    selectedBg: 'border-pink-400 bg-pink-400/10',
    charLimit: 2200,
    formats: '1:1, 4:5, 9:16',
    compatibleTypes: ['post', 'carousel', 'short_video', 'story', 'ad'],
  },
  {
    value: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    colour: 'text-blue-400',
    selectedBg: 'border-blue-400 bg-blue-400/10',
    charLimit: 63206,
    formats: '1:1, 16:9, 9:16',
    compatibleTypes: ['post', 'carousel', 'short_video', 'long_video', 'story', 'ad'],
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    icon: Music2,
    colour: 'text-cyan-400',
    selectedBg: 'border-cyan-400 bg-cyan-400/10',
    charLimit: 2200,
    formats: '9:16',
    compatibleTypes: ['post', 'short_video', 'ad'],
  },
  {
    value: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    colour: 'text-red-400',
    selectedBg: 'border-red-400 bg-red-400/10',
    charLimit: 5000,
    formats: '16:9, 9:16 (Shorts)',
    compatibleTypes: ['short_video', 'long_video', 'ad'],
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    colour: 'text-sky-400',
    selectedBg: 'border-sky-400 bg-sky-400/10',
    charLimit: 3000,
    formats: '1:1, 16:9',
    compatibleTypes: ['post', 'carousel', 'long_video', 'ad'],
  },
  {
    value: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
    colour: 'text-zinc-400',
    selectedBg: 'border-zinc-400 bg-zinc-400/10',
    charLimit: 280,
    formats: '16:9, 1:1',
    compatibleTypes: ['post', 'short_video', 'ad'],
  },
]

interface PlatformSectionProps {
  contentType: ContentType
  selected: PostPlatform[]
  onChange: (platforms: PostPlatform[]) => void
}

export function PlatformSection({ contentType, selected, onChange }: PlatformSectionProps) {
  const togglePlatform = (platform: PostPlatform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform))
    } else {
      onChange([...selected, platform])
    }
  }

  // Build summary line for selected platforms
  const selectedDefs = PLATFORMS.filter(p => selected.includes(p.value))

  return (
    <div className="space-y-3">
      {/* Pill row */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map(p => {
          const Icon = p.icon
          const isCompatible = p.compatibleTypes.includes(contentType)
          const isSelected = selected.includes(p.value)
          return (
            <button
              key={p.value}
              type="button"
              disabled={!isCompatible}
              onClick={() => togglePlatform(p.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition-all',
                !isCompatible && 'opacity-25 cursor-not-allowed border-border text-muted-foreground',
                isCompatible && !isSelected && 'border-border text-foreground/80 hover:border-primary/50',
                isCompatible && isSelected && p.selectedBg,
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-foreground' : p.colour)} />
              {p.label}
              {isSelected && <Check className="h-3 w-3 text-foreground ml-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Summary line for selected platforms */}
      {selectedDefs.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {selectedDefs.map((p, i) => (
            <span key={p.value}>
              {i > 0 && ' + '}
              <span className="font-medium text-foreground/70">{p.label}</span>
              {' '}({p.charLimit.toLocaleString()} chars, {p.formats})
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export { PLATFORMS }
