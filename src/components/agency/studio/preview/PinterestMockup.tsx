'use client'

import { Bookmark, MoreHorizontal, ExternalLink } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'

interface PinterestMockupProps {
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
  aspect?: 'portrait' | 'square'
}

/**
 * Pinterest's real surface: white, #111111 title, #767676 secondary, and the
 * #e60023 red that the Save button and the logo both carry. Pinterest has no
 * dark mode on the web at all, so the old near-black frame was not even a
 * defensible reading of it.
 *
 * The white overlays on the pin image (Save, the two round buttons) stay white:
 * they sit on the owner's own photograph, not on the feed, so they are legible
 * whatever the image is.
 */
const FEED = 'oklch(1 0 0)'
const LINE = 'oklch(0.952 0 0)'
const INK = 'oklch(0.178 0 0)'
const INK_2 = 'oklch(0.566 0 0)'
const RED = 'oklch(0.582 0.236 26)'
const PLACEHOLDER = 'oklch(0.968 0.006 26)'
const WHITE = 'oklch(1 0 0)'

export function PinterestMockup({
  caption,
  hashtags,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
  aspect = 'portrait',
}: PinterestMockupProps) {
  const displayUrl = mediaUrl ?? mediaUrls?.[0]
  const fullCaption = hashtags?.length
    ? `${caption}\n\n${hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
    : caption

  return (
    <PhoneFrame aspect={aspect} screen={FEED}>
      <div className="flex h-full flex-col" style={{ fontFamily: '"IBM Plex Sans", sans-serif', background: FEED }}>
        {/* Pinterest nav bar */}
        <div className="flex items-center justify-center px-3 py-2" style={{ borderBottom: `1px solid ${LINE}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345c-.091.379-.293 1.194-.333 1.361-.052.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.462-6.233 7.462-1.214 0-2.354-.631-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Z"
              fill={RED}
            />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK, marginLeft: 6, letterSpacing: '-0.01em' }}>
            Pinterest
          </span>
        </div>

        {/* Pin card */}
        <div className="flex-1 flex flex-col">
          {/* Pin image */}
          <div
            className="flex-shrink-0 relative"
            style={{
              aspectRatio: aspect === 'portrait' ? '2/3' : '1/1',
              background: displayUrl ? `url(${displayUrl}) center/cover` : PLACEHOLDER,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!displayUrl && (
              <span style={{ fontSize: 11, color: INK_2 }}>No image</span>
            )}
            {/* Save button overlay */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: RED,
                borderRadius: 20,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Bookmark className="h-3 w-3" style={{ color: WHITE }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>Save</span>
            </div>
            {/* More + link overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                display: 'flex',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'oklch(0 0 0 / 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ExternalLink className="h-3 w-3" style={{ color: WHITE }} />
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'oklch(0 0 0 / 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MoreHorizontal className="h-3 w-3" style={{ color: WHITE }} />
              </div>
            </div>
          </div>

          {/* Pin details */}
          <div className="px-3 py-2.5">
            {/* Title / caption */}
            <p style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
              {fullCaption.length > 100 ? `${fullCaption.slice(0, 100)}...` : fullCaption}
            </p>

            {/* Creator attribution */}
            <div className="mt-2 flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 24,
                  height: 24,
                  background: brandAvatarUrl
                    ? `url(${brandAvatarUrl}) center/cover`
                    : 'linear-gradient(135deg, oklch(0.582 0.236 26), oklch(0.66 0.18 5))',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: INK_2 }}>
                {brandName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  )
}
