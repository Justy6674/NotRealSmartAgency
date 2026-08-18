'use client'

import { ThumbsUp, MessageCircle, Share2 } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface FacebookMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
}

/**
 * Facebook's real surface, converted from the values Facebook ships:
 * feed #f0f2f5, card #ffffff, primary text #050505, secondary #65676b,
 * divider #ced0d4, brand #0866ff.
 *
 * These are Facebook's colours, not ours. The pane is an imitation of someone
 * else's product, so it must not be retinted from `--brand` — a preview that
 * matched our chrome would look right on our desk and wrong on the phone the
 * post actually lands on, which is the only place that counts.
 */
const FEED = 'oklch(0.960 0.005 258)'
const CARD = 'oklch(1 0 0)'
const LINE = 'oklch(0.857 0.006 265)'
const INK = 'oklch(0.115 0 0)'
const INK_2 = 'oklch(0.513 0.007 265)'
const BLUE = 'oklch(0.564 0.240 261)'

export function FacebookMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: FacebookMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* FB Nav */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: CARD, borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: BLUE, letterSpacing: '-0.02em' }}>facebook</span>
          <div className="flex gap-2">
            <div className="rounded-full p-1" style={{ background: FEED }}>
              <MessageCircle className="h-3.5 w-3.5" style={{ color: INK }} />
            </div>
          </div>
        </div>

        {/* Post card */}
        <div style={{ background: CARD, margin: '8px 0', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="flex-shrink-0 rounded-full"
              style={{
                width: 32,
                height: 32,
                background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.857 0.006 265)',
              }}
            />
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{brandName}</span>
              <div style={{ fontSize: 9, color: INK_2 }}>Just now · 🌐</div>
            </div>
          </div>

          {/* Caption */}
          <div className="px-3 pb-2">
            <p style={{ fontSize: 12, color: INK, lineHeight: 1.4 }}>
              {fullCaption.length > 200 ? (
                <>
                  {fullCaption.slice(0, 200)}...{' '}
                  <span style={{ color: INK_2 }}>See more</span>
                </>
              ) : fullCaption}
            </p>
          </div>

          {/* Image */}
          {mediaUrl && (
            <div style={{ aspectRatio: '1/1', background: `url(${mediaUrl}) center/cover` }} />
          )}

          {/* Reactions row */}
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <span style={{ fontSize: 12 }}>👍</span>
                <span style={{ fontSize: 12 }}>❤️</span>
              </div>
              <span style={{ fontSize: 10, color: INK_2 }}>0</span>
            </div>
            <span style={{ fontSize: 10, color: INK_2 }}>0 comments</span>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-around py-1.5">
            {[
              { icon: ThumbsUp, label: 'Like' },
              { icon: MessageCircle, label: 'Comment' },
              { icon: Share2, label: 'Share' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: INK_2 }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: INK_2 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
