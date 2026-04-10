'use client'

import { MessageCircle, Repeat2, Star, Bookmark, MoreHorizontal } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface MastodonMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
  /** Content warning / spoiler text */
  contentWarning?: string
}

export function MastodonMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'square',
  contentWarning,
}: MastodonMockupProps) {
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption
  const handle = brandName.toLowerCase().replace(/\s+/g, '')

  return (
    <PhoneFrame aspect={aspect}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: 'oklch(0.08 0.01 270)' }}>
        {/* Mastodon nav bar */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: '1px solid oklch(0.18 0.01 270)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21.258 13.99c-.274 1.41-2.456 2.955-4.962 3.254-1.306.156-2.593.3-3.965.236-2.243-.104-4.014-.542-4.014-.542 0 .221.014.432.04.632.292 2.215 2.196 2.347 3.996 2.41 1.815.062 3.432-.448 3.432-.448l.076 1.646s-1.274.684-3.542.81c-1.25.068-2.803-.032-4.612-.514C4.442 20.59 3.63 17.21 3.496 13.78a41.4 41.4 0 0 1-.028-1.79c0-4.51 2.956-5.834 2.956-5.834C7.912 5.398 10.186 5.2 12.552 5.18h.056c2.366.02 4.643.218 6.131.976 0 0 2.956 1.324 2.956 5.834 0 0 .037 3.328-.437 1.999Z"
              fill="oklch(0.55 0.18 280)"
            />
            <path
              d="M18.007 9.934v4.148h-1.644V10.08c0-.847-.356-1.278-1.069-1.278-.788 0-1.183.51-1.183 1.521v2.203h-1.634v-2.203c0-1.011-.395-1.521-1.183-1.521-.713 0-1.069.43-1.069 1.278v4.002H8.58V9.934c0-.847.216-1.52.648-2.017.446-.498 1.03-.753 1.755-.753.838 0 1.474.322 1.895.966l.408.685.408-.685c.421-.644 1.057-.966 1.895-.966.725 0 1.309.255 1.755.753.432.498.648 1.17.648 2.017h.015Z"
              fill="oklch(0.08 0.01 270)"
            />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.9 0 240)', marginLeft: 6, letterSpacing: '-0.01em' }}>
            Mastodon
          </span>
        </div>

        {/* Toot */}
        <div className="flex gap-2 px-3 py-3" style={{ borderBottom: '1px solid oklch(0.18 0.01 270)' }}>
          <div
            className="flex-shrink-0 rounded-full"
            style={{
              width: 32,
              height: 32,
              background: brandAvatarUrl
                ? `url(${brandAvatarUrl}) center/cover`
                : 'linear-gradient(135deg, oklch(0.45 0.18 280), oklch(0.55 0.15 300))',
            }}
          />
          <div className="flex-1 min-w-0">
            {/* Author line */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.9 0 240)' }}>{brandName}</span>
                <span className="truncate" style={{ fontSize: 11, color: 'oklch(0.45 0 240)' }}>@{handle}@mastodon.social</span>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'oklch(0.4 0 240)' }} />
            </div>

            {/* Content warning */}
            {contentWarning && (
              <div
                className="mt-1.5 rounded px-2 py-1"
                style={{
                  background: 'oklch(0.15 0.01 270)',
                  border: '1px solid oklch(0.25 0.01 270)',
                  fontSize: 11,
                  color: 'oklch(0.7 0 240)',
                }}
              >
                <span style={{ fontWeight: 600 }}>CW:</span> {contentWarning}
              </div>
            )}

            {/* Toot text */}
            <p style={{ fontSize: 12, color: 'oklch(0.85 0 240)', lineHeight: 1.5, marginTop: 4 }}>
              {fullCaption.length > 500 ? `${fullCaption.slice(0, 500)}...` : fullCaption}
            </p>

            {/* Image */}
            {displayUrl && (
              <div
                className="mt-2 overflow-hidden"
                style={{
                  aspectRatio: '16/9',
                  borderRadius: 8,
                  background: `url(${displayUrl}) center/cover`,
                  border: '1px solid oklch(0.18 0.01 270)',
                }}
              />
            )}

            {/* Action row */}
            <div className="mt-2 flex items-center justify-between" style={{ maxWidth: 260 }}>
              {[
                { icon: MessageCircle, count: '0', colour: 'oklch(0.45 0 240)' },
                { icon: Repeat2, count: '0', colour: 'oklch(0.45 0 240)' },
                { icon: Star, count: '0', colour: 'oklch(0.45 0 240)' },
                { icon: Bookmark, count: '', colour: 'oklch(0.45 0 240)' },
              ].map(({ icon: Icon, count, colour }, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" style={{ color: colour }} />
                  {count && <span style={{ fontSize: 10, color: colour }}>{count}</span>}
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div className="mt-1.5" style={{ fontSize: 10, color: 'oklch(0.35 0 240)' }}>
              Just now
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
