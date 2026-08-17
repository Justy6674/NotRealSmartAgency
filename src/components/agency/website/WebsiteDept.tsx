'use client'

import Link from 'next/link'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'

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
    <div style={{ marginBottom: 12, paddingBottom: 9, borderBottom: '1px solid var(--line-soft)' }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 3px', color: 'var(--ink)' }}>{title}</h2>
      {sub && <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{sub}</p>}
    </div>
  )
}

// ── Website connected state ───────────────────────────────────────────────────

function WebsiteConnectedCard({ url }: { url: string }) {
  return (
    <Card>
      <SectionHead title="Your website" sub="Connected and being watched." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
          background: 'oklch(0.46 0.10 205)', color: 'oklch(1 0 0)', fontSize: 13,
          flexShrink: 0,
        }}>◉</div>
        <div>
          <b style={{ display: 'block', fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>
            {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </b>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', display: 'block', fontStyle: 'normal' }} />
            Connected
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => sendToDirector('Scan my website and tell me what needs to improve — speed, pages, how it reads on a phone, and anything that would put a visitor off.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Scan the website
        </button>
        <Link
          href="/agency/website/pages"
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 9,
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
            textDecoration: 'none', display: 'inline-block',
          }}
        >
          View pages
        </Link>
      </div>
    </Card>
  )
}

function WebsiteDisconnectedCard() {
  return (
    <Card>
      <div style={{ padding: '12px 0 4px', textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🌐</div>
        <h2 style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--ink)' }}>
          Website not connected yet
        </h2>
        <p style={{ margin: '0 auto 16px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: '52ch' }}>
          Add the website URL and the Director can read every page, check how fast it loads on a phone, and tell you exactly what would make more visitors stay and buy.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => sendToDirector('Add my website so NRS can read it and help improve it.')}
            style={{
              fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: 9,
              border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
            }}
          >
            ✦ Add website URL
          </button>
        </div>
      </div>
    </Card>
  )
}

// ── Vitals ────────────────────────────────────────────────────────────────────

function VitalsCard({ hasWebsite }: { hasWebsite: boolean }) {
  if (!hasWebsite) return null

  return (
    <Card>
      <SectionHead
        title="How fast it loads"
        sub="Checked weekly on a real mobile connection. These numbers directly affect whether someone stays."
      />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Load time (mobile)', value: 'Not measured yet', note: 'Under 3 seconds is the target' },
          { label: 'Largest element', value: 'Not measured yet', note: 'Should appear under 2.5s' },
          { label: 'Layout shift', value: 'Not measured yet', note: 'Lower is better' },
        ].map((v) => (
          <div key={v.label} style={{
            flex: '1 1 160px', border: '1px solid var(--line)', borderRadius: 10,
            padding: '11px 12px', background: 'var(--panel-2)',
          }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 5 }}>
              {v.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 650, color: 'var(--ink-2)', marginBottom: 3 }}>{v.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{v.note}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
        Run a scan to get real figures.
      </p>
    </Card>
  )
}

// ── Quick wins ────────────────────────────────────────────────────────────────

function QuickWinsCard({ hasWebsite }: { hasWebsite: boolean }) {
  return (
    <Card>
      <SectionHead
        title="Conversion opportunities"
        sub="Things that would make more visitors take action — contact, book, or buy."
      />
      {!hasWebsite ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Connect the website first. Once connected, the Director reads every page and picks out the three changes that would make the biggest difference.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 9, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            <span>📋</span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Run a scan to see where visitors are dropping off and what to fix first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => sendToDirector('Scan my website for conversion opportunities. What are the top three changes that would make more visitors take action?')}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 9, marginTop: 4,
              border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            ✦ Find conversion opportunities
          </button>
        </div>
      )}
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function WebsiteDept() {
  const { activeBrandId } = useAgencyStore()
  const { brand, loading } = useStudioData(activeBrandId)

  if (loading || !brand) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>Website</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>Loading…</p>
      </div>
    )
  }

  const websiteUrl = brand.website_url
  const hasWebsite = !!websiteUrl

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        Website
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '66ch' }}>
        How the website performs and what would make it convert more visitors. No plumbing — just what matters.
      </p>

      {hasWebsite ? <WebsiteConnectedCard url={websiteUrl} /> : <WebsiteDisconnectedCard />}
      <VitalsCard hasWebsite={hasWebsite} />
      <QuickWinsCard hasWebsite={hasWebsite} />
    </div>
  )
}
