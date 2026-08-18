'use client'

import { ImageIcon, Images, Film, Youtube, Clock, Target, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ContentType = 'post' | 'carousel' | 'short_video' | 'long_video' | 'story' | 'ad'

interface ContentTypeDef {
  value: ContentType
  label: string
  description: string
  icon: typeof ImageIcon
}

const CONTENT_TYPES: ContentTypeDef[] = [
  { value: 'post', label: 'Post', description: 'Single image or text post', icon: ImageIcon },
  { value: 'carousel', label: 'Carousel', description: 'Multi-slide swipeable gallery (2-10 images)', icon: Images },
  { value: 'short_video', label: 'Short Video', description: 'Reels, YouTube Shorts, TikTok (9:16, under 90s)', icon: Film },
  { value: 'long_video', label: 'Long Video', description: 'YouTube, LinkedIn video (16:9, 1-60 min)', icon: Youtube },
  { value: 'story', label: 'Story', description: '24-hour ephemeral content (9:16)', icon: Clock },
  { value: 'ad', label: 'Advertisement', description: 'Paid promotion with CTA', icon: Target },
]

interface ContentTypeSectionProps {
  value: ContentType
  onChange: (type: ContentType) => void
}

export function ContentTypeSection({ value, onChange }: ContentTypeSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
        What are you creating?
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CONTENT_TYPES.map((ct) => {
          const Icon = ct.icon
          const isSelected = value === ct.value
          return (
            <button
              key={ct.value}
              type="button"
              onClick={() => onChange(ct.value)}
              className={cn(
                'relative space-y-2 rounded-lg border-2 p-4 text-left transition-all',
              )}
              style={
                isSelected
                  ? {
                      borderColor: 'var(--brand-deep, oklch(0.33 0.08 240))',
                      background: 'var(--brand-wash, oklch(0.965 0.018 240))',
                    }
                  : {
                      borderColor: 'var(--line, oklch(0.915 0.007 240))',
                      background: 'var(--panel, oklch(1 0 0))',
                    }
              }
            >
              {isSelected && (
                <span
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{
                    background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                    color: 'var(--brand-ink, oklch(1 0 0))',
                  }}
                >
                  <Check className="h-3 w-3" />
                </span>
              )}
              <Icon
                className="h-6 w-6"
                style={{
                  color: isSelected
                    ? 'var(--brand-deep, oklch(0.33 0.08 240))'
                    : 'var(--ink-3, oklch(0.615 0.011 240))',
                }}
              />
              <div>
                <p
                  className="text-sm font-medium"
                  style={{
                    color: isSelected
                      ? 'var(--brand-deep, oklch(0.33 0.08 240))'
                      : 'var(--ink, oklch(0.20 0.014 240))',
                  }}
                >
                  {ct.label}
                </p>
                <p
                  className="mt-0.5 text-[11px] leading-snug"
                  style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                >
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

export const CONTENT_TYPE_DEFS = CONTENT_TYPES
