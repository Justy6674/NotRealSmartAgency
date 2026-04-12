'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { ChipInput } from './ChipInput'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { BrandDNAConstraints } from '@/types/database'

interface BrandDNAEditorProps {
  brandId: string
  initialData: BrandDNAConstraints | null
}

const CONTENT_PHILOSOPHIES = [
  { value: 'storytelling_first', label: 'Storytelling first — lead with narrative' },
  { value: 'product_first', label: 'Product first — lead with features & benefits' },
  { value: 'educational_first', label: 'Educational first — lead with knowledge' },
  { value: 'community_first', label: 'Community first — lead with belonging' },
] as const

const FRAMING_OPTIONS = [
  { value: 'first_person', label: 'First person — "I believe..."' },
  { value: 'third_person', label: 'Third person — "Dr Smith says..."' },
] as const

export function BrandDNAEditor({ brandId, initialData }: BrandDNAEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [voiceRules, setVoiceRules] = useState<string[]>(initialData?.voice_rules ?? [])
  const [bannedWords, setBannedWords] = useState<string[]>(initialData?.banned_words ?? [])
  const [founderVoice, setFounderVoice] = useState({
    name: initialData?.founder_voice?.name ?? '',
    platforms: initialData?.founder_voice?.platforms ?? [],
    framing: initialData?.founder_voice?.framing ?? ('first_person' as const),
  })
  const [contentPhilosophy, setContentPhilosophy] = useState<BrandDNAConstraints['content_philosophy']>(
    initialData?.content_philosophy ?? 'storytelling_first'
  )
  const [neverDo, setNeverDo] = useState<string[]>(initialData?.never_do ?? [])
  const [narrativeWorld, setNarrativeWorld] = useState(initialData?.narrative_world ?? '')

  const handleSave = async () => {
    setSaving(true)
    const data: BrandDNAConstraints = {
      voice_rules: voiceRules,
      banned_words: bannedWords,
      founder_voice: founderVoice.name
        ? { name: founderVoice.name, platforms: founderVoice.platforms, framing: founderVoice.framing }
        : undefined,
      content_philosophy: contentPhilosophy,
      never_do: neverDo,
      narrative_world: narrativeWorld || undefined,
    }

    await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: brandId, brand_dna_constraints: data }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Director Assist */}
      <button
        onClick={() => sendToDirector('Help me define my brand voice')}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Help me define my brand voice
      </button>

      {/* Voice Rules */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Voice Rules
        </p>
        <p className="text-[11px] text-muted-foreground">
          Deterministic rules for how the brand speaks — not adjectives, but concrete instructions.
        </p>
        <ChipInput
          items={voiceRules}
          onChange={setVoiceRules}
          placeholder="e.g., Always use active voice, Never start with a question"
        />
      </section>

      <div className="h-px bg-border" />

      {/* Banned Words */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Banned Words
        </p>
        <p className="text-[11px] text-muted-foreground">
          Words the brand must never use — across all content, all platforms.
        </p>
        <ChipInput
          items={bannedWords}
          onChange={setBannedWords}
          placeholder="e.g., miracle, guaranteed, cure, hack"
        />
      </section>

      <div className="h-px bg-border" />

      {/* Content Philosophy */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Content Philosophy
        </p>
        <p className="text-[11px] text-muted-foreground">
          What does this brand believe about content? This shapes every piece agents create.
        </p>
        <select
          value={contentPhilosophy ?? 'storytelling_first'}
          onChange={e => setContentPhilosophy(e.target.value as BrandDNAConstraints['content_philosophy'])}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {CONTENT_PHILOSOPHIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </section>

      <div className="h-px bg-border" />

      {/* Founder Voice */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Founder Voice
        </p>
        <p className="text-[11px] text-muted-foreground">
          If the founder is the face of the brand, configure how their voice is used.
        </p>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Founder name</label>
          <input
            value={founderVoice.name}
            onChange={e => setFounderVoice({ ...founderVoice, name: e.target.value })}
            placeholder="e.g., Dr Justin Campbell"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Framing</label>
          <select
            value={founderVoice.framing}
            onChange={e => setFounderVoice({ ...founderVoice, framing: e.target.value as 'first_person' | 'third_person' })}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          >
            {FRAMING_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Platforms where founder voice is used</label>
          <ChipInput
            items={founderVoice.platforms}
            onChange={platforms => setFounderVoice({ ...founderVoice, platforms })}
            placeholder="e.g., LinkedIn, Instagram Stories, Blog"
          />
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Never Do */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Hard Constraints (Never Do)
        </p>
        <p className="text-[11px] text-muted-foreground">
          Things the brand must never do — hard rules that override everything else.
        </p>
        <ChipInput
          items={neverDo}
          onChange={setNeverDo}
          placeholder="e.g., before/after images, testimonials in ads, price comparisons"
        />
      </section>

      <div className="h-px bg-border" />

      {/* Narrative World */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Narrative World
        </p>
        <p className="text-[11px] text-muted-foreground">
          The brand&apos;s story universe — the world it lives in, the journey it takes customers on.
        </p>
        <textarea
          value={narrativeWorld}
          onChange={e => setNarrativeWorld(e.target.value)}
          placeholder="e.g., A world where sustainable weight loss is medical science, not willpower. Where patients are partners, not patients..."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Brand DNA'}
      </button>
    </div>
  )
}
