'use client'

import type { ReactNode } from 'react'

interface PhoneFrameProps {
  children: ReactNode
  /** 'portrait' (9:16) or 'square' (1:1) */
  aspect?: 'portrait' | 'square'
  /** Scale factor for the phone (default 1) */
  scale?: number
  /**
   * The ground the platform actually renders on, as an oklch literal.
   *
   * This used to be a hard-coded `oklch(0.06 0.005 240)`, from April, when the
   * whole desk was dark. It was the substrate behind every mockup, so a mockup
   * that left any gap — InstagramMockup set no background at all — inherited a
   * near-black feed and showed the owner a dark-mode fiction of a post that
   * publishes to a white one. Repainting the mockups alone would not have fixed
   * that; the leak is here.
   *
   * It is a prop rather than a constant because the answer differs per network
   * and only the mockup knows it: TikTok genuinely is black, Facebook genuinely
   * is a pale grey. The default is white because that is what most feeds are,
   * and because a mockup that forgets to answer should fail towards the common
   * case rather than towards the bug this replaced.
   */
  screen?: string
}

/**
 * CSS-only phone bezel with dynamic island notch.
 *
 * The BEZEL stays dark — it is a phone, and a phone is a dark object on a desk.
 * The SCREEN is the platform's, not ours: these are imitations of third-party
 * products, so their colours come from those products and are never retinted
 * from `--brand`. A Facebook preview tinted with the brand hue would be a
 * prettier lie.
 */
export function PhoneFrame({
  children,
  aspect = 'square',
  scale = 1,
  screen = 'oklch(1 0 0)',
}: PhoneFrameProps) {
  const width = 320
  const height = aspect === 'portrait' ? 693 : 480

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: width * scale,
        height: (height + 24) * scale,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {/* Phone bezel */}
      <div
        className="relative overflow-hidden"
        style={{
          width,
          height: height + 24,
          borderRadius: 36,
          background: 'oklch(0.18 0.005 240)',
          boxShadow: `
            0 0 0 1px oklch(0.25 0.005 240),
            0 8px 32px oklch(0 0 0 / 0.28),
            inset 0 0 0 1px oklch(0.22 0.005 240)
          `,
          padding: '12px 8px 12px 8px',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 22,
            borderRadius: 12,
            background: 'oklch(0.08 0 0)',
            zIndex: 10,
          }}
        />

        {/* Status bar. Sits on the bezel, above the screen, so it stays light
            whatever ground the platform paints below it. */}
        <div
          className="flex items-center justify-between px-6"
          style={{
            height: 20,
            fontSize: 10,
            fontWeight: 600,
            color: 'oklch(0.7 0 240)',
            fontFamily: '"IBM Plex Sans", sans-serif',
          }}
        >
          <span>9:41</span>
          <span />
          <div className="flex items-center gap-1">
            {/* Signal bars */}
            <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
              <rect x="0" y="5" width="2" height="3" rx="0.5" />
              <rect x="3" y="3" width="2" height="5" rx="0.5" />
              <rect x="6" y="1" width="2" height="7" rx="0.5" />
              <rect x="9" y="0" width="2" height="8" rx="0.5" />
            </svg>
            {/* Battery */}
            <svg width="18" height="8" viewBox="0 0 18 8" fill="currentColor">
              <rect x="0" y="0" width="15" height="8" rx="1.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <rect x="1.5" y="1.5" width="10" height="5" rx="0.5" />
              <rect x="15.5" y="2" width="1.5" height="4" rx="0.5" />
            </svg>
          </div>
        </div>

        {/* Screen content */}
        <div
          className="overflow-hidden"
          style={{
            borderRadius: 28,
            height: height - 8,
            background: screen,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
