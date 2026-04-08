'use client'

import { useState } from 'react'
import { X, Plus, Sparkles, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { HashtagGroupPicker } from '../hashtags/HashtagGroupPicker'
import { PLATFORM_CHAR_LIMITS } from '@/lib/post-versions'
import type { PostPlatform } from '@/types/database'

const PLATFORM_HASHTAG_LIMITS: Record<string, number> = {
  instagram: 30,
  facebook: 30,
  linkedin: 5,
  twitter: 3,
  tiktok: 5,
  youtube: 15,
}

interface HashtagSectionProps {
  brandId: string
  hashtags: string[]
  onChange: (hashtags: string[]) => void
  selectedPlatforms: PostPlatform[]
  caption?: string
}

export function HashtagSection({ brandId, hashtags, onChange, selectedPlatforms, caption }: HashtagSectionProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (tag: string) => {
    const cleaned = tag.replace(/^#/, '').trim().toLowerCase()
    if (cleaned && !hashtags.includes(cleaned)) {
      onChange([...hashtags, cleaned])
    }
  }

  const removeTag = (tag: string) => {
    onChange(hashtags.filter(h => h !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
      setInputValue('')
    }
  }

  const handleAiSuggest = () => {
    const prompt = caption
      ? `Suggest 10 relevant hashtags for this post: "${caption.slice(0, 200)}". Return just the hashtags.`
      : 'Suggest 10 trending, relevant hashtags for my brand. Return just the hashtags.'
    sendToDirector(prompt)
  }

  const handleGroupInsert = (tags: string[]) => {
    const newTags = tags.filter(t => !hashtags.includes(t.replace(/^#/, '').toLowerCase()))
    onChange([...hashtags, ...newTags.map(t => t.replace(/^#/, '').toLowerCase())])
  }

  // Platform with tightest limit
  const tightestLimit = selectedPlatforms.reduce((min, p) => {
    const limit = PLATFORM_HASHTAG_LIMITS[p]
    return limit != null && limit < min ? limit : min
  }, 30)

  const isOverLimit = hashtags.length > tightestLimit

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Hashtags</h3>
        <span className={cn('text-xs', isOverLimit ? 'text-red-400' : 'text-muted-foreground')}>
          {hashtags.length} / {tightestLimit}
        </span>
      </div>

      {/* Current tags as pills */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              #{tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type and press Enter..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={handleAiSuggest}
          className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggest
        </button>
        <HashtagGroupPicker brandId={brandId} onInsert={handleGroupInsert} />
      </div>

      {/* Platform limits info */}
      {selectedPlatforms.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {selectedPlatforms.map(p => (
            <span key={p} className={cn('text-[10px]', hashtags.length > (PLATFORM_HASHTAG_LIMITS[p] ?? 30) ? 'text-red-400' : 'text-muted-foreground')}>
              {p}: {hashtags.length}/{PLATFORM_HASHTAG_LIMITS[p] ?? 30}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
