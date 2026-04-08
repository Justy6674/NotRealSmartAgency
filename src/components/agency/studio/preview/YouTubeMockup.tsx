'use client'

import { ThumbsUp, ThumbsDown, Share2, Download } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface YouTubeMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  brandName: string
  brandAvatarUrl?: string
}

export function YouTubeMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: YouTubeMockupProps) {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: 'oklch(0.06 0 0)' }}>
        {/* YT Nav */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <div className="rounded-sm" style={{ width: 20, height: 14, background: 'oklch(0.55 0.2 25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 0, height: 0, borderLeft: '6px solid white', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.9 0 240)', letterSpacing: '-0.02em' }}>YouTube</span>
          </div>
        </div>

        {/* Thumbnail */}
        <div
          style={{
            aspectRatio: '16/9',
            background: mediaUrl ? `url(${mediaUrl}) center/cover` : 'oklch(0.12 0.005 240)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!mediaUrl && (
            <div className="rounded-full p-3" style={{ background: 'oklch(0 0 0 / 0.6)' }}>
              <div style={{ width: 0, height: 0, borderLeft: '12px solid white', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', marginLeft: 2 }} />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-3 py-2">
          <p style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.9 0 240)', lineHeight: 1.3 }}>
            {caption.length > 80 ? `${caption.slice(0, 80)}...` : caption}
          </p>
          <p style={{ fontSize: 10, color: 'oklch(0.45 0 240)', marginTop: 4 }}>
            0 views · Just now
          </p>
        </div>

        {/* Channel */}
        <div className="flex items-center gap-2 px-3 py-1">
          <div
            className="flex-shrink-0 rounded-full"
            style={{
              width: 28,
              height: 28,
              background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : 'oklch(0.25 0.02 240)',
            }}
          />
          <span style={{ fontSize: 11, color: 'oklch(0.7 0 240)' }}>{brandName}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-3 py-2">
          {[
            { icon: ThumbsUp, label: '0' },
            { icon: ThumbsDown, label: '' },
            { icon: Share2, label: 'Share' },
            { icon: Download, label: 'Save' },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'oklch(0.15 0.005 240)' }}>
              <Icon className="h-3 w-3" style={{ color: 'oklch(0.7 0 240)' }} />
              {label && <span style={{ fontSize: 9, color: 'oklch(0.7 0 240)' }}>{label}</span>}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
