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

// ── Explainer: what is AI search ──────────────────────────────────────────────

function WhatIsItCard() {
  return (
    <Card style={{ background: 'var(--brand-wash)', borderColor: 'var(--brand)' }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', margin: '0 0 8px', color: 'var(--ink)' }}>
        What AI search means for this business
      </h2>
        <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '68ch' }}>
        When someone asks ChatGPT, Perplexity, or Google Gemini a question — <em style={{ fontStyle: 'normal', color: 'var(--ink)' }}>&ldquo;who does X in my area&rdquo;</em> or <em style={{ fontStyle: 'normal', color: 'var(--ink)' }}>&ldquo;best Y for Z problem&rdquo;</em> — those tools give an answer without showing ten blue links. The business that gets named in that answer wins.
      </p>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '68ch' }}>
        This section is about making this business the one that gets named. It requires different content from classic search — direct answers, clear expertise, and a consistent point of view.
      </p>
    </Card>
  )
}

// ── Knowledge panel readiness ─────────────────────────────────────────────────

function ReadinessCard({ brand }: { brand: Brand }) {
  type Check = { label: string; ok: boolean; action: string }
  const checks: Check[] = [
    {
      label: 'Business description is set',
      ok: !!brand.description,
      action: 'Fill in the business description in the Business section first, then come back here.',
    },
    {
      label: 'What makes this business different is written down',
      ok: (brand.products_services?.length ?? 0) > 0,
      action: 'Add the products and differentiators in the Business section.',
    },
    {
      label: 'Target audience is defined',
      ok: !!(brand.target_audience?.demographics),
      action: 'Add the target audience in the Business section.',
    },
    {
      label: 'Content pillars are set',
      ok: (brand.content_pillars?.length ?? 0) > 0,
      action: 'Set content pillars in the Business section.',
    },
    {
      label: 'Website is connected',
      ok: !!brand.website_url,
      action: 'Add the website URL so AI tools can read and cite the business.',
    },
  ]

  const score = checks.filter((c) => c.ok).length
  const total = checks.length

  return (
    <Card>
      <SectionHead
        title="AI answer readiness"
        sub="How ready this business is to appear in AI-generated answers."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center', border: '3px solid var(--line)',
          borderTopColor: score === total ? 'var(--ok)' : score > total / 2 ? 'var(--warn)' : 'var(--care)',
          fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)',
        }}>
          {score}/{total}
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>
            {score === total ? 'Ready to appear in AI answers'
              : score > total / 2 ? 'Mostly ready — a few gaps remain'
              : 'Several things to fill in first'}
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)' }}>
            Each item below that is not checked is something that reduces the chance of being cited.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {checks.map((c, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0',
            borderBottom: i < checks.length - 1 ? '1px solid var(--line-soft)' : 'none',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: c.ok ? 'var(--ok-wash)' : 'var(--panel-2)',
              border: `1px solid ${c.ok ? 'var(--ok)' : 'var(--line)'}`,
              fontSize: 11, color: c.ok ? 'var(--ok)' : 'var(--ink-3)', marginTop: 1,
            }}>
              {c.ok ? '✓' : ''}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: c.ok ? 'var(--ink)' : 'var(--ink-2)', fontWeight: c.ok ? 500 : 400 }}>
                {c.label}
              </span>
              {!c.ok && (
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  {c.action}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Content for AI answers ────────────────────────────────────────────────────

function ContentStrategyCard({ brand }: { brand: Brand }) {
  const hasWebsite = !!brand.website_url
  const hasDescription = !!brand.description

  if (!hasWebsite && !hasDescription) {
    return (
      <Card>
        <SectionHead title="Content that gets cited in AI answers" sub="What to write so AI tools mention this business when someone asks a related question." />
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '66ch' }}>
          Fill in the business description and website URL first. Then come back here and the Director will write a content plan aimed at AI visibility.
        </p>
        <button
          type="button"
          onClick={() => sendToDirector('What kind of content should this business publish to appear in AI-generated answers? Help me build a plan.')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Build an AI content plan
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHead
        title="Content that gets cited in AI answers"
        sub="AI tools cite businesses that directly answer specific questions. This is different from search — it rewards expertise, not keyword frequency."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 11, marginBottom: 16 }}>
        {[
          {
            icon: '🎯',
            title: 'Direct answers',
            body: 'Write content that directly answers questions your customers ask. "How much does X cost?" "What is the difference between Y and Z?" Not marketing — answers.',
          },
          {
            icon: '🔬',
            title: 'Demonstrable expertise',
            body: 'AI tools prefer sources that show their reasoning. Behind-the-scenes, process explainers, and case studies with numbers get cited more than general advice.',
          },
          {
            icon: '📝',
            title: 'Consistent point of view',
            body: 'A clear stance on how this business does things differently builds a signal that AI tools can anchor to. Vague "we care" content does not get cited.',
          },
        ].map((item) => (
          <div key={item.title} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 13, background: 'var(--panel-2)' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
            <b style={{ display: 'block', fontSize: 13, fontWeight: 650, marginBottom: 5, color: 'var(--ink)' }}>{item.title}</b>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{item.body}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => sendToDirector('What specific content should this business publish this month to appear in AI-generated answers? Give me a concrete plan with topics and formats.')}
        style={{
          fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
          border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
        }}
      >
        ✦ Create AI-focused content plan
      </button>
    </Card>
  )
}

// ── Local AI search ───────────────────────────────────────────────────────────

function LocalAiCard({ brand }: { brand: Brand }) {
  const isHealthcare = brand.compliance_flags?.ahpra || brand.compliance_flags?.tga

  return (
    <Card>
      <SectionHead
        title="When someone asks an AI tool about this area"
        sub="AI tools increasingly give local recommendations. Being the obvious answer requires real reviews, clear expertise, and consistency across every platform."
      />

      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '68ch' }}>
        When someone asks ChatGPT or Google Gemini <em style={{ fontStyle: 'normal', color: 'var(--ink)' }}>&ldquo;who is the best {brand.niche || 'option'} near me?&rdquo;</em> the answer comes from what AI tools can read and verify — not from paid placement.
      </p>

      {isHealthcare && (
        <div style={{
          display: 'flex', gap: 9, padding: '11px 13px', borderRadius: 10,
          background: 'var(--care-wash)', border: '1px solid var(--care-line)',
          marginBottom: 14, fontSize: 13, color: 'var(--care)', lineHeight: 1.5,
        }}>
          <span>⚕</span>
          <span>For healthcare practices, AHPRA restricts testimonials and outcome claims. The content plan here only uses compliant approaches — clinical expertise, process transparency, and information that genuinely helps patients choose.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => sendToDirector('Check if this business appears when someone asks an AI tool for recommendations in this category. What would help it show up more?')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: 0, background: 'var(--brand-deep)', color: 'oklch(1 0 0)', cursor: 'pointer',
          }}
        >
          ✦ Check AI visibility now
        </button>
        <button
          type="button"
          onClick={() => sendToDirector('What reviews and testimonials could this business gather to improve its AI search visibility?')}
          style={{
            fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
            border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)', cursor: 'pointer',
          }}
        >
          Get more reviews
        </button>
      </div>
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface AiSearchabilityDeptProps {
  brand: Brand | null
}

export function AiSearchabilityDept({ brand }: AiSearchabilityDeptProps) {
  const safeBrand = brand ?? { website_url: null, description: null, name: 'this business', niche: '', products_services: [], target_audience: { demographics: '', pain_points: [], desires: [] }, content_pillars: [], compliance_flags: { ahpra: false, tga: false, tga_categories: [] } } as unknown as Brand

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '24px 26px 48px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 3px', color: 'var(--ink)' }}>
        AI searchability
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '66ch' }}>
        How this business appears when someone asks ChatGPT, Perplexity, or Google Gemini a question. Different from Google search — and growing faster.
      </p>

      <WhatIsItCard />
      <ReadinessCard brand={safeBrand} />
      <ContentStrategyCard brand={safeBrand} />
      <LocalAiCard brand={safeBrand} />
    </div>
  )
}
