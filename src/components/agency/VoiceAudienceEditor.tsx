'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { ToneOfVoice, TargetAudience } from '@/types/database'

interface VoiceAudienceEditorProps {
  toneOfVoice: ToneOfVoice
  targetAudience: TargetAudience
  onToneChange: (tone: ToneOfVoice) => void
  onAudienceChange: (audience: TargetAudience) => void
}

function ChipInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const trimmed = input.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setInput('')
    }
  }

  const handleRemove = (item: string) => {
    onChange(items.filter(i => i !== item))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {item}
            <button onClick={() => handleRemove(item)} className="text-muted-foreground hover:text-foreground">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export function VoiceAudienceEditor({ toneOfVoice, targetAudience, onToneChange, onAudienceChange }: VoiceAudienceEditorProps) {
  return (
    <div className="space-y-6">
      {/* Tone of Voice */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tone of Voice
        </p>
        <p className="text-[11px] text-muted-foreground">
          Controls how all agents write for this brand. Every output matches these settings.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">Formality</label>
            <select
              value={toneOfVoice.formality ?? 'professional'}
              onChange={e => onToneChange({ ...toneOfVoice, formality: e.target.value as ToneOfVoice['formality'] })}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
            >
              <option value="casual">Casual — mates having a yarn</option>
              <option value="conversational">Conversational — friendly but informed</option>
              <option value="professional">Professional — business appropriate</option>
              <option value="formal">Formal — clinical/corporate</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground">Humour</label>
            <select
              value={toneOfVoice.humour ?? 'light'}
              onChange={e => onToneChange({ ...toneOfVoice, humour: e.target.value as ToneOfVoice['humour'] })}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
            >
              <option value="none">None — serious only</option>
              <option value="light">Light — occasional warmth</option>
              <option value="moderate">Moderate — personality shines through</option>
              <option value="heavy">Heavy — brand is funny/cheeky</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Keywords to use</label>
          <ChipInput
            items={toneOfVoice.keywords ?? []}
            onChange={keywords => onToneChange({ ...toneOfVoice, keywords })}
            placeholder="e.g., evidence-based, sustainable, clinician-led"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Words to AVOID</label>
          <ChipInput
            items={toneOfVoice.avoid_words ?? []}
            onChange={avoid_words => onToneChange({ ...toneOfVoice, avoid_words })}
            placeholder="e.g., miracle, guaranteed, cure"
          />
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Target Audience */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Target Audience
        </p>
        <p className="text-[11px] text-muted-foreground">
          Who are you talking to? Agents tailor every output to this audience.
        </p>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Demographics</label>
          <textarea
            value={targetAudience.demographics ?? ''}
            onChange={e => onAudienceChange({ ...targetAudience, demographics: e.target.value })}
            placeholder="e.g., Women 35-55, metro Sydney/Melbourne, household income $100k+, health-conscious, time-poor professionals"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Pain points</label>
          <ChipInput
            items={targetAudience.pain_points ?? []}
            onChange={pain_points => onAudienceChange({ ...targetAudience, pain_points })}
            placeholder="e.g., tried every diet, ashamed to ask GP, don't trust online"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Desires</label>
          <ChipInput
            items={targetAudience.desires ?? []}
            onChange={desires => onAudienceChange({ ...targetAudience, desires })}
            placeholder="e.g., sustainable results, medical supervision, no judgement"
          />
        </div>
      </section>
    </div>
  )
}
