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

/**
 * TikTok STAYS DARK, and this is a decision rather than an oversight.
 *
 * Every other frame in this folder was repainted on 19 August 2026 because it
 * showed a dark-mode fiction of a post that publishes to a white feed. TikTok
 * is the case where dark is the truth: the player is full-bleed video on black,
 * there is no light variant, and the caption really is white text over a
 * gradient. "Fixing" this one for consistency would introduce the very class of
 * error the rest of the folder was fixed to remove.
 *
 * The ground is stated on the frame as well as on the column so the two cannot
 * drift — a gap left by the video would otherwise show whatever PhoneFrame
 * defaults to, which is now white.
 */
const PLAYER = 'oklch(0.06 0.005 240)'
const WHITE = 'oklch(1 0 0)'

export function TikTokMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: TikTokMockupProps) {
  const fullCaption = hashtags?.length
    ? `${caption} ${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame aspect="portrait" screen={PLAYER}>
      <div
        className="relative flex h-full flex-col justify-end"
        style={{
          fontFamily: '"IBM Plex Sans", sans-serif',
          background: mediaUrl
            ? `url(${mediaUrl}) center/cover`
            : 'linear-gradient(to bottom, oklch(0.12 0.01 280), oklch(0.05 0.005 240))',
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
              border: `2px solid ${WHITE}`,
            }}
          />
          {[
            { icon: Heart, label: '0' },
            { icon: MessageCircle, label: '0' },
            { icon: Share2, label: '0' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <Icon className="h-6 w-6" style={{ color: WHITE }} />
              <span style={{ fontSize: 9, color: WHITE, fontWeight: 500 }}>{label}</span>
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
          <p style={{ fontSize: 12, fontWeight: 700, color: WHITE, marginBottom: 4 }}>
            @{brandName.toLowerCase().replace(/\s+/g, '')}
          </p>
          <p style={{ fontSize: 11, color: WHITE, lineHeight: 1.4 }}>
            {fullCaption.length > 100 ? `${fullCaption.slice(0, 100)}...` : fullCaption}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Music className="h-3 w-3" style={{ color: WHITE }} />
            <span style={{ fontSize: 9, color: 'oklch(0.85 0 240)' }}>Original sound - {brandName}</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
