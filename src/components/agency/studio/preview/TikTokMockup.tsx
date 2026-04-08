'use client'

import { Heart, MessageCircle, Share2, Music } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface TikTokMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
}

export function TikTokMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: TikTokMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption} ${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame aspect="portrait">
      <div
        className="relative flex h-full flex-col justify-end"
        style={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          background: mediaUrl
            ? `url(${mediaUrl}) center/cover`
            : 'linear-gradient(to bottom, oklch(0.08 0.01 280), oklch(0.04 0.005 240))',
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, oklch(0 0 0 / 0.7) 0%, transparent 50%)',
          }}
        />

        {/* Right sidebar icons */}
        <div
          className="absolute flex flex-col items-center gap-4"
          style={{ right: 10, bottom: 120 }}
        >
          <div
            className="rounded-full"
            style={{
              width: 36,
              height: 36,
              background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.3 0.02 240)',
              border: '2px solid oklch(0.9 0 240)',
            }}
          />
          {[
            { icon: Heart, label: '0' },
            { icon: MessageCircle, label: '0' },
            { icon: Share2, label: '0' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <Icon className="h-6 w-6" style={{ color: 'white' }} />
              <span style={{ fontSize: 9, color: 'white', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
          {/* Music disc */}
          <div
            className="rounded-full"
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, oklch(0.2 0 0), oklch(0.1 0 0))',
              border: '3px solid oklch(0.3 0 0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Music className="h-3 w-3" style={{ color: 'oklch(0.6 0 240)' }} />
          </div>
        </div>

        {/* Bottom content */}
        <div className="relative z-10 px-3 pb-4" style={{ maxWidth: 260 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 4 }}>
            @{brandName.toLowerCase().replace(/\s+/g, '')}
          </p>
          <p style={{ fontSize: 11, color: 'oklch(0.9 0 240)', lineHeight: 1.4 }}>
            {fullCaption.length > 100 ? `${fullCaption.slice(0, 100)}...` : fullCaption}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Music className="h-3 w-3" style={{ color: 'white' }} />
            <span style={{ fontSize: 9, color: 'oklch(0.8 0 240)' }}>Original sound - {brandName}</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
