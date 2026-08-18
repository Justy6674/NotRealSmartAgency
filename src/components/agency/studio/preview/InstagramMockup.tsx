'use client'

import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface InstagramMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

/**
 * Instagram's real surface: a white feed, near-black text (#262626), #8e8e8e
 * secondary, and hairlines at #dbdbdb that are the only structure in the whole
 * screen. Converted to oklch; these are Instagram's colours, never `--brand`.
 *
 * This file used to set NO background at all, so it was transparent and took
 * whatever PhoneFrame painted — which was near-black. It rendered dark by
 * omission rather than by decision, and that is the more dangerous half of the
 * bug: nothing in this file was wrong to read, so nothing here looked wrong.
 * The ground is now stated out loud, twice: once as the screen PhoneFrame
 * paints, once on the column that fills it.
 */
const FEED = 'oklch(1 0 0)'
const LINE = 'oklch(0.891 0 0)'
const INK = 'oklch(0.269 0 0)'
const INK_2 = 'oklch(0.647 0 0)'
const PLACEHOLDER = 'oklch(0.985 0 0)'
const BLUE = 'oklch(0.655 0.177 248)'

export function InstagramMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
}: InstagramMockupProps) {
  const isCarousel = mediaUrls && mediaUrls.length > 1
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame aspect={aspect} screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* IG Nav bar */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${LINE}` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="18" cy="6" r="1.5" fill={INK} />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>
            Instagram
          </span>
          <Send className="h-4 w-4" style={{ color: INK }} />
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
                : 'linear-gradient(135deg, oklch(0.62 0.20 320), oklch(0.70 0.17 55))',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>
            {brandName.toLowerCase().replace(/\s+/g, '')}
          </span>
          <span style={{ fontSize: 16, color: INK, marginLeft: 'auto' }}>•••</span>
        </div>

        {/* Image area */}
        <div
          className="flex-shrink-0 relative"
          style={{
            aspectRatio: '1/1',
            background: displayUrl ? `url(${displayUrl}) center/cover` : PLACEHOLDER,
            borderTop: `1px solid ${LINE}`,
            borderBottom: `1px solid ${LINE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!displayUrl && (
            <span style={{ fontSize: 11, color: INK_2 }}>No image</span>
          )}
          {/* Carousel dots */}
          {isCarousel && (
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4,
            }}>
              {mediaUrls.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === 0 ? 6 : 5,
                    height: i === 0 ? 6 : 5,
                    borderRadius: '50%',
                    background: i === 0 ? BLUE : 'oklch(0.891 0 0)',
                    opacity: i === 0 ? 1 : 0.9,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-4">
            <Heart className="h-5 w-5" style={{ color: INK }} />
            <MessageCircle className="h-5 w-5" style={{ color: INK }} />
            <Send className="h-5 w-5" style={{ color: INK }} />
          </div>
          <Bookmark className="h-5 w-5" style={{ color: INK }} />
        </div>

        {/* Likes */}
        <div className="px-3" style={{ fontSize: 11, fontWeight: 600, color: INK }}>
          0 likes
        </div>

        {/* Caption */}
        <div className="flex-1 overflow-hidden px-3 py-1">
          <p style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 600 }}>{brandName.toLowerCase().replace(/\s+/g, '')} </span>
            <span>
              {fullCaption.length > 120 ? `${fullCaption.slice(0, 120)}... ` : fullCaption}
            </span>
            {fullCaption.length > 120 && (
              <span style={{ color: INK_2, fontSize: 10 }}>more</span>
            )}
          </p>
        </div>

        {/* Timestamp */}
        <div className="px-3 pb-2" style={{ fontSize: 9, color: INK_2, textTransform: 'uppercase' }}>
          Just now
        </div>
      </div>
    </PhoneFrame>
  )
}
