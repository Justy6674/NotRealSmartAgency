'use client'

import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

// ── Shared primitives ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 13, padding: '15px 16px 14px', marginBottom: 14,
      boxShadow: 'var(--nrs-shadow)', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 13, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 3px', color: 'var(--ink)' }}>{title}</h2>
      {sub && <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{sub}</p>}
    </div>
  )
}

function DisconnectedState({
  icon, title, body, buttonLabel, onAsk,
}: { icon: string; title: string; body: string; buttonLabel: string; onAsk: () => void }) {
  return (
    <Card>
      <div style={{ padding: '10px 0 6px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
        <h3 style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--ink)' }}>{title}</h3>
        <p style={{ margin: '0 auto 16px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '52ch' }}>{body}</p>
        <button
          type="button"
          onClick={onAsk}
          style={{
            fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-3)', width: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? 'var(--ink)' : 'var(--ink-3)', fontStyle: value ? 'normal' : 'italic' }}>
        {value || 'Not connected'}
      </span>
    </div>
  )
}

// ── Google listing status ─────────────────────────────────────────────────────

function GoogleListingCard({ brand }: { brand: Brand }) {
  const websiteUrl = brand.website_url

  if (!websiteUrl) {
    return (
      <DisconnectedState
        icon="🔍"
        title="Google listing not connected"
        body="Once your website is added, this section shows your Google Business Profile — your listing on Google Maps, your reviews, and whether your opening hours are showing correctly."
        buttonLabel="✦ Ask the Director to set this up"
        onAsk={() => sendToDirector('How do I get this business showing up on Google? Help me set up the Google listing.')}
      />
    )
  }

  return (
    <Card>
      <SectionHead
        title="Google listing"
        sub="How this business appears when someone searches for it by name or by what it does."
      />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{
          flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 10,
          padding: '12px 14px', background: 'var(--panel-2)',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 6 }}>
            Listing status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)' }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', display: 'block', flexShrink: 0, fontStyle: 'normal' }} />
            Not verified yet
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            Connect Google Search Console to see real data here.
          </p>
        </div>
        <div style={{
          flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 10,
          padding: '12px 14px', background: 'var(--panel-2)',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 6 }}>
            Reviews
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            Connect to see reviews
          </div>
        </div>
      </div>
      <InfoRow label="Website" value={websiteUrl} />
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => sendToDirector('Help me connect Google Search Console and Google Business Profile so I can see how people find this business.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          ✦ Connect Google
        </button>
      </div>
    </Card>
  )
}

// ── What people search ────────────────────────────────────────────────────────

function SearchQueriesCard() {
  return (
    <DisconnectedState
      icon="📊"
      title="What people actually search"
      body="Once Google Search Console is connected, this section shows the exact words people typed to find this business, and how many clicked through to the site. No guessing — real searches."
      buttonLabel="✦ Connect Google Search Console"
      onAsk={() => sendToDirector('Help me set up Google Search Console so I can see what people search to find this business.')}
    />
  )
}

// ── Website appearance in search ─────────────────────────────────────────────

function AppearanceCard({ brand }: { brand: Brand }) {
  const websiteUrl = brand.website_url

  if (!websiteUrl) {
    return (
      <Card>
        <SectionHead title="How the website looks in results" sub="The title and description shown on the search page before anyone clicks." />
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Add the website URL first. Once it is in, this section reads the page titles and meta descriptions and shows exactly what a searcher sees before clicking.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('Add the website URL for this business so we can check how it looks in search results.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Add the website
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHead
        title="How the website looks in results"
        sub="The title and description shown on Google before a visitor clicks."
      />
      <div style={{
        border: '1px solid var(--line)', borderRadius: 10, padding: 14,
        background: 'var(--panel-2)', marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>
          {websiteUrl}
        </div>
        <div style={{ fontSize: 16, color: 'oklch(0.38 0.17 255)', fontWeight: 500, marginBottom: 4 }}>
          {brand.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {brand.description ?? (
            <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
              No description set yet — Google will generate one automatically, which is usually worse than a written one.
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => sendToDirector('Review the website\'s page titles and meta descriptions. Help me write ones that will make more people click from Google.')}
        style={{
          fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
          border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
        }}
      >
        ✦ Review search appearance
      </button>
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface GoogleSearchabilityDeptProps {
  brand: Brand | null
}

export function GoogleSearchabilityDept({ brand }: GoogleSearchabilityDeptProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        Google searchability
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '66ch' }}>
        What happens when someone searches for this business — or for what it sells — on Google. Not predictions. Real data when connected.
      </p>

      <GoogleListingCard brand={brand ?? { website_url: null } as Brand} />
      <SearchQueriesCard />
      <AppearanceCard brand={brand ?? { website_url: null } as Brand} />
    </div>
  )
}
