'use client'

import { MessageCircle, Repeat2, Heart, BarChart2, Share } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface XMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
}

export function XMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: XMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: 'oklch(0.06 0 0)' }}>
        {/* X Nav */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'oklch(0.9 0 240)' }}>𝕏</span>
        </div>

        {/* Post */}
        <div className="flex gap-2 px-3 py-3" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <div
            className="flex-shrink-0 rounded-full"
            style={{
              width: 32,
              height: 32,
              background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.25 0.02 240)',
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.9 0 240)' }}>{brandName}</span>
              <span style={{ fontSize: 11, color: 'oklch(0.45 0 240)' }}>@{brandName.toLowerCase().replace(/\s+/g, '')} · now</span>
            </div>
            <p style={{ fontSize: 12, color: 'oklch(0.85 0 240)', lineHeight: 1.5, marginTop: 2 }}>
              {fullCaption.length > 280 ? `${fullCaption.slice(0, 280)}...` : fullCaption}
            </p>

            {/* Image */}
            {mediaUrl && (
              <div
                className="mt-2 overflow-hidden"
                style={{
                  aspectRatio: '16/9',
                  borderRadius: 12,
                  background: `url(${mediaUrl}) center/cover`,
                  border: '1px solid oklch(0.15 0.005 240)',
                }}
              />
            )}

            {/* Actions */}
            <div className="mt-2 flex items-center justify-between" style={{ maxWidth: 280 }}>
              {[
                { icon: MessageCircle, count: '0' },
                { icon: Repeat2, count: '0' },
                { icon: Heart, count: '0' },
                { icon: BarChart2, count: '0' },
                { icon: Share, count: '' },
              ].map(({ icon: Icon, count }, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" style={{ color: 'oklch(0.45 0 240)' }} />
                  {count && <span style={{ fontSize: 10, color: 'oklch(0.45 0 240)' }}>{count}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
