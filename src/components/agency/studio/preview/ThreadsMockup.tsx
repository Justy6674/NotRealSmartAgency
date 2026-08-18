'use client'

import { MessageCircle, Repeat2, Heart, Send } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface ThreadsMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

/**
 * Threads' real surface: white, black logo and text, #999999 secondary,
 * #dbdbdb hairlines — the Instagram palette, which is the point of it.
 *
 * Threads ships a dark theme and follows the system setting, so a dark frame is
 * not a lie for every reader. It is the wrong DEFAULT, though: a preview exists
 * to tell the owner whether his post looks right, and it should answer for the
 * common case rather than the one that happens to match the desk this was built
 * on in April. Same reasoning as Instagram, Facebook and Bluesky above.
 */
const FEED = 'oklch(1 0 0)'
const LINE = 'oklch(0.891 0 0)'
const INK = 'oklch(0.15 0 0)'
const INK_2 = 'oklch(0.683 0 0)'
const THREAD = 'oklch(0.907 0 0)'

export function ThreadsMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
}: ThreadsMockupProps) {
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption
  const handle = brandName.toLowerCase().replace(/\s+/g, '')

  return (
    <PhoneFrame aspect={aspect} screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* Threads nav bar */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: `1px solid ${LINE}` }}>
          <svg width="18" height="20" viewBox="0 0 192 226" fill="none">
            <path
              d="M141.537 88.988a66.186 66.186 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.398c-15.09 0-27.545 6.48-35.109 18.26l13.671 9.353c5.625-8.502 14.418-10.324 21.438-10.324h.249c8.287.05 14.541 2.46 18.592 7.164 2.953 3.433 4.935 8.178 5.928 14.177a93.38 93.38 0 0 0-24.779-2.588c-27.095 0-44.534 14.478-44.04 36.529.249 11.103 5.51 20.676 14.808 26.943 7.856 5.3 17.984 7.957 28.531 7.485 13.906-.625 24.796-5.706 32.394-15.108 5.769-7.143 9.407-16.404 10.928-27.895 6.55 3.95 11.42 9.166 14.177 15.607 4.608 10.754 4.877 28.424-4.273 37.574-8.053 8.053-17.736 11.539-34.47 11.673-18.558-.149-32.595-6.09-41.72-17.64-8.503-10.753-12.914-26.012-13.114-45.35.2-19.338 4.611-34.597 13.115-45.35 9.124-11.55 23.161-17.492 41.719-17.64 18.703.149 32.967 6.135 42.37 17.791 4.646 5.762 8.136 12.853 10.453 21.18l15.527-4.127c-2.8-10.12-7.285-18.86-13.432-26.14C155.439 18.756 138.054 11.442 116.046 11.26h-.248c-21.86.175-39.015 7.49-50.975 21.744C54.588 45.327 49.263 63.477 49.02 85.08c.244 21.603 5.568 39.753 15.803 52.076 11.96 14.254 29.115 21.569 50.975 21.744h.248c19.753-.148 32.683-4.863 43.073-15.253 13.743-13.743 13.339-37.572 7.24-51.823-4.367-10.2-12.63-18.41-24.822-24.036ZM100.98 141.61c-11.662 0-24.209-5.138-24.498-17.2-.211-8.796 6.27-18.607 28.556-18.607 2.34 0 4.63.106 6.865.314a78.794 78.794 0 0 1 6.136.689c-1.713 23.375-9.502 34.804-17.059 34.804Z"
              fill={INK}
            />
          </svg>
        </div>

        {/* Post */}
        <div className="flex gap-2.5 px-3 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          {/* Avatar + thread line */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex-shrink-0 rounded-full"
              style={{
                width: 32,
                height: 32,
                background: brandAvatarUrl
                  ? `url(${brandAvatarUrl}) center/cover`
                  : 'linear-gradient(135deg, oklch(0.891 0 0), oklch(0.78 0 0))',
              }}
            />
            <div
              className="flex-1"
              style={{
                width: 2,
                minHeight: 8,
                background: THREAD,
                borderRadius: 1,
              }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Author line */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{handle}</span>
                <span style={{ fontSize: 11, color: INK_2 }}>now</span>
              </div>
              <span style={{ fontSize: 14, color: INK_2 }}>...</span>
            </div>

            {/* Post text */}
            <p style={{ fontSize: 12, color: INK, lineHeight: 1.5, marginTop: 3 }}>
              {fullCaption.length > 500 ? `${fullCaption.slice(0, 500)}...` : fullCaption}
            </p>

            {/* Image */}
            {displayUrl && (
              <div
                className="mt-2 overflow-hidden"
                style={{
                  aspectRatio: '1/1',
                  borderRadius: 10,
                  background: `url(${displayUrl}) center/cover`,
                  border: `1px solid ${LINE}`,
                }}
              />
            )}

            {/* Action row */}
            <div className="mt-2.5 flex items-center gap-5">
              {[
                { icon: Heart },
                { icon: MessageCircle },
                { icon: Repeat2 },
                { icon: Send },
              ].map(({ icon: Icon }, i) => (
                <Icon
                  key={i}
                  className="h-4 w-4"
                  style={{ color: INK }}
                />
              ))}
            </div>

            {/* Engagement text */}
            <div className="mt-1.5" style={{ fontSize: 10, color: INK_2 }}>
              0 replies · 0 likes
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
