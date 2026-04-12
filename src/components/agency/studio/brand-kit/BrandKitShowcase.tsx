'use client'

import { Globe, Palette, MessageSquare, Dna, Columns3, Users, Sparkles, Link as LinkIcon } from 'lucide-react'
import { useStudioData } from '@/hooks/useStudioData'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'
import { InspirationGallery } from './InspirationGallery'
import type { Brand, BrandDNAConstraints, ToneOfVoice, TargetAudience } from '@/types/database'

interface BrandKitShowcaseProps {
  brandId: string | null
}

/* ──────────────────────────────────────────────────────────── */
/*  Shared card shell                                           */
/* ──────────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground/60 italic">{text}</p>
}

function Chip({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'default' | 'red' | 'amber' | 'green' | 'strike'
}) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium'
  const variants: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    strike: 'bg-red-500/10 text-red-400 line-through',
  }
  return <span className={`${base} ${variants[variant] ?? variants.default}`}>{label}</span>
}

/* ──────────────────────────────────────────────────────────── */
/*  Identity                                                    */
/* ──────────────────────────────────────────────────────────── */

function IdentitySection({ brand }: { brand: Brand }) {
  return (
    <Section icon={<Globe className="h-4 w-4 text-primary" />} title="Identity">
      <div className="flex items-start gap-5">
        {/* Logo or initial */}
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={`${brand.name} logo`}
            className="h-20 w-20 rounded-xl object-contain bg-muted/30 border border-border p-1"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-3xl font-bold text-primary">
            {brand.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="space-y-1.5 min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground tracking-tight">{brand.name}</h1>
          {brand.tagline && (
            <p className="text-sm text-muted-foreground italic">{brand.tagline}</p>
          )}
          {brand.description && (
            <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3">
              {brand.description}
            </p>
          )}
          {brand.website_url && (
            <a
              href={brand.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              {brand.website_url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Colour Palette                                              */
/* ──────────────────────────────────────────────────────────── */

function ColourPaletteSection({ colours }: { colours: Record<string, string> }) {
  const entries = Object.entries(colours)

  if (entries.length === 0) {
    return (
      <Section icon={<Palette className="h-4 w-4 text-primary" />} title="Colour Palette">
        <EmptyHint text="No colours set -- go to Brand Settings > Colours" />
      </Section>
    )
  }

  return (
    <Section icon={<Palette className="h-4 w-4 text-primary" />} title="Colour Palette">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {entries.map(([name, hex]) => (
          <div key={name} className="space-y-1.5 text-center">
            <div
              className="h-16 w-full rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: hex }}
            />
            <p className="text-[11px] font-medium text-foreground capitalize">
              {name.replace(/_/g, ' ')}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{hex}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Voice & Tone                                                */
/* ──────────────────────────────────────────────────────────── */

const FORMALITY_LEVELS = ['casual', 'conversational', 'professional', 'formal'] as const
const HUMOUR_LEVELS = ['none', 'light', 'moderate', 'heavy'] as const

function GaugeBar({
  levels,
  active,
  label,
}: {
  levels: readonly string[]
  active: string | undefined
  label: string
}) {
  const idx = active ? levels.indexOf(active as (typeof levels)[number]) : -1
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {levels.map((level, i) => (
          <div key={level} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-2 w-full rounded-full transition-colors ${
                i <= idx ? 'bg-primary' : 'bg-muted'
              }`}
            />
            <span
              className={`text-[9px] capitalize ${
                i === idx ? 'font-semibold text-primary' : 'text-muted-foreground/50'
              }`}
            >
              {level}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VoiceToneSection({ tone }: { tone: ToneOfVoice | undefined }) {
  const hasContent =
    tone &&
    (tone.formality || tone.humour || tone.keywords?.length || tone.avoid_words?.length)

  if (!hasContent) {
    return (
      <Section icon={<MessageSquare className="h-4 w-4 text-primary" />} title="Voice & Tone">
        <EmptyHint text="Set up your voice in Brand Settings > Voice & Audience" />
      </Section>
    )
  }

  return (
    <Section icon={<MessageSquare className="h-4 w-4 text-primary" />} title="Voice & Tone">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GaugeBar levels={FORMALITY_LEVELS} active={tone?.formality} label="Formality" />
          <GaugeBar levels={HUMOUR_LEVELS} active={tone?.humour} label="Humour" />
        </div>

        {tone?.keywords && tone.keywords.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {tone.keywords.map((kw) => (
                <Chip key={kw} label={kw} />
              ))}
            </div>
          </div>
        )}

        {tone?.avoid_words && tone.avoid_words.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Avoid Words</p>
            <div className="flex flex-wrap gap-1.5">
              {tone.avoid_words.map((w) => (
                <Chip key={w} label={w} variant="red" />
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Brand DNA                                                   */
/* ──────────────────────────────────────────────────────────── */

function BrandDNASection({ dna }: { dna: BrandDNAConstraints | undefined }) {
  const hasContent =
    dna &&
    (dna.voice_rules?.length ||
      dna.content_philosophy ||
      dna.narrative_world ||
      dna.never_do?.length ||
      dna.founder_voice?.name ||
      dna.banned_words?.length)

  if (!hasContent) {
    return (
      <Section icon={<Dna className="h-4 w-4 text-primary" />} title="Brand DNA">
        <EmptyHint text="Define your DNA in Brand Settings > Brand DNA" />
      </Section>
    )
  }

  const philosophyLabels: Record<string, string> = {
    storytelling_first: 'Storytelling First',
    product_first: 'Product First',
    educational_first: 'Educational First',
    community_first: 'Community First',
  }

  return (
    <Section icon={<Dna className="h-4 w-4 text-primary" />} title="Brand DNA">
      <div className="space-y-4">
        {/* Voice rules */}
        {dna?.voice_rules && dna.voice_rules.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Voice Rules</p>
            <div className="space-y-1">
              {dna.voice_rules.map((rule, i) => (
                <blockquote
                  key={i}
                  className="border-l-2 border-primary/30 pl-3 text-xs text-foreground/80 italic"
                >
                  {rule}
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {/* Content philosophy */}
        {dna?.content_philosophy && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Content Philosophy</p>
            <p className="text-xs text-foreground/80">
              {philosophyLabels[dna.content_philosophy] ?? dna.content_philosophy}
            </p>
          </div>
        )}

        {/* Narrative world */}
        {dna?.narrative_world && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Narrative World</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{dna.narrative_world}</p>
          </div>
        )}

        {/* Never-do items */}
        {dna?.never_do && dna.never_do.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Never Do</p>
            <div className="flex flex-wrap gap-1.5">
              {dna.never_do.map((item) => (
                <Chip key={item} label={item.replace(/_/g, ' ')} variant="strike" />
              ))}
            </div>
          </div>
        )}

        {/* Banned words */}
        {dna?.banned_words && dna.banned_words.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Banned Words</p>
            <div className="flex flex-wrap gap-1.5">
              {dna.banned_words.map((w) => (
                <Chip key={w} label={w} variant="red" />
              ))}
            </div>
          </div>
        )}

        {/* Founder voice */}
        {dna?.founder_voice?.name && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Founder Voice:</span>
            <span className="text-xs font-medium text-foreground">{dna.founder_voice.name}</span>
            <span className="text-[10px] text-muted-foreground capitalize">
              ({dna.founder_voice.framing?.replace(/_/g, ' ')})
            </span>
            {dna.founder_voice.platforms && dna.founder_voice.platforms.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                on {dna.founder_voice.platforms.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Content Pillars                                             */
/* ──────────────────────────────────────────────────────────── */

function ContentPillarsSection({ pillars }: { pillars: string[] }) {
  if (!pillars || pillars.length === 0) {
    return (
      <Section icon={<Columns3 className="h-4 w-4 text-primary" />} title="Content Pillars">
        <EmptyHint text="Add content pillars in Brand Settings" />
      </Section>
    )
  }

  return (
    <Section icon={<Columns3 className="h-4 w-4 text-primary" />} title="Content Pillars">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pillars.map((pillar, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <p className="text-xs text-foreground/80 leading-relaxed">{pillar}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Audience                                                    */
/* ──────────────────────────────────────────────────────────── */

function AudienceSection({ audience }: { audience: TargetAudience | undefined }) {
  const hasContent =
    audience &&
    (audience.demographics || audience.pain_points?.length || audience.desires?.length)

  if (!hasContent) {
    return (
      <Section icon={<Users className="h-4 w-4 text-primary" />} title="Audience">
        <EmptyHint text="Define your audience in Brand Settings > Voice & Audience" />
      </Section>
    )
  }

  return (
    <Section icon={<Users className="h-4 w-4 text-primary" />} title="Audience">
      <div className="space-y-3">
        {audience?.demographics && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Demographics</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{audience.demographics}</p>
          </div>
        )}

        {audience?.pain_points && audience.pain_points.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Pain Points</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.pain_points.map((p) => (
                <Chip key={p} label={p} variant="amber" />
              ))}
            </div>
          </div>
        )}

        {audience?.desires && audience.desires.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Desires</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.desires.map((d) => (
                <Chip key={d} label={d} variant="green" />
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Main Showcase                                               */
/* ──────────────────────────────────────────────────────────── */

export function BrandKitShowcase({ brandId }: BrandKitShowcaseProps) {
  const { brand, loading } = useStudioData(brandId)

  if (!brandId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Select a brand to view its brand kit.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Brand not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Director Assist Bar */}
      <DirectorAssistBar
        brandName={brand.name}
        buttons={[
          {
            label: 'Extract brand kit from my website',
            prompt: `Scan ${brand.website_url || 'my website'} and extract a complete brand kit for ${brand.name}. Look for: logo, brand colours (hex codes), fonts, tone of voice, tagline, key messaging, imagery style, and any brand guidelines. Save everything you find to the brand profile so the Brand Kit page shows it all.`,
          },
          {
            label: 'Create brand showcase video',
            prompt: `Create a multi-scene brand showcase video for ${brand.name}. Scene 1: Logo reveal with brand name and tagline. Scene 2: Our brand colours and visual identity. Scene 3: What we stand for (mission and values). Scene 4: Our audience and how we help them. Scene 5: Call to action with website URL. Use the brand's tone of voice and visual style throughout.`,
          },
        ]}
      />

      {/* Identity */}
      <IdentitySection brand={brand} />

      {/* Colour Palette */}
      <ColourPaletteSection colours={brand.brand_colours ?? {}} />

      {/* Voice & Tone */}
      <VoiceToneSection tone={brand.tone_of_voice} />

      {/* Brand DNA */}
      <BrandDNASection dna={brand.brand_dna_constraints} />

      {/* Content Pillars */}
      <ContentPillarsSection pillars={brand.content_pillars ?? []} />

      {/* Audience */}
      <AudienceSection audience={brand.target_audience} />

      {/* Inspiration */}
      <Section icon={<Sparkles className="h-4 w-4 text-primary" />} title="Inspiration Library">
        <InspirationGallery brandId={brandId} />
      </Section>
    </div>
  )
}
