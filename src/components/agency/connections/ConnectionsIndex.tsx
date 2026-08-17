'use client'

import { useEffect, useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useSocialAccounts } from '@/hooks/useSocialAccounts'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

// ── Platform identity ──────────────────────────────────────────────────────────
// Fixed brand colours, never from --brand (these are platform assets).

const PLATFORM_BG: Record<string, string> = {
  facebook:  'oklch(0.48 0.19 265)',
  instagram: 'oklch(0.55 0.21 15)',
  tiktok:    'oklch(0.25 0.02 240)',
  youtube:   'oklch(0.53 0.22 27)',
  linkedin:  'oklch(0.45 0.14 245)',
  twitter:   'oklch(0.25 0.02 240)',
  x:         'oklch(0.25 0.02 240)',
  website:   'oklch(0.46 0.10 205)',
  canva:     'oklch(0.55 0.15 195)',
  google:    'oklch(0.52 0.16 145)',
  code:      'oklch(0.36 0.03 240)',
  email:     'oklch(0.50 0.13 300)',
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  tiktok:    'TikTok',
  youtube:   'YouTube',
  linkedin:  'LinkedIn',
  twitter:   'X / Twitter',
  x:         'X',
  website:   'Your website',
  canva:     'Canva',
  google:    'Google',
  code:      'Code & hosting',
  email:     'Email',
}

const PLATFORM_INITIALS: Record<string, string> = {
  facebook:  'f',
  instagram: 'IG',
  tiktok:    '♪',
  youtube:   '▶',
  linkedin:  'in',
  twitter:   'X',
  x:         'X',
  website:   '◉',
  canva:     '◫',
  google:    'G',
  code:      '<>',
  email:     '✉',
}

const PLATFORM_DESC_CONNECTED: Record<string, string> = {
  facebook:  'Posts, photos and videos go out here. Comments and messages come back under Engagement.',
  instagram: 'Images and Reels go out here. Comments and messages come back under Engagement.',
  youtube:   'Long videos and Shorts go out here, with titles written for what people search.',
  tiktok:    'Short videos go out here and you can see what each one earns.',
  linkedin:  'Posts and articles go out to professionals and referral networks.',
  twitter:   'Posts go out to your followers here.',
  x:         'Posts go out to your followers here.',
  website:   'Reads every page, watches how fast it loads on a phone.',
  canva:     'Your designs appear in the media library, and new images can be made in your own colours.',
  google:    'Search queries, positions and your listing come in here.',
  code:      'Changes to the site can be made and put live from here.',
  email:     'Newsletters and updates go from your own address, and you see who opened them.',
}

const PLATFORM_DESC_DISCONNECTED: Record<string, string> = {
  facebook:  'Once connected, posts and videos go out here, and comments come back to you.',
  instagram: 'Once connected, images and Reels go out here, and comments come back to you.',
  youtube:   'Once connected, long videos and Shorts go out here with search-ready titles.',
  tiktok:    'Once connected, short videos you already have can go out here and you will see what each earns.',
  linkedin:  'Once connected, the business can post to professionals — where referrals often come from.',
  twitter:   'Once connected, posts go out to your followers here.',
  x:         'Once connected, posts go out to your followers here.',
  website:   'Once connected, every page is read, load speed is measured, and blog posts can be published to it.',
  canva:     'Once connected, your Canva designs appear in your media library, and new images can be made in your own colours and fonts.',
  google:    'Once connected, you will see what people actually searched to find you, and your listing and reviews come in here.',
  code:      'Only if someone builds your website for you. Once connected, changes to the site can be made and put live here.',
  email:     'Once connected, newsletters and updates go from your own address, and you see who opened them.',
}

const ALL_SOCIAL = ['facebook', 'instagram', 'youtube', 'tiktok', 'linkedin']
const ALL_OTHER = ['website', 'email', 'google', 'canva', 'code']

// ── Shared primitives ──────────────────────────────────────────────────────────

function Mark({ platform }: { platform: string }) {
  return (
    <span
      style={{
        width: 34, height: 34, borderRadius: 10,
        display: 'grid', placeItems: 'center',
        background: PLATFORM_BG[platform] ?? 'var(--panel-2)',
        color: 'oklch(1 0 0)', font: '600 13px/1 var(--font-sans)',
        flexShrink: 0,
      }}
    >
      {PLATFORM_INITIALS[platform] ?? platform.slice(0, 2).toUpperCase()}
    </span>
  )
}

type TileStatus = 'connected' | 'stopped' | 'disconnected'

function StatusPill({ status }: { status: TileStatus }) {
  const map: Record<TileStatus, { label: string; bg: string; ink: string; dot: string }> = {
    connected:    { label: 'Connected',       bg: 'var(--ok-wash)',   ink: 'var(--ok)',   dot: 'var(--ok)' },
    stopped:      { label: 'Stopped working', bg: 'var(--care-wash)', ink: 'var(--care)', dot: 'var(--care)' },
    disconnected: { label: 'Not connected',   bg: 'var(--panel-2)',   ink: 'var(--ink-3)', dot: 'var(--ink-3)' },
  }
  const s = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: 12, fontWeight: 650,
      padding: '4px 9px', borderRadius: 7, alignSelf: 'flex-start',
      border: `1px solid ${status === 'stopped' ? 'var(--care-line)' : 'transparent'}`,
      background: s.bg, color: s.ink,
    }}>
      <i style={{ width: 7, height: 7, borderRadius: '50%', display: 'block', background: s.dot, flexShrink: 0, fontStyle: 'normal' }} />
      {s.label}
    </span>
  )
}

interface TileProps {
  platform: string
  label?: string
  handle?: string
  status: TileStatus
  description: string
  careNote?: string
  stamp?: string
  onManage?: () => void
  onConnect?: () => void
  connectLabel?: string
}

function ConnectionTile({ platform, label, handle, status, description, careNote, stamp, onManage, onConnect, connectLabel }: TileProps) {
  const isStopped = status === 'stopped'
  return (
    <div style={{
      background: 'var(--panel)',
      border: `1px solid ${isStopped ? 'var(--care-line)' : 'var(--line)'}`,
      borderRadius: 13, padding: '15px 15px 14px',
      display: 'flex', flexDirection: 'column', gap: 9,
      boxShadow: isStopped
        ? '0 0 0 1px var(--care-line), var(--nrs-shadow)'
        : 'var(--nrs-shadow)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Mark platform={platform} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: 'block', fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em' }}>
            {label ?? PLATFORM_LABEL[platform] ?? platform}
          </b>
          {handle && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {handle}
            </span>
          )}
        </span>
      </div>

      <StatusPill status={status} />

      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        {description}
      </p>

      {/* Healthcare guardrail — only when regulated */}
      {careNote && (
        <div style={{
          display: 'flex', gap: 7, alignItems: 'flex-start',
          background: 'var(--care-wash)', border: '1px solid var(--care-line)',
          borderRadius: 8, padding: '7px 9px',
          fontSize: 11.5, color: 'var(--care)', lineHeight: 1.4,
        }}>
          <span style={{ flexShrink: 0 }}>⚕</span>
          <span>{careNote}</span>
        </div>
      )}

      {stamp && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {stamp}
        </p>
      )}

      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 3 }}>
        {status === 'connected' && onManage && (
          <button
            type="button"
            onClick={onManage}
            style={{
              width: '100%', border: '1px solid var(--line)',
              borderRadius: 9, padding: '10px 15px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
              background: 'var(--panel)', color: 'var(--ink-2)',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            Manage
          </button>
        )}
        {(status === 'disconnected' || status === 'stopped') && onConnect && (
          <>
            <button
              type="button"
              onClick={onConnect}
              style={{
                width: '100%', border: 0,
                borderRadius: 9, padding: '10px 15px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
                background: isStopped ? 'var(--care)' : 'var(--brand-deep)',
                color: 'oklch(1 0 0)',
                fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {connectLabel ?? `Connect ${PLATFORM_LABEL[platform] ?? platform}`}
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', margin: '7px 0 0' }}>
              {isStopped ? 'We will ask you to sign in. Takes about a minute.' : 'We will ask you to sign in.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Broken account callout ────────────────────────────────────────────────────

interface BrokeProps {
  platform: string
  handle: string
  stoppedAt?: string
  waitingCount?: number
  onReconnect: () => void
  onSeePosts?: () => void
}

function BrokeBlock({ platform, handle, stoppedAt, waitingCount, onReconnect, onSeePosts }: BrokeProps) {
  return (
    <section style={{
      border: '1px solid var(--care-line)', borderLeft: '4px solid var(--care)',
      background: 'var(--care-wash)', borderRadius: 14,
      padding: '18px 20px 17px', marginBottom: 26,
      boxShadow: 'var(--nrs-shadow)',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--care)', marginBottom: 9,
      }}>
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--care)', display: 'block', fontStyle: 'normal' }} />
        Needs you today
      </div>

      <h2 style={{ fontSize: 17.5, fontWeight: 650, letterSpacing: '-0.015em', margin: '0 0 6px', color: 'var(--ink)' }}>
        {PLATFORM_LABEL[platform] ?? platform} has stopped working
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 11px' }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
          background: PLATFORM_BG[platform] ?? 'var(--panel-2)',
          color: 'oklch(1 0 0)', fontSize: 12, flexShrink: 0,
        }}>
          {PLATFORM_INITIALS[platform] ?? platform.slice(0, 2).toUpperCase()}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          {handle}{stoppedAt ? ` · stopped ${stoppedAt}` : ''}
        </span>
      </div>

      <p style={{ margin: '0 0 9px', fontSize: 13.5, color: 'var(--ink-2)', maxWidth: '70ch' }}>
        {PLATFORM_LABEL[platform]} asked for your sign-in again after a security change on their side.
        Until you sign back in, <b style={{ color: 'var(--ink)' }}>nothing can go out to this account</b> and nothing can come back in from it.
      </p>

      {(waitingCount ?? 0) > 0 && (
        <div style={{
          display: 'flex', gap: 9, alignItems: 'flex-start',
          background: 'var(--panel)', border: '1px solid var(--care-line)',
          borderRadius: 10, padding: '11px 13px', margin: '12px 0 14px',
          fontSize: 13, color: 'var(--ink-2)', maxWidth: '70ch',
        }}>
          <span>⚠</span>
          <span>
            <b style={{ color: 'var(--ink)' }}>{waitingCount} post{waitingCount === 1 ? '' : 's'} have been waiting.</b>{' '}
            They were never published and they were never lost — they are still sitting as drafts. Sign back in and you choose whether to send them now or leave them.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onReconnect}
          style={{
            border: 0, borderRadius: 9, padding: '10px 15px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'var(--care)', color: 'oklch(1 0 0)',
            fontFamily: 'var(--font-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 7,
          }}
        >
          Reconnect {PLATFORM_LABEL[platform] ?? platform}
        </button>
        {onSeePosts && (waitingCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={onSeePosts}
            style={{
              border: '1px solid var(--line)', borderRadius: 9, padding: '10px 15px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'var(--panel)', color: 'var(--ink-2)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            See the {waitingCount} post{waitingCount === 1 ? '' : 's'} waiting
          </button>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '10px 0 0' }}>
        We will ask you to sign in to {PLATFORM_LABEL[platform]}. It takes about a minute and you keep every past post, comment and figure.
      </p>
    </section>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function SectionBlock({
  title, count, say, children,
}: { title: string; count?: string; say?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h3 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>{title}</h3>
        {count && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
      </div>
      {say && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 13px', maxWidth: '64ch' }}>{say}</p>}
      {children}
    </section>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface ConnectionsIndexProps {
  brand: Brand | null
}

export function ConnectionsIndex({ brand }: ConnectionsIndexProps) {
  const { activeBrandId } = useAgencyStore()
  const { accounts, loading: accountsLoading } = useSocialAccounts(activeBrandId)

  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null)
  const [, setCanvaLoading] = useState(true)

  const isHealthcare = !!(
    brand?.compliance_flags?.ahpra || brand?.compliance_flags?.tga
  )
  const websiteUrl = brand?.website_url ?? null

  useEffect(() => {
    fetch('/api/canva/brand-kits', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        setCanvaConnected(!!(r.ok && data.connected === true))
      })
      .catch(() => setCanvaConnected(false))
      .finally(() => setCanvaLoading(false))
  }, [])

  // Build social tiles
  const socialTiles = ALL_SOCIAL.map((platform) => {
    const account = accounts.find((a) => {
      const p = a.platform.replace(/_(page|group|business)$/, '')
      return p === platform
    })

    if (account) {
      const isStopped = account.status === 'expired' || account.status === 'revoked'
      return {
        platform,
        handle: account.username || account.name,
        status: (isStopped ? 'stopped' : 'connected') as TileStatus,
        description: PLATFORM_DESC_CONNECTED[platform] ?? '',
        careNote: isHealthcare ? 'Every post is checked against AHPRA and TGA before it goes out.' : undefined,
        stamp: isStopped ? undefined : 'Working',
        onManage: () => { window.location.href = '/agency/connections/social' },
        onConnect: isStopped ? () => sendToDirector(`Help me reconnect ${PLATFORM_LABEL[platform]}`) : undefined,
        connectLabel: isStopped ? `Reconnect ${PLATFORM_LABEL[platform]}` : undefined,
      }
    }

    return {
      platform,
      status: 'disconnected' as TileStatus,
      description: PLATFORM_DESC_DISCONNECTED[platform] ?? '',
      onConnect: () => { window.location.href = '/agency/connections/social' },
    }
  })

  const stoppedTiles = socialTiles.filter((t) => t.status === 'stopped')

  // Build "everything else" tiles
  const otherTiles: TileProps[] = [
    {
      platform: 'website',
      handle: websiteUrl ?? undefined,
      status: websiteUrl ? 'connected' : 'disconnected',
      description: websiteUrl
        ? PLATFORM_DESC_CONNECTED.website
        : PLATFORM_DESC_DISCONNECTED.website,
      careNote: isHealthcare && websiteUrl ? 'Blog posts are checked against AHPRA and TGA before they publish.' : undefined,
      stamp: websiteUrl ? undefined : undefined,
      onManage: websiteUrl ? () => { window.location.href = '/agency/website' } : undefined,
      onConnect: websiteUrl ? undefined : () => sendToDirector('Add my website so NRS can read it'),
      connectLabel: websiteUrl ? undefined : 'Add your website URL',
    },
    {
      platform: 'email',
      status: 'disconnected',
      description: PLATFORM_DESC_DISCONNECTED.email,
      onConnect: () => sendToDirector('Set up email for this business'),
    },
    {
      platform: 'google',
      status: 'disconnected',
      description: PLATFORM_DESC_DISCONNECTED.google,
      onConnect: () => { window.location.href = '/agency/google' },
      connectLabel: 'Connect Google',
    },
    {
      platform: 'canva',
      status: canvaConnected === null ? 'disconnected' : canvaConnected ? 'connected' : 'disconnected',
      description: canvaConnected ? PLATFORM_DESC_CONNECTED.canva : PLATFORM_DESC_DISCONNECTED.canva,
      onManage: canvaConnected ? () => sendToDirector('Show me my Canva designs') : undefined,
      onConnect: canvaConnected ? undefined : () => { window.location.href = '/api/canva/auth' },
    },
    {
      platform: 'code',
      status: 'disconnected',
      description: PLATFORM_DESC_DISCONNECTED.code,
      onConnect: () => sendToDirector('Connect our code repository so NRS can help deploy changes'),
    },
  ]

  // Tallies
  const socialWorking = socialTiles.filter((t) => t.status === 'connected').length
  const socialStopped = socialTiles.filter((t) => t.status === 'stopped').length
  const socialOff = socialTiles.filter((t) => t.status === 'disconnected').length
  const otherWorking = otherTiles.filter((t) => t.status === 'connected').length
  const otherOff = otherTiles.filter((t) => t.status === 'disconnected').length

  if (accountsLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>Connections</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>Checking connections…</p>
      </div>
    )
  }

  const socialCountText = [
    socialWorking > 0 ? `${socialWorking} working` : '',
    socialStopped > 0 ? `${socialStopped} stopped` : '',
    socialOff > 0 ? `${socialOff} not connected` : '',
  ].filter(Boolean).join(' · ')

  const otherCountText = [
    otherWorking > 0 ? `${otherWorking} working` : '',
    otherOff > 0 ? `${otherOff} not connected` : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        Connections
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 14px', maxWidth: '66ch' }}>
        Everything plugged in. Connect something and the work it unlocks starts the same day — nothing here needs setting up twice.
      </p>

      {/* Honest tally */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        fontSize: 12.5, color: 'var(--ink-2)',
        border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 10,
        padding: '9px 14px', marginBottom: 20,
      }}>
        {socialWorking + otherWorking > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0, fontStyle: 'normal' }} />
            <b style={{ color: 'var(--ink)', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{socialWorking + otherWorking}</b> working
          </span>
        )}
        {socialStopped > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--care)', flexShrink: 0, fontStyle: 'normal' }} />
            <b style={{ color: 'var(--ink)', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{socialStopped}</b> stopped working
          </span>
        )}
        {socialOff + otherOff > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)', opacity: 0.55, flexShrink: 0, fontStyle: 'normal' }} />
            <b style={{ color: 'var(--ink)', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{socialOff + otherOff}</b> not connected yet
          </span>
        )}
      </div>

      {/* Broken accounts — loudest thing on the screen */}
      {stoppedTiles.map((tile) => (
        <BrokeBlock
          key={tile.platform}
          platform={tile.platform}
          handle={tile.handle ?? 'your account'}
          onReconnect={() => { window.location.href = '/agency/connections/social' }}
          onSeePosts={() => { window.location.href = '/agency/social/posts' }}
        />
      ))}

      {/* Social accounts */}
      <SectionBlock
        title="Social accounts"
        count={socialCountText}
        say="Each account is separate. Connecting one has no effect on the others, and you can remove any of them at any time."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 13 }}>
          {socialTiles.map((tile) => (
            <ConnectionTile key={tile.platform} {...tile} />
          ))}
        </div>
      </SectionBlock>

      {/* Everything else */}
      <SectionBlock
        title="Everything else"
        count={otherCountText}
        say="These are not for posting. They are how NRS sees your website, your pictures, your search results and your emails."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 13 }}>
          {otherTiles.map((tile) => (
            <ConnectionTile key={tile.platform} {...tile} />
          ))}
        </div>
      </SectionBlock>
    </div>
  )
}
