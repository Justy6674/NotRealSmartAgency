'use client'

import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface InstagramMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

export function InstagramMockup({
  caption,
  hashtags,
  mediaUrl,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
}: InstagramMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame aspect={aspect}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
        {/* IG Nav bar */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.85 0 240)" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="18" cy="6" r="1.5" fill="oklch(0.85 0 240)" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.9 0 240)', letterSpacing: '-0.01em' }}>
            Instagram
          </span>
          <Send className="h-4 w-4" style={{ color: 'oklch(0.7 0 240)' }} />
        </div>

        {/* Post header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div
            className="flex-shrink-0 rounded-full"
            style={{
              width: 28,
              height: 28,
              background: brandAvatarUrl
                ? `url(${brandAvatarUrl}) center/cover`
                : 'linear-gradient(135deg, oklch(0.55 0.15 300), oklch(0.55 0.15 30))',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.9 0 240)' }}>
            {brandName.toLowerCase().replace(/\s+/g, '')}
          </span>
          <span style={{ fontSize: 16, color: 'oklch(0.5 0 240)', marginLeft: 'auto' }}>•••</span>
        </div>

        {/* Image area */}
        <div
          className="flex-shrink-0"
          style={{
            aspectRatio: '1/1',
            background: mediaUrl
              ? `url(${mediaUrl}) center/cover`
              : 'linear-gradient(135deg, oklch(0.12 0.01 240), oklch(0.08 0.005 280))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!mediaUrl && (
            <span style={{ fontSize: 11, color: 'oklch(0.35 0 240)' }}>No image</span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-4">
            <Heart className="h-5 w-5" style={{ color: 'oklch(0.85 0 240)' }} />
            <MessageCircle className="h-5 w-5" style={{ color: 'oklch(0.85 0 240)' }} />
            <Send className="h-5 w-5" style={{ color: 'oklch(0.85 0 240)' }} />
          </div>
          <Bookmark className="h-5 w-5" style={{ color: 'oklch(0.85 0 240)' }} />
        </div>

        {/* Likes */}
        <div className="px-3" style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.85 0 240)' }}>
          0 likes
        </div>

        {/* Caption */}
        <div className="flex-1 overflow-hidden px-3 py-1">
          <p style={{ fontSize: 11, color: 'oklch(0.8 0 240)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600 }}>{brandName.toLowerCase().replace(/\s+/g, '')} </span>
            <span style={{ color: 'oklch(0.65 0 240)' }}>
              {fullCaption.length > 120 ? `${fullCaption.slice(0, 120)}... ` : fullCaption}
            </span>
            {fullCaption.length > 120 && (
              <span style={{ color: 'oklch(0.4 0 240)', fontSize: 10 }}>more</span>
            )}
          </p>
        </div>

        {/* Timestamp */}
        <div className="px-3 pb-2" style={{ fontSize: 9, color: 'oklch(0.35 0 240)', textTransform: 'uppercase' }}>
          Just now
        </div>
      </div>
    </PhoneFrame>
  )
}
