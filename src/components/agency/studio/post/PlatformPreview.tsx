'use client'

import { Instagram, Facebook, Linkedin, Twitter, Music2, Youtube } from 'lucide-react'
import type { PostPlatform } from '@/types/database'
import { PLATFORM_LIMITS } from './PostEditor'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

const PLATFORM_ICONS: Record<string, ComponentType<LucideProps>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: Music2,
  youtube: Youtube,
}

interface PlatformPreviewProps {
  content: string
  hashtags: string
  selectedPlatforms: PostPlatform[]
  brandName?: string
}

function InstagramPreview({ content, hashtags, brandName }: { content: string; hashtags: string; brandName: string }) {
  const fullText = `${content}${hashtags ? `\n\n${hashtags}` : ''}`
  const info = PLATFORM_LIMITS.instagram
  const charCount = fullText.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-muted overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[oklch(0.65_0.15_330)] to-[oklch(0.65_0.15_30)] flex items-center justify-center text-[10px] font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-foreground">{brandName}</span>
      </div>
      {/* Image placeholder */}
      <div className="aspect-square bg-secondary flex items-center justify-center">
        <Instagram className="h-8 w-8 text-muted-foreground/30" />
      </div>
      {/* Caption */}
      <div className="px-3 py-2.5">
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-wrap font-[family-name:var(--font-ibm-plex-sans)]">
          <span className="font-semibold text-foreground">{brandName}</span>{' '}
          {content || 'Your caption will appear here...'}
        </p>
        {hashtags && (
          <p className="text-xs text-[oklch(0.6_0.1_240)] mt-1">{hashtags}</p>
        )}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border">
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function LinkedInPreview({ content, brandName }: { content: string; brandName: string }) {
  const info = PLATFORM_LIMITS.linkedin
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-muted overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="h-10 w-10 rounded-full bg-[oklch(0.45_0.1_240)] flex items-center justify-center text-xs font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground block">{brandName}</span>
          <span className="text-[10px] text-muted-foreground">Just now</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || 'Your LinkedIn post will appear here...'}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Like</span>
          <span>Comment</span>
          <span>Repost</span>
          <span>Send</span>
        </div>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function XPreview({ content, brandName }: { content: string; brandName: string }) {
  const info = PLATFORM_LIMITS.twitter
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-muted overflow-hidden">
      <div className="flex gap-2.5 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-[oklch(0.30_0.02_240)] flex items-center justify-center text-xs font-bold text-foreground shrink-0">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">{brandName}</span>
            <span className="text-[10px] text-muted-foreground">@{brandName.toLowerCase().replace(/\s/g, '')} &middot; now</span>
          </div>
          <p className={`text-xs leading-relaxed mt-1 whitespace-pre-wrap font-[family-name:var(--font-ibm-plex-sans)] ${over ? 'text-red-400' : 'text-foreground/80'}`}>
            {content || 'Your tweet will appear here...'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-6 text-[10px] text-muted-foreground">
          <span>Reply</span>
          <span>Repost</span>
          <span>Like</span>
          <span>Views</span>
        </div>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount} / {info.maxChars}
        </span>
      </div>
    </div>
  )
}

function FacebookPreview({ content, hashtags, brandName }: { content: string; hashtags: string; brandName: string }) {
  const fullText = `${content}${hashtags ? `\n\n${hashtags}` : ''}`
  const info = PLATFORM_LIMITS.facebook
  const charCount = fullText.length

  return (
    <div className="rounded-xl border border-border bg-muted overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="h-9 w-9 rounded-full bg-[oklch(0.4_0.12_250)] flex items-center justify-center text-xs font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground block">{brandName}</span>
          <span className="text-[10px] text-muted-foreground">Just now &middot; Public</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-5 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || 'Your Facebook post will appear here...'}
        </p>
        {hashtags && (
          <p className="text-xs text-[oklch(0.6_0.1_240)] mt-1">{hashtags}</p>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function GenericPreview({ content, platform, brandName }: { content: string; platform: PostPlatform; brandName: string }) {
  const info = PLATFORM_LIMITS[platform]
  const Icon = PLATFORM_ICONS[platform] ?? Music2
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-muted overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{info.label}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-4 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || `Your ${info.label} post will appear here...`}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">{brandName}</span>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export function PlatformPreview({ content, hashtags, selectedPlatforms, brandName = 'Brand' }: PlatformPreviewProps) {
  if (selectedPlatforms.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select platforms to see previews
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Platform Previews
      </h3>
      <div className="grid gap-4">
        {selectedPlatforms.map(platform => {
          switch (platform) {
            case 'instagram':
              return <InstagramPreview key={platform} content={content} hashtags={hashtags} brandName={brandName} />
            case 'linkedin':
              return <LinkedInPreview key={platform} content={content} brandName={brandName} />
            case 'twitter':
              return <XPreview key={platform} content={content} brandName={brandName} />
            case 'facebook':
              return <FacebookPreview key={platform} content={content} hashtags={hashtags} brandName={brandName} />
            default:
              return <GenericPreview key={platform} content={content} platform={platform} brandName={brandName} />
          }
        })}
      </div>
    </div>
  )
}
