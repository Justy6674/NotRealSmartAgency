'use client'

import { MessageCircle, Repeat2, Heart, MoreHorizontal } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface BlueskyMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

/**
 * Bluesky's real surface: white, with a cool-grey hairline (#d4dbe2) between
 * posts, near-black text (#0b0f14), #42576c handles, and the butterfly in
 * #0085ff. Bluesky ships a dark theme but does not default to it.
 *
 * Converted to oklch. Bluesky's colours, never `--brand`.
 */
const FEED = 'oklch(1 0 0)'
const LINE = 'oklch(0.888 0.012 248)'
const INK = 'oklch(0.167 0.012 254)'
const INK_2 = 'oklch(0.448 0.043 249)'
const BLUE = 'oklch(0.626 0.205 255)'

export function BlueskyMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
}: BlueskyMockupProps) {
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption
  const handle = brandName.toLowerCase().replace(/\s+/g, '')

  return (
    <PhoneFrame aspect={aspect} screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* Bluesky nav bar */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: `1px solid ${LINE}` }}>
          <svg width="22" height="18" viewBox="0 0 568 501" fill="none">
            <path
              d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 49.845c0 17.792-10.258 149.659-16.265 171.048-20.873 74.339-96.939 93.255-163.755 81.792C518.5 325.227 597.5 409.5 512 481c-121.488 101.625-224.5-68.547-243.5-117.543-3.242-8.352-4.755-12.258-4.5-8.906-.255-3.352 1.258.554-4.5 8.906C240.5 412.453 137.488 582.625 16 481-69.5 409.5 9.5 325.227 140.02 302.685 73.204 314.148-2.862 295.232-23.735 220.893-29.742 199.504-40 67.637-40 49.845 40-28.906 76.134-1.611 123.121 33.664Z"
              fill={BLUE}
            />
          </svg>
        </div>

        {/* Post */}
        <div className="flex gap-2 px-3 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          <div
            className="flex-shrink-0 rounded-full"
            style={{
              width: 32,
              height: 32,
              background: brandAvatarUrl
                ? `url(${brandAvatarUrl}) center/cover`
                : 'linear-gradient(135deg, oklch(0.626 0.205 255), oklch(0.72 0.15 235))',
            }}
          />
          <div className="flex-1 min-w-0">
            {/* Author line */}
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{brandName}</span>
              <span className="truncate" style={{ fontSize: 11, color: INK_2 }}>@{handle}.bsky.social</span>
            </div>

            {/* Post text */}
            <p style={{ fontSize: 12, color: INK, lineHeight: 1.5, marginTop: 4 }}>
              {fullCaption.length > 300 ? `${fullCaption.slice(0, 300)}...` : fullCaption}
            </p>

            {/* Image */}
            {displayUrl && (
              <div
                className="mt-2 overflow-hidden"
                style={{
                  aspectRatio: '16/9',
                  borderRadius: 10,
                  background: `url(${displayUrl}) center/cover`,
                  border: `1px solid ${LINE}`,
                }}
              />
            )}

            {/* Action row */}
            <div className="mt-2 flex items-center justify-between" style={{ maxWidth: 260 }}>
              {[
                { icon: MessageCircle, count: '0', label: 'Reply' },
                { icon: Repeat2, count: '0', label: 'Repost' },
                { icon: Heart, count: '0', label: 'Like' },
                { icon: MoreHorizontal, count: '', label: 'More' },
              ].map(({ icon: Icon, count }, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" style={{ color: INK_2 }} />
                  {count && <span style={{ fontSize: 10, color: INK_2 }}>{count}</span>}
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div className="mt-1.5" style={{ fontSize: 10, color: INK_2 }}>
              Just now
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
