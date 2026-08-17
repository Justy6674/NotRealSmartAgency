'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Competitor } from '@/types/database'

const CATEGORY_LABEL: Record<string, string> = {
  direct:      'Direct',
  adjacent:    'Adjacent',
  aspirational: 'Aspirational',
  indirect:    'Indirect',
}

// ── Competitor card ───────────────────────────────────────────────────────────

function CompetitorCard({ c }: { c: Competitor }) {
  const category = c.category ?? 'direct'
  const catColour = category === 'direct' ? 'var(--care)' : category === 'aspirational' ? 'var(--brand-deep)' : 'var(--ink-3)'
  const catWash = category === 'direct' ? 'var(--care-wash)' : category === 'aspirational' ? 'var(--brand-wash)' : 'var(--panel-2)'

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 13, padding: '14px 15px 13px',
      boxShadow: 'var(--nrs-shadow)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: 'var(--panel-2)', border: '1px solid var(--line)',
          display: 'grid', placeItems: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--ink-2)',
          letterSpacing: '-0.01em',
        }}>
          {c.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14, fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{c.name}</b>
          {c.url && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {c.url.replace(/^https?:\/\//, '')}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 650, letterSpacing: '0.07em', textTransform: 'uppercase',
          padding: '3px 7px', borderRadius: 6,
          background: catWash, color: catColour, flexShrink: 0,
        }}>
          {CATEGORY_LABEL[category] ?? category}
        </span>
      </div>

      {c.why && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <b style={{ color: 'var(--ink)' }}>Why they matter: </b>{c.why}
        </p>
      )}

      {c.notes && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {c.notes}
        </p>
      )}

      {(c.keywords?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
          {c.keywords!.map((kw) => (
            <span key={kw} style={{
              fontSize: 11.5, padding: '3px 8px', borderRadius: 99,
              border: '1px solid var(--line)', background: 'var(--panel-2)',
              color: 'var(--ink-3)',
            }}>{kw}</span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 7 }}>
        <button
          type="button"
          onClick={() => sendToDirector(`Do a deep competitor scan of ${c.name} (${c.url ?? 'no URL'}). What are they doing well? Where are the gaps I can take advantage of?`)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 8,
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          Deep scan
        </button>
        {c.url && (
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 8,
              border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}
          >
            Visit ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCompetitors() {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 13, padding: '24px 20px 22px', textAlign: 'center',
      boxShadow: 'var(--nrs-shadow)', marginBottom: 14,
    }}>
      <div style={{ fontSize: 34, marginBottom: 12 }}>🔭</div>
      <h2 style={{ fontSize: 15.5, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--ink)' }}>
        No competitors tracked yet
      </h2>
      <p style={{ margin: '0 auto 18px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: '52ch' }}>
        The Director can find who the real competitors are, what they are doing well, and where the gaps are — all from a description of this business.
        No manual research needed.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => sendToDirector('Who are the main competitors for this business? Research them and give me a profile of each one.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Find competitors
        </button>
        <button
          type="button"
          onClick={() => sendToDirector('I want to add a specific competitor to track. Ask me which one.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          Add one manually
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function CompetitorsDept() {
  const { activeBrandId } = useAgencyStore()
  const { brand, loading } = useStudioData(activeBrandId)

  if (loading || !brand) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>Competitors</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>Loading…</p>
      </div>
    )
  }

  const competitors: Competitor[] = brand.competitors ?? []
  const active = competitors.filter((c) => c.is_active !== false)
  const byCategory = {
    direct: active.filter((c) => !c.category || c.category === 'direct'),
    adjacent: active.filter((c) => c.category === 'adjacent'),
    aspirational: active.filter((c) => c.category === 'aspirational'),
    indirect: active.filter((c) => c.category === 'indirect'),
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
            Competitors
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, maxWidth: '66ch' }}>
            Who this business is up against. The Director checks these regularly and flags when they change.
          </p>
        </div>
        {active.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => sendToDirector('Do a fresh competitor scan for all the businesses we track. What has changed recently?')}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8,
                border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
              }}
            >
              ✦ Scan all
            </button>
            <button
              type="button"
              onClick={() => sendToDirector('I want to add another competitor to track. Ask me which one.')}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink-2)', cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {active.length === 0 && <EmptyCompetitors />}

      {byCategory.direct.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, margin: '0 0 10px' }}>
            Direct — {byCategory.direct.length}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 11 }}>
            {byCategory.direct.map((c) => <CompetitorCard key={c.name} c={c} />)}
          </div>
        </section>
      )}

      {byCategory.adjacent.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, margin: '0 0 10px' }}>
            Adjacent — {byCategory.adjacent.length}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 11 }}>
            {byCategory.adjacent.map((c) => <CompetitorCard key={c.name} c={c} />)}
          </div>
        </section>
      )}

      {byCategory.aspirational.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, margin: '0 0 10px' }}>
            Aspirational — {byCategory.aspirational.length}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 11 }}>
            {byCategory.aspirational.map((c) => <CompetitorCard key={c.name} c={c} />)}
          </div>
        </section>
      )}

      {byCategory.indirect.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, margin: '0 0 10px' }}>
            Indirect — {byCategory.indirect.length}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 11 }}>
            {byCategory.indirect.map((c) => <CompetitorCard key={c.name} c={c} />)}
          </div>
        </section>
      )}

      {/* Competitor intelligence note */}
      {active.length > 0 && (
        <div style={{
          border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px',
          background: 'var(--panel-2)', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5,
        }}>
          <b style={{ color: 'var(--ink-2)' }}>Daily monitoring: </b>
          The Director checks these competitors and flags anything that changes — new offers, price changes, new content angles. Check the Inbox if something has been flagged.
        </div>
      )}
    </div>
  )
}
