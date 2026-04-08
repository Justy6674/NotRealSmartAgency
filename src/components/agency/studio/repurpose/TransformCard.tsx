'use client'

import { useState, useCallback } from 'react'
import {
  Instagram, Facebook, Linkedin, Twitter, Music2, Youtube, Mail, BookOpen,
  Loader2, Check, PenLine, Calendar, X,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export type TransformPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube' | 'email' | 'blog'

export type TransformStatus = 'pending' | 'generating' | 'done'

const PLATFORM_META: Record<TransformPlatform, { label: string; maxChars: number; icon: ComponentType<LucideProps>; colour: string }> = {
  instagram:  { label: 'Instagram Caption',   maxChars: 2200,  icon: Instagram, colour: 'oklch(0.65_0.15_330)' },
  facebook:   { label: 'Facebook Post',       maxChars: 63206, icon: Facebook,  colour: 'oklch(0.55_0.12_250)' },
  linkedin:   { label: 'LinkedIn Article',    maxChars: 3000,  icon: Linkedin,  colour: 'oklch(0.55_0.10_240)' },
  twitter:    { label: 'X Thread',            maxChars: 280,   icon: Twitter,   colour: 'oklch(0.70_0.02_240)' },
  tiktok:     { label: 'TikTok Script',       maxChars: 2200,  icon: Music2,    colour: 'oklch(0.70_0.12_340)' },
  youtube:    { label: 'YouTube Description', maxChars: 5000,  icon: Youtube,   colour: 'oklch(0.60_0.18_25)'  },
  email:      { label: 'Email Snippet',       maxChars: 10000, icon: Mail,      colour: 'oklch(0.65_0.08_160)' },
  blog:       { label: 'Blog Post',           maxChars: 50000, icon: BookOpen,  colour: 'oklch(0.65_0.08_60)'  },
}

export { PLATFORM_META }

interface TransformCardProps {
  platform: TransformPlatform
  content: string
  status: TransformStatus
  onSchedule: (platform: TransformPlatform, content: string) => void
  onEdit: (platform: TransformPlatform, content: string) => void
}

export function TransformCard({ platform, content, status, onSchedule, onEdit }: TransformCardProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const charCount = content.length
  const over = charCount > meta.maxChars

  const handleSaveEdit = useCallback(() => {
    onEdit(platform, editContent)
    setEditing(false)
  }, [platform, editContent, onEdit])

  const handleCancelEdit = useCallback(() => {
    setEditContent(content)
    setEditing(false)
  }, [content])

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${meta.colour}` }}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">{meta.label}</span>

        {/* Status badge */}
        {status === 'generating' && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating
          </div>
        )}
        {status === 'done' && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Check className="h-3 w-3" />
            Done
          </div>
        )}
        {status === 'pending' && (
          <span className="text-[10px] text-muted-foreground/50">Pending</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3">
        {status === 'pending' && !content && (
          <p className="text-xs text-muted-foreground/40 italic">
            Click &ldquo;Generate All&rdquo; to create this variant
          </p>
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-[family-name:var(--font-ibm-plex-sans)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary/80 transition-colors"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          content && (
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-8 font-[family-name:var(--font-ibm-plex-sans)]">
              {content}
            </p>
          )
        )}
      </div>

      {/* Footer */}
      {(status === 'done' || content) && !editing && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
            {charCount.toLocaleString()} / {meta.maxChars.toLocaleString()}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setEditContent(content); setEditing(true) }}
              className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary/80 transition-colors"
            >
              <PenLine className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onSchedule(platform, content)}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
