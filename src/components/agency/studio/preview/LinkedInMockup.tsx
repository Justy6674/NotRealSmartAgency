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

export function LinkedInMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: LinkedInMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: 'oklch(0.08 0.005 240)' }}>
        {/* LI Nav */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: 'oklch(0.1 0.005 240)', borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.55 0.15 250)' }}>in</span>
          <div className="flex-1 mx-3 rounded-sm px-2 py-1" style={{ background: 'oklch(0.15 0.005 240)', fontSize: 10, color: 'oklch(0.45 0 240)' }}>
            Search
          </div>
          <MessageCircle className="h-4 w-4" style={{ color: 'oklch(0.6 0 240)' }} />
        </div>

        {/* Post card */}
        <div style={{ background: 'oklch(0.1 0.005 240)', margin: '8px 0', borderTop: '1px solid oklch(0.15 0.005 240)', borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          {/* Header */}
          <div className="flex items-start gap-2 px-3 py-2">
            <div
              className="flex-shrink-0 rounded-full"
              style={{
                width: 36,
                height: 36,
                background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.25 0.02 240)',
              }}
            />
            <div className="flex-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.9 0 240)' }}>{brandName}</span>
              <div style={{ fontSize: 9, color: 'oklch(0.45 0 240)' }}>Company · Just now</div>
            </div>
          </div>

          {/* Caption */}
          <div className="px-3 pb-2">
            <p style={{ fontSize: 11, color: 'oklch(0.75 0 240)', lineHeight: 1.5 }}>
              {fullCaption.length > 150 ? (
                <>
                  {fullCaption.slice(0, 150)}...{' '}
                  <span style={{ color: 'oklch(0.5 0 240)', fontWeight: 500 }}>see more</span>
                </>
              ) : fullCaption}
            </p>
          </div>

          {/* Image */}
          {mediaUrl && (
            <div style={{ aspectRatio: '1/1', background: `url(${mediaUrl}) center/cover` }} />
          )}

          {/* Reactions */}
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 11 }}>👍 💡 ❤️</span>
              <span style={{ fontSize: 9, color: 'oklch(0.5 0 240)' }}>0</span>
            </div>
            <span style={{ fontSize: 9, color: 'oklch(0.5 0 240)' }}>0 comments</span>
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
                <Icon className="h-3.5 w-3.5" style={{ color: 'oklch(0.5 0 240)' }} />
                <span style={{ fontSize: 9, color: 'oklch(0.5 0 240)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
