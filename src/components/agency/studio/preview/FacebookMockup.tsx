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

export function FacebookMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: FacebookMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: 'oklch(0.08 0.005 240)' }}>
        {/* FB Nav */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'oklch(0.55 0.15 250)', letterSpacing: '-0.02em' }}>facebook</span>
          <div className="flex gap-2">
            <div className="rounded-full p-1" style={{ background: 'oklch(0.15 0.005 240)' }}>
              <MessageCircle className="h-3.5 w-3.5" style={{ color: 'oklch(0.7 0 240)' }} />
            </div>
          </div>
        </div>

        {/* Post card */}
        <div style={{ background: 'oklch(0.1 0.005 240)', margin: '8px 0', borderTop: '1px solid oklch(0.15 0.005 240)', borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="flex-shrink-0 rounded-full"
              style={{
                width: 32,
                height: 32,
                background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.25 0.02 240)',
              }}
            />
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.9 0 240)' }}>{brandName}</span>
              <div style={{ fontSize: 9, color: 'oklch(0.45 0 240)' }}>Just now · 🌐</div>
            </div>
          </div>

          {/* Caption */}
          <div className="px-3 pb-2">
            <p style={{ fontSize: 12, color: 'oklch(0.8 0 240)', lineHeight: 1.4 }}>
              {fullCaption.length > 200 ? `${fullCaption.slice(0, 200)}... See more` : fullCaption}
            </p>
          </div>

          {/* Image */}
          {mediaUrl && (
            <div style={{ aspectRatio: '1/1', background: `url(${mediaUrl}) center/cover` }} />
          )}

          {/* Reactions row */}
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <span style={{ fontSize: 12 }}>👍</span>
                <span style={{ fontSize: 12 }}>❤️</span>
              </div>
              <span style={{ fontSize: 10, color: 'oklch(0.5 0 240)' }}>0</span>
            </div>
            <span style={{ fontSize: 10, color: 'oklch(0.5 0 240)' }}>0 comments</span>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-around py-1.5">
            {[
              { icon: ThumbsUp, label: 'Like' },
              { icon: MessageCircle, label: 'Comment' },
              { icon: Share2, label: 'Share' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: 'oklch(0.55 0 240)' }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: 'oklch(0.55 0 240)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
