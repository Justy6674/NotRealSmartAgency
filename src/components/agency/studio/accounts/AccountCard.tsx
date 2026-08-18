'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, MoreHorizontal, Pencil, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { healthWording } from '@/components/agency/social/connect/ConnectStatus'
import { PlatformMark, presentationFor } from './PlatformMark'
import type { SocialAccount } from '@/hooks/useSocialAccounts'

interface AccountCardProps {
  account: SocialAccount
  onManage?: (account: SocialAccount) => void
  onRename?: (account: SocialAccount) => void
  onReconnect?: (account: SocialAccount) => void
  onRemove?: (account: SocialAccount) => void
}

/**
 * One connected account, as a panel in the grid — Mixpost's shape, with the
 * one thing Mixpost's card does not carry: whether this account is about to
 * stop working.
 *
 * ── The dot is the point ───────────────────────────────────────────────
 * This card used to draw a green tick whenever `status === 'active'`, and the
 * hook stamped `'active'` on every account it ever returned. So the tick was
 * decoration: it went green for a dead connection exactly as readily as for a
 * live one. Two accounts were in warning on the live desk while this card drew
 * ten ticks.
 *
 * The four states below are the ones the publisher can actually distinguish,
 * and each says what the owner should DO, not what the system observed.
 * `unknown` is deliberately not folded into `connected` — an unmeasured
 * connection reads as unmeasured, because the alternative is the lie this
 * rewrite exists to remove.
 *
 * ── An unhealthy card is a different object, not a well one with a note ─
 * Health used to be a 12px dot on a card otherwise identical to its
 * neighbours. Scanning fourteen of those for one amber pixel is a job nobody
 * does, so the failure was found by a publish failing instead. Now the ring
 * round the avatar, the card's border, its fill and its left accent all move
 * together, and the reconnect button is on the card rather than two clicks
 * inside a menu. The platform badge — which stays put — is what says WHICH
 * account this is, so the colour is free to mean only one thing.
 *
 * ── One vocabulary, in one place ───────────────────────────────────────
 * The four words come from `healthWording` in the connect folder rather than
 * being written again here. Two screens describing the same connection in
 * nearly-but-not-quite the same words is how "active" survived on this card
 * for as long as it did; the sentences below it are this card's own, because
 * they tell the owner what to DO, which is a different job from naming a state.
 */

type Tone = {
  /** The ring around the avatar and the card's left accent. */
  edge: string
  /** Card fill. Paper for a working account; a wash for one that is not. */
  wash: string
  /** Card border. */
  line: string
  label: string
  detail: string
}

export function toneFor(account: SocialAccount): Tone {
  switch (account.health) {
    case 'reconnect':
      return {
        edge: 'var(--stop, oklch(0.55 0.17 27))',
        wash: 'oklch(0.55 0.17 27 / 0.06)',
        line: 'oklch(0.55 0.17 27 / 0.35)',
        label: healthWording('reconnect'),
        detail: 'Nothing will go out from this account until you sign in to it again.',
      }
    case 'attention':
      return {
        edge: 'var(--warn, oklch(0.63 0.13 75))',
        wash: 'var(--warn-wash, oklch(0.964 0.052 80))',
        line: 'oklch(0.63 0.13 75 / 0.45)',
        label: healthWording('attention'),
        detail: 'This one still works, but it will stop unless you reconnect it.',
      }
    case 'connected':
      return {
        edge: 'var(--ok, oklch(0.55 0.13 155))',
        wash: 'var(--panel, oklch(1 0 0))',
        line: 'var(--line, oklch(0.915 0.007 240))',
        label: healthWording('connected'),
        detail: '',
      }
    default:
      return {
        edge: 'var(--ink-3, oklch(0.615 0.011 240))',
        wash: 'var(--panel, oklch(1 0 0))',
        line: 'var(--line, oklch(0.915 0.007 240))',
        label: healthWording('unknown'),
        detail: 'We could not check this account just now, so nothing is being claimed about it.',
      }
  }
}

/** "Added 4 March 2026" — never a raw timestamp. */
function addedOn(iso?: string): string | null {
  if (!iso) return null
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "in 6 days" / "on 3 September" — how long is left, not an expiry stamp. */
function lapsesIn(iso?: string): string | null {
  if (!iso) return null
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  const days = Math.round((when.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'already'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 30) return `in ${days} days`
  return `on ${when.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`
}

export function AccountCard({ account, onManage, onRename, onReconnect, onRemove }: AccountCardProps) {
  const platform = presentationFor(account.platform)
  const tone = toneFor(account)
  const wellEnough = account.health === 'connected' || account.health === 'unknown'
  const added = addedOn(account.connectedAt)
  const lapses = account.health !== 'connected' ? lapsesIn(account.expiresAt) : null

  const [menuOpen, setMenuOpen] = useState(false)
  /**
   * Platform avatars are hosted by the platform, and a lapsed connection is
   * exactly when they start answering 403. An empty circle on the one card
   * that needs attention is the worst place to lose the picture, so a failed
   * avatar falls back to the initial rather than to nothing.
   */
  const [avatarFailed, setAvatarFailed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const away = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [menuOpen])

  const item =
    'flex w-full items-center gap-2 px-3 py-[7px] text-left text-[12.5px] transition-colors hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]'

  return (
    <div
      className="group relative rounded-xl border p-4 transition-shadow hover:shadow-sm"
      style={{
        borderColor: tone.line,
        background: tone.wash,
        borderLeftWidth: 3,
        borderLeftColor: wellEnough ? platform.colour : tone.edge,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className="relative h-11 w-11 overflow-hidden rounded-full"
            style={{
              background: 'var(--panel-2, oklch(0.975 0.004 240))',
              borderWidth: 2,
              borderStyle: 'solid',
              // The ring is health, not platform. The badge below says platform.
              borderColor: tone.edge,
            }}
          >
            {account.image && !avatarFailed ? (
              <Image
                src={account.image}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[13px] font-semibold"
                style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
              >
                {account.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Mixpost's provider badge, bottom-right of the avatar. */}
          <PlatformMark
            platform={account.platform}
            size={18}
            ringed
            className="absolute -bottom-0.5 -right-0.5"
          />
          <span className="sr-only">{`${platform.label} — ${tone.label}`}</span>
        </div>

        <div className="min-w-0 flex-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            {platform.label}
          </span>
          <h3
            className="truncate text-[13.5px] font-semibold"
            style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
          >
            {account.name}
          </h3>
          {account.username ? (
            <p className="truncate text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
              @{account.username}
            </p>
          ) : null}
          {added || typeof account.followers === 'number' ? (
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
              {[
                added ? `Added ${added}` : null,
                typeof account.followers === 'number'
                  ? `${account.followers.toLocaleString('en-AU')} followers`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Options for ${account.name}`}
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 transition-colors hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border py-1 shadow-lg"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink, oklch(0.20 0.014 240))',
              }}
            >
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => { setMenuOpen(false); onReconnect?.(account) }}
              >
                <RefreshCw className="h-3.5 w-3.5" style={{ color: 'var(--ink-3)' }} />
                Reconnect
              </button>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => { setMenuOpen(false); onManage?.(account) }}
              >
                <Settings2 className="h-3.5 w-3.5" style={{ color: 'var(--ink-3)' }} />
                Settings for this account
              </button>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => { setMenuOpen(false); onRename?.(account) }}
              >
                <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--ink-3)' }} />
                Rename on this desk
              </button>
              {account.profileUrl ? (
                <a
                  href={account.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  role="menuitem"
                  className={item}
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--ink-3)' }} />
                  View on {platform.label}
                </a>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={item}
                style={{ color: 'var(--stop, oklch(0.55 0.17 27))' }}
                onClick={() => { setMenuOpen(false); onRemove?.(account) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect from this business
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Health strip. Rendered for everything except a plainly working
          account, where a line saying "Working" is noise the owner has to read
          past ten times to find the one that is not. */}
      {account.health !== 'connected' ? (
        <div className="mt-3">
          <p
            className="text-[12px] font-semibold"
            style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
          >
            {tone.label}
            {lapses ? ` — ${lapses === 'already' ? 'it has already lapsed' : `lapses ${lapses}`}` : ''}
          </p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            {account.issues[0] ?? tone.detail}
          </p>
          {account.health === 'reconnect' || account.health === 'attention' ? (
            <button
              type="button"
              onClick={() => onReconnect?.(account)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-[6px] text-[12px] font-semibold transition-colors"
              style={{
                background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                color: 'var(--brand-ink, oklch(1 0 0))',
              }}
            >
              <RefreshCw className="h-3 w-3" />
              Reconnect {platform.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* An account the owner never switched on is skipped by posting and by
          the schedule. Silence about that is how a post "goes out" to nobody. */}
      {account.enabled === false ? (
        <p
          className="mt-2 text-[11.5px]"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          Switched off — posts and scheduled items skip this account.
        </p>
      ) : null}
    </div>
  )
}
