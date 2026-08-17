'use client'

import { useState, useCallback } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/types/database'

// ── Shared primitives ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 13,
      padding: '15px 16px 14px',
      marginBottom: 14,
      boxShadow: 'var(--nrs-shadow)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ title, note, onAsk, askPrompt }: { title: string; note?: string; onAsk?: () => void; askPrompt?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 13, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)', flex: 1 }}>
        {title}
      </h2>
      {note && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{note}</span>}
      {askPrompt && (
        <button
          type="button"
          onClick={onAsk ?? (() => sendToDirector(askPrompt))}
          style={{
            fontSize: 12, fontWeight: 500, padding: '5px 9px', borderRadius: 7,
            border: 0, background: 'none', color: 'var(--ink-3)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ✦ Ask Director
        </button>
      )}
    </div>
  )
}

function Field({ label, value, placeholder, onSave }: {
  label: string
  value: string | null | undefined
  placeholder: string
  onSave?: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(value ?? '')
    setEditing(true)
  }
  const commit = () => {
    onSave?.(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', width: 138, flexShrink: 0, paddingTop: 5 }}>{label}</span>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            style={{
              flex: 1, fontSize: 13, padding: '5px 8px', border: '1px solid var(--line)',
              borderRadius: 7, background: 'var(--panel)', color: 'var(--ink)',
              fontFamily: 'var(--font-sans)', outline: 'none',
              boxShadow: '0 0 0 2px var(--brand)',
            }}
          />
          <button type="button" onClick={commit} style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: 0, borderRadius: 7, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '5px 8px', fontSize: 12, fontWeight: 600, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line-soft)', cursor: onSave ? 'text' : 'default' }}
      onClick={onSave ? startEdit : undefined}
    >
      <span style={{ fontSize: 12, color: 'var(--ink-3)', width: 138, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{
        flex: 1, fontSize: 13, color: value ? 'var(--ink)' : 'var(--ink-3)',
        fontStyle: value ? 'normal' : 'italic', lineHeight: 1.5,
      }}>
        {value || placeholder}
      </span>
      {onSave && (
        <button type="button" onClick={startEdit} style={{
          width: 22, height: 22, borderRadius: 6, border: '1px solid var(--line)',
          background: 'var(--panel-2)', color: 'var(--ink-3)', fontSize: 11,
          cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>✎</button>
      )}
    </div>
  )
}

function Dot({ status }: { status: 'ok' | 'behind' | 'none' }) {
  const map = {
    ok: { bg: 'var(--ok)', label: 'On track' },
    behind: { bg: 'var(--warn)', label: 'Behind' },
    none: { bg: 'var(--ink-3)', label: 'No target set' },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: status === 'none' ? 'var(--ink-3)' : 'var(--ink-2)' }}>
      <i style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', flexShrink: 0, background: s.bg, opacity: status === 'none' ? 0.5 : 1, fontStyle: 'normal' }} />
      {s.label}
    </span>
  )
}

// ── Business overview section ──────────────────────────────────────────────────

function AboutCard({ brand, onSave }: { brand: Brand; onSave: (patch: Partial<Brand>) => void }) {
  const hasData = brand.description || brand.niche

  if (!hasData) {
    return (
      <Card>
        <CardHead title="What this business does" askPrompt="Tell me about this business — what does it do and who does it help?" />
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', maxWidth: '60ch', marginInline: 'auto', lineHeight: 1.6 }}>
            Not filled in yet. Either type directly into the fields below, or tell the Director about this business and it will fill them in for you.
          </p>
          <button
            type="button"
            onClick={() => sendToDirector('Tell me about this business — what does it do, who does it serve, and what makes it different?')}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
              border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
            }}
          >
            ✦ Let me fill this in
          </button>
        </div>
        <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <Field label="Business name" value={brand.name} placeholder="Not set" />
          <Field label="One-line niche" value={brand.niche} placeholder="What industry / category is this?" onSave={(v) => onSave({ niche: v })} />
          <Field label="Description" value={brand.description} placeholder="What does this business actually do?" onSave={(v) => onSave({ description: v })} />
          <Field label="Website" value={brand.website_url} placeholder="Not added yet" />
          <Field label="Stage" value={brand.business_stage} placeholder="—" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHead
        title="What this business does"
        note="Click any field to edit"
        askPrompt="Review the business description and suggest anything that would make it clearer or more accurate."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 22px' }}>
        <Field label="Business name" value={brand.name} placeholder="Not set" />
        <Field label="One-line niche" value={brand.niche} placeholder="—" onSave={(v) => onSave({ niche: v })} />
        <Field label="Website" value={brand.website_url} placeholder="Not added yet" />
        <Field label="Stage" value={brand.business_stage ?? 'Not set'} placeholder="—" />
      </div>
      <div style={{ marginTop: 4 }}>
        <Field label="Description" value={brand.description} placeholder="What this business does — told plainly." onSave={(v) => onSave({ description: v })} />
        {brand.extra_context && <Field label="Extra context" value={brand.extra_context} placeholder="—" onSave={(v) => onSave({ extra_context: v })} />}
      </div>
    </Card>
  )
}

// ── Who buys section ──────────────────────────────────────────────────────────

function AudienceCard({ brand }: { brand: Brand }) {
  const aud = brand.target_audience
  const hasData = aud?.demographics || (aud?.pain_points?.length ?? 0) > 0

  if (!hasData) {
    return (
      <Card>
        <CardHead title="Who buys from this business" askPrompt="Help me describe who the typical customer is for this business — who they are, what bothers them, and what they want." />
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', maxWidth: '60ch', marginInline: 'auto', lineHeight: 1.6 }}>
            Knowing the customer shapes every post, ad, and email. Not filled in yet.
          </p>
          <button
            type="button"
            onClick={() => sendToDirector('Help me fill in who the typical customer is for this business — their demographics, what bothers them, and what they want most.')}
            style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
              border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
            }}
          >
            ✦ Tell the Director who buys
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHead title="Who buys from this business" askPrompt="Review the target audience description and suggest any gaps or improvements." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 11 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 13, background: 'var(--panel-2)' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 8 }}>Who they are</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
            {aud.demographics || <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>Not filled in</span>}
          </p>
        </div>
        {(aud.pain_points?.length ?? 0) > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 13, background: 'var(--panel-2)' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 8 }}>What bothers them</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {aud.pain_points.map((p, i) => (
                <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {(aud.desires?.length ?? 0) > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 13, background: 'var(--panel-2)' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 650, marginBottom: 8 }}>What they want</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {aud.desires.map((d, i) => (
                <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Differentiators section ────────────────────────────────────────────────────

function DifferentiatorsCard({ brand }: { brand: Brand }) {
  const products = brand.products_services ?? []

  if (products.length === 0) {
    return (
      <Card>
        <CardHead title="What makes this business different" askPrompt="What makes this business different from every other option? What should a customer know before choosing someone else?" />
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Not filled in yet. These become the strongest reasons to choose this business — they go into every ad, every post, every email.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('What makes this business genuinely different? Help me list the strongest reasons a customer should choose us over anyone else.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Work out our differences
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHead title="What makes this business different" askPrompt="Are these differentiators strong enough? What would make them more compelling?" />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {products.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 0', borderBottom: i < products.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 13.5, fontWeight: 650, marginBottom: 3, color: 'var(--ink)' }}>{p.name}</b>
              {p.description && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{p.description}</span>}
              {p.price && <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{p.price}</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Goals section ─────────────────────────────────────────────────────────────

function GoalsCard({ brand }: { brand: Brand }) {
  const pillars = brand.content_pillars ?? []

  if (pillars.length === 0) {
    return (
      <Card>
        <CardHead title="Goals" askPrompt="What are the main things this business wants to achieve in the next 90 days? Let's turn them into a measurable list." />
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          No goals set yet. Goals give the Director a reason to prioritise one type of content over another.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('What are the main goals for this business in the next 90 days? Let\'s make them specific and measurable.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Set the first goal
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <CardHead title="Content pillars" note={`${pillars.length} set`} askPrompt="Review the content pillars — are there gaps? Should any be removed or combined?" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pillars.map((pillar, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: i < pillars.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', minWidth: 0 }}>{pillar}</div>
            <Dot status="none" />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Healthcare rules ──────────────────────────────────────────────────────────

function HealthcareCard({ brand }: { brand: Brand }) {
  const flags = brand.compliance_flags
  if (!flags?.ahpra && !flags?.tga) return null

  return (
    <Card style={{ borderColor: 'var(--care-line)', background: 'var(--care-wash)', boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--care-deep)' }}>⚕ Healthcare compliance</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase',
          fontWeight: 650, background: 'var(--care)', color: 'oklch(1 0 0)',
          borderRadius: 5, padding: '3px 7px',
        }}>
          {flags.ahpra && flags.tga ? 'AHPRA + TGA' : flags.ahpra ? 'AHPRA' : 'TGA'}
        </span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--care-deep)', lineHeight: 1.5, opacity: 0.9 }}>
        This business is a registered health practice. Every piece of content is checked against AHPRA advertising rules before it goes out.
        If anything is flagged, it comes back to you before publishing — never automatically.
      </p>
      <div style={{ borderTop: '1px solid var(--care-line)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
          <span style={{ position: 'relative', width: 11, height: 9, borderRadius: 2, background: 'var(--care)', display: 'inline-block', flexShrink: 0, marginTop: 5 }} />
          <div>
            <b style={{ fontSize: 13, color: 'var(--ink)' }}>No testimonials</b>
            <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>Real patient experiences cannot be used in advertising. The system will flag any draft that tries to.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
          <span style={{ position: 'relative', width: 11, height: 9, borderRadius: 2, background: 'var(--care)', display: 'inline-block', flexShrink: 0, marginTop: 5 }} />
          <div>
            <b style={{ fontSize: 13, color: 'var(--ink)' }}>No guaranteed outcomes</b>
            <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>Results vary by patient. Phrases like &ldquo;you will lose X kilos&rdquo; are not allowed.</p>
          </div>
        </div>
        {flags.tga && (flags.tga_categories?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
            <span style={{ position: 'relative', width: 11, height: 9, borderRadius: 2, background: 'var(--care)', display: 'inline-block', flexShrink: 0, marginTop: 5 }} />
            <div>
              <b style={{ fontSize: 13, color: 'var(--ink)' }}>TGA-scheduled products</b>
              <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>Products in TGA schedule categories have extra restrictions. Checked automatically on every post.</p>
            </div>
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--care-line)', paddingTop: 10, marginTop: 6 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--care-deep)', lineHeight: 1.5 }}>
          AHPRA advertising offences carry penalties up to $60,000 per instance. The compliance filter is on by default and cannot be turned off for this business.
        </p>
      </div>
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function BusinessDashboard() {
  const { activeBrandId } = useAgencyStore()
  const { brand, loading, refetch } = useStudioData(activeBrandId)
  const supabase = createClient()

  const saveBrand = useCallback(async (patch: Partial<Brand>) => {
    if (!brand?.id) return
    await supabase.from('brands').update(patch).eq('id', brand.id)
    refetch()
  }, [brand?.id, supabase, refetch])

  if (loading || !brand) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>Business</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0 }}>Loading…</p>
      </div>
    )
  }

  const isHealthcare = brand.compliance_flags?.ahpra || brand.compliance_flags?.tga

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        {brand.name}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 18px', maxWidth: '66ch' }}>
        The facts about this business. Every agent reads this before it writes — accurate facts here mean better marketing everywhere.
      </p>

      {/* Healthcare rules — always first if present */}
      {isHealthcare && <HealthcareCard brand={brand} />}

      <AboutCard brand={brand} onSave={saveBrand} />
      <AudienceCard brand={brand} />
      <DifferentiatorsCard brand={brand} />
      <GoalsCard brand={brand} />
    </div>
  )
}
