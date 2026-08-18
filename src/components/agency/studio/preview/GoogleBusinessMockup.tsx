'use client'

import { ExternalLink, ThumbsUp, MessageCircle, Share2 } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface GoogleBusinessMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

/**
 * Google Business Profile is the one frame in this folder that was already
 * light, and it stays light. What changes is that it stated its colours as raw
 * hex — `#fff`, `#4285f4`, `#202124` — which DESIGN.md forbids in new UI code.
 * The values are unchanged, converted: same product, same palette, one notation.
 *
 * The four Google logo hues are Google's, exact. They are the only place in
 * this folder where a wrong colour would be a trademark problem rather than
 * merely an ugly one, so they are named rather than inlined.
 */
const CARD = 'oklch(1 0 0)'
const LINE = 'oklch(0.907 0 0)'
const INK = 'oklch(0.248 0.006 271)'
const INK_2 = 'oklch(0.498 0.009 254)'
const BLUE = 'oklch(0.630 0.180 260)'
const GREEN = 'oklch(0.648 0.160 148)'
const YELLOW = 'oklch(0.830 0.170 84)'
const RED = 'oklch(0.626 0.206 29)'

export function GoogleBusinessMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
}: GoogleBusinessMockupProps) {
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption
  const initial = brandName.charAt(0).toUpperCase()

  return (
    <PhoneFrame aspect={aspect} screen={CARD}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: CARD }}>
        {/* Google Business header bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: `1px solid ${LINE}` }}
        >
          {/* Google G icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill={BLUE} />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={GREEN} />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill={YELLOW} />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={RED} />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Google Business</span>
        </div>

        {/* Business card header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: `1px solid ${LINE}` }}>
          <div
            className="flex-shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              background: brandAvatarUrl
                ? `url(${brandAvatarUrl}) center/cover`
                : BLUE,
              color: CARD,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {!brandAvatarUrl && initial}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{brandName}</div>
            <div style={{ fontSize: 10, color: INK_2 }}>Posted an update</div>
          </div>
        </div>

        {/* Post image */}
        {displayUrl && (
          <div
            style={{
              width: '100%',
              aspectRatio: '16/9',
              background: `url(${displayUrl}) center/cover`,
              borderBottom: `1px solid ${LINE}`,
            }}
          />
        )}

        {/* Post text */}
        <div className="px-3 py-2.5">
          <p style={{ fontSize: 12, color: INK, lineHeight: 1.55 }}>
            {fullCaption.length > 300 ? `${fullCaption.slice(0, 300)}...` : fullCaption}
          </p>
        </div>

        {/* CTA button */}
        <div className="px-3 pb-2">
          <div
            className="flex items-center justify-center gap-1 rounded-full px-3 py-1.5"
            style={{
              background: BLUE,
              color: CARD,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Learn more
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>

        {/* Action row */}
        <div
          className="flex items-center justify-around px-3 py-2"
          style={{ borderTop: `1px solid ${LINE}` }}
        >
          {[
            { icon: ThumbsUp, label: 'Like' },
            { icon: MessageCircle, label: 'Comment' },
            { icon: Share2, label: 'Share' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" style={{ color: INK_2 }} />
              <span style={{ fontSize: 10, color: INK_2 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
