'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { ToneOfVoice } from '@/types/database'

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

function SectionHead({ title, sub, onAsk }: { title: string; sub?: string; onAsk?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 12, paddingBottom: 9, borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 3px', color: 'var(--ink)' }}>{title}</h2>
        {sub && <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{sub}</p>}
      </div>
      {onAsk && (
        <button
          type="button"
          onClick={() => sendToDirector(onAsk)}
          style={{
            fontSize: 12, fontWeight: 500, padding: '5px 9px', borderRadius: 7,
            border: 0, background: 'none', color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          ✦ Ask Director
        </button>
      )}
    </div>
  )
}

function Chip({ label, variant = 'default' }: { label: string; variant?: 'default' | 'avoid' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12.5, padding: '4px 10px', borderRadius: 99,
      border: '1px solid var(--line)',
      background: variant === 'avoid' ? 'var(--care-wash)' : 'var(--panel-2)',
      color: variant === 'avoid' ? 'var(--care)' : 'var(--ink-2)',
    }}>
      {label}
    </span>
  )
}

const FORMALITY_LABEL: Record<string, string> = {
  casual: 'Casual',
  conversational: 'Conversational',
  professional: 'Professional',
  formal: 'Formal',
}

const HUMOUR_LABEL: Record<string, string> = {
  none: 'None',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
}

function ToneSlider({ label, leftLabel, rightLabel, value }: {
  label: string; leftLabel: string; rightLabel: string; value: number
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 }}>
        <span><b style={{ color: 'var(--ink)' }}>{label}</b></span>
        <span>{value <= 2 ? leftLabel : value >= 4 ? rightLabel : 'Balanced'}</span>
      </div>
      <input
        type="range"
        min={1} max={5}
        value={value}
        readOnly
        style={{ width: '100%', accentColor: 'var(--brand)', margin: 0 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

const FORMALITY_SCORE: Record<string, number> = {
  casual: 1, conversational: 2, professional: 4, formal: 5,
}
const HUMOUR_SCORE: Record<string, number> = {
  none: 1, light: 2, moderate: 3, heavy: 5,
}

// ── How you sound ─────────────────────────────────────────────────────────────

function VoiceSection({ tone }: { tone: ToneOfVoice | null }) {
  const hasData = tone?.formality || tone?.humour

  if (!hasData) {
    return (
      <Card>
        <SectionHead title="How this business sounds" />
        <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
          <p style={{ margin: '0 auto 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: '54ch' }}>
            The tone of voice tells every AI how to write for this business. Not filled in yet.
          </p>
          <button
            type="button"
            onClick={() => sendToDirector('Help me define the tone of voice for this business. How formal or casual should it sound? How much personality?')}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
              border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
            }}
          >
            ✦ Define the tone of voice
          </button>
        </div>
      </Card>
    )
  }

  const formalityScore = FORMALITY_SCORE[tone?.formality ?? 'conversational'] ?? 3
  const humourScore = HUMOUR_SCORE[tone?.humour ?? 'light'] ?? 2

  return (
    <Card>
      <SectionHead
        title="How this business sounds"
        sub="Sliders are set by the Director from the brand description. Click Ask Director to adjust."
        onAsk="Review the tone of voice for this business and suggest any adjustments based on what works in this industry."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 24px', marginBottom: 14 }}>
        <ToneSlider label="Formality" leftLabel="Casual" rightLabel="Formal" value={formalityScore} />
        <ToneSlider label="Humour" leftLabel="None" rightLabel="Heavy" value={humourScore} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1, border: '1px solid var(--line)', borderRadius: 9, padding: '10px 12px',
          background: 'var(--panel-2)',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 5 }}>Current settings</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>
            {FORMALITY_LABEL[tone?.formality ?? ''] ?? 'Not set'} · {HUMOUR_LABEL[tone?.humour ?? ''] ?? 'Not set'} humour
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Words section ─────────────────────────────────────────────────────────────

function WordsSection({ tone }: { tone: ToneOfVoice | null }) {
  const keywords = tone?.keywords ?? []
  const avoidWords = tone?.avoid_words ?? []
  const hasData = keywords.length > 0 || avoidWords.length > 0

  if (!hasData) {
    return (
      <Card>
        <SectionHead title="Words to use and avoid" />
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '60ch' }}>
          Specific words this brand uses, and words it never uses. These go into every piece of content. Not set yet.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('What words and phrases should this business always use? And what should it never say? Help me build the word list.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Build the word list
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHead
        title="Words to use and avoid"
        sub="These go into every caption, ad, email and blog post."
        onAsk="Review the word list for this business. Are there any that should be added or removed?"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {keywords.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12.5, fontWeight: 650, margin: '0 0 4px', color: 'var(--ink)' }}>Use these</h4>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>Language that fits this brand.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {keywords.map((kw) => <Chip key={kw} label={kw} />)}
            </div>
          </div>
        )}
        {avoidWords.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12.5, fontWeight: 650, margin: '0 0 4px', color: 'var(--ink)' }}>Never say these</h4>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>Flagged in every draft before publishing.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {avoidWords.map((w) => <Chip key={w} label={w} variant="avoid" />)}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Topics section ────────────────────────────────────────────────────────────

function TopicsSection({ pillars }: { pillars: string[] }) {
  if (pillars.length === 0) {
    return (
      <Card>
        <SectionHead title="What this business talks about" />
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '60ch' }}>
          Content pillars keep every channel consistent. Not set yet — the Director can build them from the business description.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('What should the main content topics be for this business? Build a list of content pillars based on what the audience cares about.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Build content pillars
        </button>
      </Card>
    )
  }

  const allocated = Math.round(100 / pillars.length)
  const total = pillars.length * allocated
  const remainder = 100 - total

  return (
    <Card>
      <SectionHead
        title="What this business talks about"
        sub="Content pillars. Each one should appear in roughly equal measure across all channels."
        onAsk="Review the content pillars for this business. Are there topics missing or ones that should be dropped?"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pillars.map((pillar, i) => {
          const pct = i < pillars.length - 1 ? allocated : allocated + remainder
          return (
            <div key={pillar} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: i < pillars.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{pillar}</span>
              <div style={{ width: 150, height: 7, borderRadius: 99, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', width: 32, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
        Equal split across {pillars.length} pillar{pillars.length === 1 ? '' : 's'}. The Director adjusts this as you see what works.
      </p>
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

type ViewMode = 'voice' | 'words' | 'topics'

interface BrandingVoiceDeptProps {
  view?: ViewMode
}

export function BrandingVoiceDept({ view = 'voice' }: BrandingVoiceDeptProps) {
  const { activeBrandId } = useAgencyStore()
  const { brand, loading } = useStudioData(activeBrandId)

  const labels: Record<ViewMode, string> = {
    voice: 'How you sound',
    words: 'Words to use & avoid',
    topics: 'What you talk about',
  }

  if (loading || !brand) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>{labels[view]}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>Loading…</p>
      </div>
    )
  }

  const tone: ToneOfVoice | null = brand.tone_of_voice ?? null
  const pillars: string[] = brand.content_pillars ?? []
  const isHealthcare = brand.compliance_flags?.ahpra || brand.compliance_flags?.tga

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        {labels[view]}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '66ch' }}>
        {view === 'voice' && 'The personality behind every piece of content this business publishes.'}
        {view === 'words' && 'Specific words the brand always uses, and ones it never uses.'}
        {view === 'topics' && 'The subjects this business talks about, and roughly how often.'}
      </p>

      {view === 'voice' && (
        <>
          <VoiceSection tone={tone} />
          {isHealthcare && (
            <div style={{
              border: '1px solid var(--care-line)', borderRadius: 10, padding: '11px 13px',
              background: 'var(--care-wash)', marginBottom: 14, fontSize: 12.5, color: 'var(--care)', lineHeight: 1.5,
            }}>
              <b>⚕ Healthcare tone rules: </b>No implying guaranteed outcomes. No urgency tactics that could be misleading. No unqualified health claims. The compliance check enforces this on every draft.
            </div>
          )}
        </>
      )}

      {view === 'words' && <WordsSection tone={tone} />}
      {view === 'topics' && <TopicsSection pillars={pillars} />}
    </div>
  )
}
