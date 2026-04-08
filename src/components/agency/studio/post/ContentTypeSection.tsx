'use client'

import { ImageIcon, Images, Film, Youtube, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ContentType = 'post' | 'carousel' | 'short_video' | 'long_video' | 'story' | 'ad'

interface ContentTypeDef {
  value: ContentType
  label: string
  description: string
  icon: typeof ImageIcon
  colour: string
}

const CONTENT_TYPES: ContentTypeDef[] = [
  { value: 'post', label: 'Post', description: 'Single image or text post', icon: ImageIcon, colour: 'text-blue-400' },
  { value: 'carousel', label: 'Carousel', description: 'Multi-slide swipeable gallery (2-10 images)', icon: Images, colour: 'text-indigo-400' },
  { value: 'short_video', label: 'Short Video', description: 'Reels, Shorts, TikTok (9:16, under 90s)', icon: Film, colour: 'text-pink-400' },
  { value: 'long_video', label: 'Long Video', description: 'YouTube, LinkedIn video (16:9, 1-60 min)', icon: Youtube, colour: 'text-red-400' },
  { value: 'story', label: 'Story', description: '24-hour ephemeral content (9:16)', icon: Clock, colour: 'text-amber-400' },
  { value: 'ad', label: 'Advertisement', description: 'Paid promotion with CTA', icon: Target, colour: 'text-emerald-400' },
]

interface ContentTypeSectionProps {
  value: ContentType
  onChange: (type: ContentType) => void
}

export function ContentTypeSection({ value, onChange }: ContentTypeSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">What are you creating?</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CONTENT_TYPES.map(ct => {
          const Icon = ct.icon
          const isSelected = value === ct.value
          return (
            <button
              key={ct.value}
              type="button"
              onClick={() => onChange(ct.value)}
              className={cn(
                'p-4 rounded-lg border-2 transition-all text-left space-y-2',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : ct.colour)} />
              <div>
                <p className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                  {ct.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {ct.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Exports for use by other sections
export const CONTENT_TYPE_DEFS = CONTENT_TYPES
