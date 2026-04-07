'use client'

import { Image, Images, Film, Video } from 'lucide-react'
import type { PostType } from '@/types/database'

interface PostTypeSelectorProps {
  value: PostType
  onChange: (type: PostType) => void
  mediaCount: number
}

const POST_TYPES: { value: PostType; label: string; icon: typeof Image; hint: string }[] = [
  { value: 'single', label: 'Single', icon: Image, hint: '0-1 image' },
  { value: 'carousel', label: 'Carousel', icon: Images, hint: '2-10 images' },
  { value: 'reel', label: 'Reel', icon: Film, hint: 'Short video' },
  { value: 'video', label: 'Video', icon: Video, hint: 'Long video' },
]

export function PostTypeSelector({ value, onChange, mediaCount }: PostTypeSelectorProps) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">
        Post type
      </label>
      <div className="flex gap-1.5">
        {POST_TYPES.map((type) => {
          const Icon = type.icon
          const active = value === type.value
          const invalid =
            type.value === 'carousel' && mediaCount > 0 && mediaCount < 2

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              title={type.hint}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)]'
                  : 'bg-[oklch(0.18_0.01_240)] text-muted-foreground hover:bg-[oklch(0.24_0.02_240)]'
              } ${invalid ? 'ring-1 ring-[oklch(0.6_0.15_30)]' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {type.label}
            </button>
          )
        })}
      </div>
      {value === 'carousel' && mediaCount > 0 && mediaCount < 2 && (
        <p className="text-[10px] text-[oklch(0.65_0.12_30)] mt-1.5">
          Carousel needs at least 2 images
        </p>
      )}
    </div>
  )
}
