'use client'

import { useState } from 'react'
import {
  PenLine, Search, Megaphone, Target, Mail,
  TrendingUp, Palette, Eye, Globe, ShieldCheck,
  ArrowRight,
} from 'lucide-react'

const SECTIONS = ['departments', 'how-it-works', 'brands'] as const
type Section = typeof SECTIONS[number]

const DEPARTMENTS = [
  { name: 'Content & Copy', icon: PenLine, desc: 'Social posts, blogs, landing pages' },
  { name: 'SEO', icon: Search, desc: 'Keywords, topic clusters, on-page' },
  { name: 'Paid Ads', icon: Megaphone, desc: 'Meta, Google, LinkedIn, TikTok' },
  { name: 'Strategy', icon: Target, desc: 'Campaigns, GTM, launches' },
  { name: 'Email', icon: Mail, desc: 'Sequences, EDMs, newsletters' },
  { name: 'Growth', icon: TrendingUp, desc: 'Referrals, PR, partnerships' },
  { name: 'Brand', icon: Palette, desc: 'Voice, pillars, positioning' },
  { name: 'Competitors', icon: Eye, desc: 'Analysis, gaps, SWOT' },
  { name: 'Website', icon: Globe, desc: 'Copy, UX, conversion' },
  { name: 'Compliance', icon: ShieldCheck, desc: 'AHPRA/TGA checks' },
]

const BRANDS = [
  { name: 'Downscale Weight Loss', desc: 'Telehealth weight loss, $45/consult' },
  { name: 'DownscaleDerm', desc: 'Prescription skincare via telehealth' },
  { name: 'TeleCheck', desc: 'Medicare telehealth eligibility SaaS' },
  { name: 'TeleScribe', desc: 'AI clinical documentation' },
  { name: 'NotRealSmart', desc: 'This platform — AI marketing agency' },
  { name: 'Downscale Diary', desc: 'AI health companion via messenger' },
  { name: 'Scent Sell', desc: 'Second-hand fragrance marketplace' },
  { name: 'EndorseMe', desc: 'NP endorsement pathway app' },
]

export default function AboutContentPage() {
  const [active, setActive] = useState<Section>('departments')

  return (
    <div
      className="min-h-screen font-[var(--font-sans)] overflow-auto"
      style={{
        background: 'oklch(0.1 0.005 240)',
        color: 'oklch(0.75 0 0)',
        // CRT scanline effect
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0 0 0 / 0.03) 2px, oklch(0 0 0 / 0.03) 4px)',
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'oklch(0.2 0.01 240)' }}>
        <h1 className="text-lg font-bold uppercase tracking-widest" style={{ color: 'oklch(0.85 0.005 240)' }}>
          NRS Agency
        </h1>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.4 0 0)' }}>
          About
        </span>
      </header>

      {/* Tab navigation */}
      <nav className="flex border-b" style={{ borderColor: 'oklch(0.2 0.01 240)' }}>
        {([
          ['departments', '10 Departments'],
          ['how-it-works', 'How It Works'],
          ['brands', '8 Brands'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className="flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-colors"
            style={{
              color: active === key ? 'oklch(0.9 0.005 240)' : 'oklch(0.45 0 0)',
              background: active === key ? 'oklch(0.15 0.01 240)' : 'transparent',
              borderBottom: active === key ? '2px solid oklch(0.6 0.01 240)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="p-6">
        {active === 'departments' && (
          <div className="grid grid-cols-2 gap-3">
            {DEPARTMENTS.map(({ name, icon: Icon, desc }) => (
              <div
                key={name}
                className="rounded-lg border p-3"
                style={{ borderColor: 'oklch(0.2 0.01 240)', background: 'oklch(0.12 0.005 240)' }}
              >
                <Icon className="h-4 w-4 mb-2" style={{ color: 'oklch(0.6 0.01 240)' }} />
                <p className="text-xs font-semibold" style={{ color: 'oklch(0.85 0 0)' }}>{name}</p>
                <p className="text-[10px] mt-1" style={{ color: 'oklch(0.5 0 0)' }}>{desc}</p>
              </div>
            ))}
          </div>
        )}

        {active === 'how-it-works' && (
          <div className="space-y-6 py-4">
            {[
              { num: '01', title: 'Pick Your Brand', desc: 'Select from your portfolio or create a new brand profile with tone, audience, and compliance flags.' },
              { num: '02', title: 'Brief an Agent', desc: 'Choose a department, describe what you need. The agent already knows your brand context.' },
              { num: '03', title: 'Get Finished Output', desc: 'Review, copy, publish. Compliance-checked for health brands. Save to your output library.' },
            ].map(({ num, title, desc }, i) => (
              <div key={num} className="flex gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold"
                  style={{ borderColor: 'oklch(0.4 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
                >
                  {num}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'oklch(0.85 0 0)' }}>{title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'oklch(0.5 0 0)' }}>{desc}</p>
                </div>
                {i < 2 && <ArrowRight className="mt-3 h-3 w-3 shrink-0" style={{ color: 'oklch(0.3 0 0)' }} />}
              </div>
            ))}
          </div>
        )}

        {active === 'brands' && (
          <div className="space-y-3">
            {BRANDS.map(({ name, desc }) => (
              <div
                key={name}
                className="rounded-lg border p-3"
                style={{ borderColor: 'oklch(0.2 0.01 240)', background: 'oklch(0.12 0.005 240)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'oklch(0.85 0 0)' }}>{name}</p>
                <p className="text-[10px] mt-1" style={{ color: 'oklch(0.5 0 0)' }}>{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
