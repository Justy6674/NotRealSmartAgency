'use client'

import { Loader2 } from 'lucide-react'

import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import { HealthBadge, type ConnectionHealth } from './ConnectStatus'

/**
 * The thirteen doors, and whether this business already has one open.
 *
 * ── Why our own grid and not the publisher's hosted picker ─────────────
 * The hosted picker is a second product's chrome dropped into the middle of
 * ours: its typeface, its palette, its wording, its name at the top. The owner
 * is a non-technical business owner who has never heard of the company whose
 * screen he would land on, and the one question he needs answered on the way
 * through — "which of my businesses am I connecting this to" — is a question
 * that picker cannot ask, because it does not know our businesses exist. Every
 * platform below is started from here and finished on our own screens.
 *
 * ── Why thirteen and not ten, and not fourteen ─────────────────────────
 * An earlier chooser listed ten, four of which could not be completed at all,
 * while five that could — Reddit, Telegram, Snapchat, Discord, Google Business
 * — were missing. A chooser that offers a door which does not open is worse
 * than one that offers fewer doors. These thirteen are the ones a sign-in can
 * actually be finished for. X is deliberately absent: it is out of scope for
 * this slice, and listing it would be exactly the door that does not open.
 *
 * ── Colour ─────────────────────────────────────────────────────────────
 * DESIGN.md: oklch only, never hex in new UI code. Each mark below is that
 * platform's own colour converted to oklch, which is what makes a row
 * recognisable in one glance; the chrome around them stays on the house
 * palette and retints with the business. Snapchat and Telegram are carried a
 * few points darker than their brand values so white initials stay readable on
 * them — their published yellow and light blue do not hold white text.
 */

/* ── What kind of connecting each platform asks of the owner ─────────────── */

export type ConnectFlow =
  /** Sign in on the platform, come back, done. */
  | 'sign-in'
  /**
   * Sign in on the platform, come back, and pick which one to post to.
   *
   * "May ask", not "always asks": Instagram only reaches a choice when the
   * owner's account is managed through a Facebook Page, and a Google Business
   * account with one shopfront has nothing to choose between. The flow is
   * driven by what actually comes back, never by this label — which is why the
   * dialog decides from the return and not from here.
   */
  | 'sign-in-then-choose'
  /** No sign-in page: the owner pastes an app password they generate. */
  | 'app-password'
  /** No sign-in page: we show a code and wait for them to send it. */
  | 'access-code'

export interface ConnectablePlatform {
  /** The word our own connect routes take. Never shown to the owner. */
  slug: string
  /** What the owner calls it. */
  label: string
  /** The platform's own mark colour, in oklch. */
  mark: string
  flow: ConnectFlow
  /** Shown under the name when there is a condition worth knowing up front. */
  note?: string
  /**
   * The heading for the choice, when there is one. Owner-facing and specific —
   * "Choose which Page to post to" tells him what he is deciding; "Select an
   * entity" tells him nothing.
   */
  choiceHeading?: string
  /** One line under that heading, explaining what the list is. */
  choiceHelp?: string
}

export const CONNECTABLE_PLATFORMS: ConnectablePlatform[] = [
  {
    slug: 'facebook',
    label: 'Facebook',
    mark: 'oklch(0.589 0.203 258)',
    flow: 'sign-in-then-choose',
    note: 'Pages you manage',
    choiceHeading: 'Choose which Page to post to',
    choiceHelp: 'These are the Facebook Pages this sign-in can post to. Pick the one for this business — you can connect another Page later.',
  },
  {
    slug: 'instagram',
    label: 'Instagram',
    mark: 'oklch(0.619 0.200 15)',
    flow: 'sign-in-then-choose',
    note: 'Business or creator accounts',
    // No `loginMethod` is sent, so this uses Instagram's own sign-in, which
    // needs no Facebook Page. An owner who manages Instagram through a Page
    // comes back at the choosing step instead, and the copy below is written
    // for that case because it is the only case where it is shown.
    choiceHeading: 'Choose which Instagram account to post to',
    choiceHelp: 'This sign-in manages Instagram through Facebook, so the accounts below are the ones attached to your Pages.',
  },
  {
    slug: 'linkedin',
    label: 'LinkedIn',
    mark: 'oklch(0.516 0.163 255)',
    flow: 'sign-in-then-choose',
    note: 'Your own page or a company page',
    choiceHeading: 'Choose which LinkedIn page to post to',
    choiceHelp: 'Post as yourself, or as one of the company pages you help run.',
  },
  { slug: 'tiktok', label: 'TikTok', mark: 'oklch(0.178 0 0)', flow: 'sign-in' },
  { slug: 'youtube', label: 'YouTube', mark: 'oklch(0.628 0.258 29)', flow: 'sign-in', note: 'Videos need a title' },
  {
    slug: 'pinterest',
    label: 'Pinterest',
    mark: 'oklch(0.505 0.202 26)',
    flow: 'sign-in-then-choose',
    choiceHeading: 'Choose which board to pin to',
    choiceHelp: 'New pins go to this board unless you change it on the post.',
  },
  { slug: 'threads', label: 'Threads', mark: 'oklch(0.173 0 0)', flow: 'sign-in' },
  {
    slug: 'bluesky',
    label: 'Bluesky',
    mark: 'oklch(0.626 0.205 255)',
    flow: 'app-password',
    note: 'Uses an app password, not a sign-in page',
  },
  {
    slug: 'googlebusiness',
    label: 'Google Business',
    mark: 'oklch(0.630 0.180 260)',
    flow: 'sign-in-then-choose',
    note: 'Your shopfront listing',
    choiceHeading: 'Choose which location to post to',
    choiceHelp: 'One listing per shopfront. If you have several, connect the others the same way afterwards.',
  },
  { slug: 'reddit', label: 'Reddit', mark: 'oklch(0.660 0.229 35)', flow: 'sign-in' },
  {
    slug: 'telegram',
    label: 'Telegram',
    mark: 'oklch(0.620 0.130 238)',
    flow: 'access-code',
    // Both halves, because the first one is the one people miss: the bot has to
    // be an administrator of the channel before a code does anything.
    note: 'You add a bot, then send it a code',
  },
  {
    slug: 'snapchat',
    label: 'Snapchat',
    mark: 'oklch(0.620 0.140 101)',
    flow: 'sign-in-then-choose',
    choiceHeading: 'Choose which Snapchat account to post to',
    choiceHelp: 'These are the public accounts on this Snapchat sign-in.',
  },
  { slug: 'discord', label: 'Discord', mark: 'oklch(0.577 0.209 274)', flow: 'sign-in' },
]

export function platformBySlug(slug: string): ConnectablePlatform | undefined {
  return CONNECTABLE_PLATFORMS.find((p) => p.slug === slug)
}

/** What the owner calls a platform, whatever the row said it was. */
export function platformLabel(slug: string): string {
  return platformBySlug(normalisePlatform(slug))?.label ?? 'this account'
}

/**
 * Two publishers spell the same platform differently and both spellings reach
 * this grid: one stores `facebook_page`, the other `FACEBOOK`; Google Business
 * arrives as any of three names. Normalising here is what stops a connected
 * account from being drawn on a tile that reads "Not connected" — which is the
 * kind of wrong that makes an owner connect a second one.
 */
function normalisePlatform(raw: string): string {
  const key = canonicalSocialPlatform(raw)
  if (key === 'google_business' || key === 'gmb' || key === 'google') return 'googlebusiness'
  if (key === 'youtube_channel') return 'youtube'
  return key
}

/* ── The grid ───────────────────────────────────────────────────────────── */

/** The little this grid needs to know about an account already connected. */
export interface ConnectedAccountSummary {
  platform: string
  health: ConnectionHealth
  /** Display name or handle, when there is one. Shown when it is the only one. */
  name?: string
}

interface PlatformGridProps {
  /** Everything already connected for THIS business. Never another business's. */
  accounts: ConnectedAccountSummary[]
  onSelect: (platform: ConnectablePlatform) => void
  /** The tile currently being started, if any. */
  busySlug?: string | null
  /** True while any connection is mid-flight — the others stop taking clicks. */
  disabled?: boolean
}

/**
 * The worst state wins.
 *
 * With two Instagram accounts, one healthy and one expiring, the tile has to
 * read as the expiring one. Averaging them, or taking the first, is how the
 * desk came to show ten accounts as healthy while two of them were not.
 */
function worstHealth(healths: ConnectionHealth[]): ConnectionHealth {
  if (healths.includes('reconnect')) return 'reconnect'
  if (healths.includes('attention')) return 'attention'
  if (healths.includes('unknown')) return 'unknown'
  return 'connected'
}

export function PlatformGrid({ accounts, onSelect, busySlug, disabled }: PlatformGridProps) {
  const byPlatform = new Map<string, ConnectedAccountSummary[]>()
  for (const account of accounts) {
    const key = normalisePlatform(account.platform)
    const list = byPlatform.get(key)
    if (list) list.push(account)
    else byPlatform.set(key, [account])
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CONNECTABLE_PLATFORMS.map((platform) => {
        const mine = byPlatform.get(platform.slug) ?? []
        const busy = busySlug === platform.slug
        const health = mine.length > 0 ? worstHealth(mine.map((a) => a.health)) : null
        const detail =
          mine.length > 1
            ? `${mine.length} accounts`
            : (mine[0]?.name ?? undefined)

        return (
          <li key={platform.slug}>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => onSelect(platform)}
              className="flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:opacity-60"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                borderLeftWidth: 3,
                borderLeftColor: platform.mark,
              }}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[11px] font-semibold"
                style={{ background: platform.mark, color: 'oklch(1 0 0)' }}
                aria-hidden
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : platform.label.charAt(0)}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13px] font-semibold"
                  style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
                >
                  {platform.label}
                </span>
                {health ? (
                  <HealthBadge health={health} {...(detail ? { detail } : {})} />
                ) : (
                  <span
                    className="block truncate text-[11.5px]"
                    style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                  >
                    {platform.note ?? 'Not connected yet'}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
