'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'

interface BrandColoursEditorProps {
  brandId: string
  initialColours: Record<string, string> | null
}

const COLOUR_SLOTS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
] as const

const DEFAULT_COLOURS: Record<string, string> = {
  primary: '#1877f2',
  secondary: '#6c757d',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#1a1a1a',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
}

export function BrandColoursEditor({ brandId, initialColours }: BrandColoursEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [colours, setColours] = useState<Record<string, string>>(() => ({
    ...DEFAULT_COLOURS,
    ...(initialColours ?? {}),
  }))

  const updateColour = (key: string, value: string) => {
    setColours(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: brandId, brand_colours: colours }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Director Assist */}
      <button
        onClick={() => sendToDirector('Extract colours from my website')}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Extract colours from my website
      </button>

      {/* Colour Slots */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Palette
        </p>
        <p className="text-[11px] text-muted-foreground">
          These colours are used across all generated content, graphics, and brand outputs.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COLOUR_SLOTS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              {/* Swatch + native picker overlay */}
              <label className="relative cursor-pointer">
                <div
                  className="h-10 w-10 rounded-md border border-border"
                  style={{ backgroundColor: colours[key] ?? DEFAULT_COLOURS[key] }}
                />
                <input
                  type="color"
                  value={colours[key] ?? DEFAULT_COLOURS[key]}
                  onChange={e => updateColour(key, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>

              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                <input
                  value={colours[key] ?? ''}
                  onChange={e => updateColour(key, e.target.value)}
                  placeholder="#000000"
                  className="w-full rounded-md border border-border bg-background px-2 py-0.5 text-xs font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Preview Card */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <p className="text-[11px] text-muted-foreground">
          How your brand colours look together on a sample card.
        </p>

        <div
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: colours.background, borderColor: colours.secondary }}
        >
          {/* Header */}
          <div
            className="px-4 py-3"
            style={{ backgroundColor: colours.primary }}
          >
            <p className="text-sm font-semibold" style={{ color: colours.background }}>
              Your Brand Name
            </p>
            <p className="text-[11px] opacity-80" style={{ color: colours.background }}>
              A preview of your colour palette in action
            </p>
          </div>

          {/* Body */}
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs" style={{ color: colours.text }}>
              This is how your body text will look against the background colour.
              The palette ensures readability and brand consistency across all outputs.
            </p>

            <div className="flex gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: colours.accent, color: colours.background }}
              >
                Accent tag
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: colours.secondary, color: colours.background }}
              >
                Secondary tag
              </span>
            </div>

            {/* Status indicators */}
            <div className="flex gap-3 text-[10px] font-medium">
              <span style={{ color: colours.success }}>Success</span>
              <span style={{ color: colours.warning }}>Warning</span>
              <span style={{ color: colours.error }}>Error</span>
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Colours'}
      </button>
    </div>
  )
}
