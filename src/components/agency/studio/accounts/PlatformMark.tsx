'use client'

import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react'
import type { ComponentType } from 'react'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import {
  CONNECTABLE_PLATFORMS,
  platformBySlug,
} from '@/components/agency/social/connect/PlatformGrid'

/**
 * The little platform disc that sits on the corner of an account's avatar.
 *
 * ── Why a badge and not a coloured ring ────────────────────────────────
 * The card used to say "which platform" with a coloured left border and an
 * uppercase word, and say "is it working" with a dot in the corner. Two quiet
 * signals competing for the same glance, and the one that mattered — the
 * health — lost, because a border is furniture and the eye skips it.
 *
 * So the two are split by shape, the way Mixpost's own accounts page does it:
 * the badge on the avatar answers WHICH, the ring around the avatar and the
 * strip under the name answer WHETHER IT WORKS. A person scanning fourteen
 * cards is looking for the second one.
 *
 * ── Where the names and colours come from ──────────────────────────────
 * `CONNECTABLE_PLATFORMS` in the connect folder, not a second copy here. That
 * list is what the chooser offers, so a platform added or dropped there — X is
 * dropped there — moves this grid with it. Only two things live here: the
 * glyph, and the handful of platforms that can be CONNECTED already but can no
 * longer be STARTED, which by definition are not on that list.
 *
 * ── Why some marks are a letter ────────────────────────────────────────
 * Lucide ships four of these platforms and no more. The rest get a monogram on
 * the platform's own colour rather than a hand-drawn approximation of a
 * trademark: a wrong TikTok note is worse than a correct "T", and every mark
 * here still reads at 18px, which a traced logo would not.
 */

export { CONNECTABLE_PLATFORMS }

type Glyph = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>

/** The four platforms with a real glyph on hand. Everything else is a letter. */
const GLYPHS: Record<string, Glyph> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

/** Monograms for the rest, so a disc is never blank. */
const MONOGRAMS: Record<string, string> = {
  tiktok: 'T',
  threads: '@',
  pinterest: 'P',
  bluesky: 'B',
  googlebusiness: 'G',
  reddit: 'R',
  telegram: 'T',
  snapchat: 'S',
  discord: 'D',
  mastodon: 'M',
  pixelfed: 'P',
  twitter: 'X',
}

/**
 * Platforms an account can already be connected to, but which the chooser no
 * longer offers — so they are absent from `CONNECTABLE_PLATFORMS` and would
 * otherwise draw as an unnamed grey disc on a real, working account.
 *
 * **X is here, and that is the point.** It is not offered as something to set
 * up; an account already connected to it keeps working, keeps its name and
 * keeps its mark. Removing the presentation would not remove the account, it
 * would only make it unrecognisable.
 */
const STILL_DRAWN: Record<string, { label: string; mark: string }> = {
  twitter: { label: 'X', mark: 'oklch(0.20 0.014 240)' },
  mastodon: { label: 'Mastodon', mark: 'oklch(0.56 0.22 285)' },
  pixelfed: { label: 'Pixelfed', mark: 'oklch(0.60 0.16 160)' },
}

/**
 * Two publishers spell the same platform differently and both reach this file:
 * one stores `facebook_page`, the other `FACEBOOK`, and Google Business
 * arrives under any of three names.
 */
function normalisePlatform(raw: string): string {
  const key = canonicalSocialPlatform(raw)
  if (key === 'google_business' || key === 'gmb' || key === 'google') return 'googlebusiness'
  if (key === 'youtube_channel') return 'youtube'
  return key
}

export interface PlatformPresentation {
  /** What the owner calls it. Never an internal slug. */
  label: string
  /** The platform's own mark colour, in oklch. */
  colour: string
  /** Ink that survives on that fill. */
  ink: string
  glyph?: Glyph
  monogram: string
}

/**
 * Ink chosen from the fill's own lightness rather than a second hand-kept
 * table. Snapchat's yellow and Facebook's blue do not want the same ink, and
 * remembering which is which every time a colour is tuned is how one of them
 * ends up white on white.
 */
function inkFor(mark: string): string {
  const lightness = Number(/oklch\(\s*([\d.]+)/.exec(mark)?.[1] ?? '0.5')
  return lightness > 0.72 ? 'oklch(0.20 0.014 240)' : 'oklch(1 0 0)'
}

export function presentationFor(platform: string): PlatformPresentation {
  const key = normalisePlatform(platform)
  const known = platformBySlug(key) ?? STILL_DRAWN[key]

  if (!known) {
    // Unrecognised still gets a disc, in house silver, with its initial — an
    // account we cannot name is still an account the owner can see and remove.
    const raw = platform.trim()
    return {
      label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Account',
      colour: 'oklch(0.615 0.011 240)',
      ink: 'oklch(1 0 0)',
      monogram: (raw[0] ?? '?').toUpperCase(),
    }
  }

  return {
    label: known.label,
    colour: known.mark,
    ink: inkFor(known.mark),
    ...(GLYPHS[key] ? { glyph: GLYPHS[key] } : {}),
    monogram: MONOGRAMS[key] ?? known.label.charAt(0).toUpperCase(),
  }
}

interface PlatformMarkProps {
  platform: string
  /** Disc diameter in px. 18 on an avatar corner, 26 in a list row. */
  size?: number
  /** A ring in the surrounding surface's colour, so the disc lifts off an avatar. */
  ringed?: boolean
  className?: string
}

export function PlatformMark({ platform, size = 18, ringed = false, className }: PlatformMarkProps) {
  const presentation = presentationFor(platform)
  const Glyph = presentation.glyph

  return (
    <span
      title={presentation.label}
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: presentation.colour,
        color: presentation.ink,
        ...(ringed ? { boxShadow: '0 0 0 2px var(--panel, oklch(1 0 0))' } : {}),
      }}
    >
      {Glyph ? (
        <Glyph size={Math.round(size * 0.6)} strokeWidth={2.2} aria-hidden />
      ) : (
        <span className="font-semibold leading-none" style={{ fontSize: Math.round(size * 0.5) }}>
          {presentation.monogram}
        </span>
      )}
    </span>
  )
}
