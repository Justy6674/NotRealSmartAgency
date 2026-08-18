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

/**
 * YouTube's real surface: white, #0f0f0f text, #606060 secondary, #f2f2f2
 * chips, #ff0000 on the play badge.
 *
 * WHY THIS ONE IS LIGHT WHEN TIKTOK IS NOT. Shorts is a black, full-bleed,
 * portrait player and should stay black — but that is not what this file draws.
 * This is the watch page: a 16:9 thumbnail, a title, a channel row and a strip
 * of chips, in a square frame. That surface is white unless the viewer has
 * chosen otherwise, so painting it black to match Shorts would misdescribe the
 * screen it actually imitates. If a Shorts frame is ever wanted it is a second
 * component with `aspect="portrait"`, not a repaint of this one.
 */
const PAGE = 'oklch(1 0 0)'
const INK = 'oklch(0.168 0 0)'
const INK_2 = 'oklch(0.489 0 0)'
const CHIP = 'oklch(0.961 0 0)'
const RED = 'oklch(0.628 0.258 29)'
const PLACEHOLDER = 'oklch(0.922 0 0)'
const WHITE = 'oklch(1 0 0)'

export function YouTubeMockup({ caption, hashtags, mediaUrl, brandName, brandAvatarUrl }: YouTubeMockupProps) {
  return (
    <PhoneFrame screen={PAGE}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: PAGE }}>
        {/* YT Nav */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <div className="rounded-sm" style={{ width: 20, height: 14, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 0, height: 0, borderLeft: `6px solid ${WHITE}`, borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '-0.02em' }}>YouTube</span>
          </div>
        </div>

        {/* Thumbnail */}
        <div
          style={{
            aspectRatio: '16/9',
            background: mediaUrl ? `url(${mediaUrl}) center/cover` : PLACEHOLDER,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!mediaUrl && (
            <div className="rounded-full p-3" style={{ background: 'oklch(0 0 0 / 0.6)' }}>
              <div style={{ width: 0, height: 0, borderLeft: `12px solid ${WHITE}`, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', marginLeft: 2 }} />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-3 py-2">
          <p style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
            {caption.length > 80 ? `${caption.slice(0, 80)}...` : caption}
          </p>
          <p style={{ fontSize: 10, color: INK_2, marginTop: 4 }}>
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
              background: brandAvatarUrl ? `url(${brandAvatarUrl}) center/cover` : PLACEHOLDER,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 500, color: INK }}>{brandName}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-3 py-2">
          {[
            { icon: ThumbsUp, label: '0' },
            { icon: ThumbsDown, label: '' },
            { icon: Share2, label: 'Share' },
            { icon: Download, label: 'Save' },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: CHIP }}>
              <Icon className="h-3 w-3" style={{ color: INK }} />
              {label && <span style={{ fontSize: 9, color: INK }}>{label}</span>}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
