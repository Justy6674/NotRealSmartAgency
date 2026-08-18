'use client'

import { ThumbsUp, MessageCircle, Repeat2, Send } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface LinkedInMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
}

/**
 * LinkedIn's real surface, converted from the values LinkedIn ships: feed
 * #f4f2ee — a warm off-white, not a cool one, which is the thing that makes a
 * LinkedIn screenshot recognisable at a glance — card #ffffff on an 8px radius,
 * border #e0dfdc, brand #0a66c2.
 *
 * The warmth is why this hue is 85–91 rather than the house 240. It is
 * LinkedIn's, not ours, and must not be pulled towards `--brand`.
 */
const FEED = 'oklch(0.962 0.006 85)'
const CARD = 'oklch(1 0 0)'
const LINE = 'oklch(0.904 0.004 91)'
const INK = 'oklch(0.218 0 0)'
const INK_2 = 'oklch(0.510 0 0)'
const BLUE = 'oklch(0.516 0.163 255)'
const FIELD = 'oklch(0.962 0.009 248)'

export function LinkedInMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: LinkedInMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* LI Nav */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: CARD, borderBottom: `1px solid ${LINE}` }}>
          <span
            className="flex items-center justify-center"
            style={{ fontSize: 12, fontWeight: 800, color: 'oklch(1 0 0)', background: BLUE, borderRadius: 3, width: 20, height: 20, letterSpacing: '-0.03em' }}
          >
            in
          </span>
          <div className="flex-1 mx-3 rounded-sm px-2 py-1" style={{ background: FIELD, fontSize: 10, color: INK_2 }}>
            Search
          </div>
          <MessageCircle className="h-4 w-4" style={{ color: INK_2 }} />
        </div>

        {/* Post card */}
        <div style={{ background: CARD, margin: '8px 0', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          {/* Header */}
          <div className="flex items-start gap-2 px-3 py-2">
            <div
              className="flex-shrink-0 rounded-full"
              style={{
                width: 36,
                height: 36,
                background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : LINE,
              }}
            />
            <div className="flex-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{brandName}</span>
              <div style={{ fontSize: 9, color: INK_2 }}>Company · Just now</div>
            </div>
          </div>

          {/* Caption */}
          <div className="px-3 pb-2">
            <p style={{ fontSize: 11, color: INK, lineHeight: 1.5 }}>
              {fullCaption.length > 150 ? (
                <>
                  {fullCaption.slice(0, 150)}...{' '}
                  <span style={{ color: INK_2, fontWeight: 500 }}>see more</span>
                </>
              ) : fullCaption}
            </p>
          </div>

          {/* Image */}
          {mediaUrl && (
            <div style={{ aspectRatio: '1/1', background: `url(${mediaUrl}) center/cover` }} />
          )}

          {/* Reactions */}
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 11 }}>👍 💡 ❤️</span>
              <span style={{ fontSize: 9, color: INK_2 }}>0</span>
            </div>
            <span style={{ fontSize: 9, color: INK_2 }}>0 comments</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around py-1.5">
            {[
              { icon: ThumbsUp, label: 'Like' },
              { icon: MessageCircle, label: 'Comment' },
              { icon: Repeat2, label: 'Repost' },
              { icon: Send, label: 'Send' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" style={{ color: INK_2 }} />
                <span style={{ fontSize: 9, color: INK_2 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
