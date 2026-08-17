'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Sparkles, X } from 'lucide-react'
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

/**
 * Neutral greys shown in the preview for slots the owner has NOT set.
 * These are display-only placeholders — they are never written to the brand
 * and never leave this component. Authored CSS colours are oklch by house rule.
 */
const PREVIEW_PLACEHOLDER: Record<string, string> = {
  primary: 'oklch(0.72 0 0)',
  secondary: 'oklch(0.80 0 0)',
  accent: 'oklch(0.76 0 0)',
  background: 'oklch(0.97 0 0)',
  text: 'oklch(0.40 0 0)',
  success: 'oklch(0.62 0 0)',
  warning: 'oklch(0.62 0 0)',
  error: 'oklch(0.62 0 0)',
}

const PREVIEW_FALLBACK = 'oklch(0.70 0 0)'

/** The colour the native picker opens on for a slot that has nothing set yet. */
const UNSET_PICKER_SEED = '#808080'

const UNSET_SWATCH_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(45deg, oklch(0.65 0 0 / 0.35) 0 4px, transparent 4px 8px)',
}

type ParsedColour = { hex: string; alpha: number }

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toHexPair(n: number): string {
  return n.toString(16).padStart(2, '0')
}

/** One rgb() channel — accepts `128` or `50%`. */
function parseChannel(raw: string | undefined): number | null {
  const token = (raw ?? '').trim()
  if (!token) return null
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1))
    return Number.isFinite(pct) ? clampByte((pct / 100) * 255) : null
  }
  const n = Number(token)
  return Number.isFinite(n) ? clampByte(n) : null
}

/** An alpha term — accepts `.9`, `0.9` or `90%`. Missing means fully opaque. */
function parseAlpha(raw: string | undefined): number {
  const token = (raw ?? '').trim()
  if (!token) return 1
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1))
    return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : 1
  }
  const n = Number(token)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
}

/**
 * Read a stored colour into a hex the native picker can actually display,
 * plus whatever alpha the stored value carried.
 *
 * Brands in production store rgb()/rgba() as well as hex — Downscale has
 * "rgba(30,41,59,.9)" and TeleCheck Clinic has "rgb(15 23 42/.95)". An
 * <input type="color"> silently rewrites anything it cannot parse to #000000,
 * so without this, opening those brands' settings and pressing Save would
 * black out their text colour. Returns null when the value is not a colour we
 * can represent in the picker — the caller must then leave it alone.
 */
export function parseColour(raw: string | null | undefined): ParsedColour | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  const hexMatch = /^#([0-9a-f]+)$/i.exec(value)
  if (hexMatch) {
    const digits = hexMatch[1].toLowerCase()
    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b, a] = digits.split('')
      return {
        hex: `#${r}${r}${g}${g}${b}${b}`,
        alpha: a ? parseInt(`${a}${a}`, 16) / 255 : 1,
      }
    }
    if (digits.length === 6) return { hex: `#${digits}`, alpha: 1 }
    if (digits.length === 8) {
      return { hex: `#${digits.slice(0, 6)}`, alpha: parseInt(digits.slice(6, 8), 16) / 255 }
    }
    return null
  }

  // rgb()/rgba(), in both the comma syntax and the space/slash syntax.
  const fnMatch = /^rgba?\(([^)]*)\)$/i.exec(value)
  if (fnMatch) {
    const [channelPart, slashAlpha] = fnMatch[1].split('/')
    const parts = channelPart.trim().split(/[\s,]+/).filter(Boolean)
    const r = parseChannel(parts[0])
    const g = parseChannel(parts[1])
    const b = parseChannel(parts[2])
    if (r === null || g === null || b === null) return null
    return {
      hex: `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`,
      alpha: parseAlpha(slashAlpha ?? parts[3]),
    }
  }

  return null
}

/**
 * Write a picked colour back out. If the slot already carried transparency we
 * re-emit rgba() so the alpha survives the edit — hex has no room for it, and
 * downstream consumers (Mixpost tags, Canva brand kits) expect six-digit hex,
 * so widening to #rrggbbaa would break them.
 */
export function formatColour(hex: string, alpha: number): string {
  if (alpha >= 1) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
}

function humanise(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function BrandColoursEditor({ brandId, initialColours }: BrandColoursEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed from what the owner actually has. An unset slot stays unset — it is
  // NOT pre-filled with a default, because the first Save would then write a
  // colour nobody chose into the brand.
  const [colours, setColours] = useState<Record<string, string>>(() => ({
    ...(initialColours ?? {}),
  }))

  // Named slots first, then any extra roles a previous colour extraction saved,
  // so nothing already stored is invisible here — and so Save cannot drop it.
  const slots = useMemo(() => {
    const known = new Set<string>(COLOUR_SLOTS.map(s => s.key))
    const extras = Object.keys(initialColours ?? {})
      .filter(key => !known.has(key))
      .map(key => ({ key, label: humanise(key) }))
    return [...COLOUR_SLOTS.map(s => ({ key: s.key as string, label: s.label as string })), ...extras]
  }, [initialColours])

  const setSlot = (key: string, value: string) => {
    setSaveError(null)
    setColours(prev => ({ ...prev, [key]: value }))
  }

  const clearSlot = (key: string) => {
    setSaveError(null)
    setColours(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handlePick = (key: string, pickedHex: string) => {
    const existing = parseColour(colours[key])
    setSlot(key, formatColour(pickedHex, existing?.alpha ?? 1))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)

    // Only slots with a real value are sent. Empty stays empty.
    const payload = Object.fromEntries(
      Object.entries(colours)
        .map(([key, value]) => [key, (value ?? '').trim()] as const)
        .filter(([, value]) => value.length > 0)
    )

    try {
      const res = await fetch('/api/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brandId, brand_colours: payload }),
      })
      if (!res.ok) {
        setSaveError('Your colours were not saved. Please try again in a moment.')
        return
      }
      router.refresh()
    } catch {
      setSaveError('Your colours were not saved — the connection dropped. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const unsetCount = slots.filter(({ key }) => !(colours[key] ?? '').trim()).length

  const previewValue = (key: string): string => {
    const value = (colours[key] ?? '').trim()
    if (value) return value
    return PREVIEW_PLACEHOLDER[key] ?? PREVIEW_FALLBACK
  }

  return (
    <div className="space-y-6">
      {/* Director Assist */}
      <button
        type="button"
        onClick={() => sendToDirector('Extract colours from my website')}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Extract colours from my website
      </button>

      {/* Colour slots */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Palette
        </p>
        <p className="text-[11px] text-muted-foreground">
          These colours are used across all generated content, graphics, and brand outputs.
          A slot left unset is not saved at all — your agents are told to ask rather than
          invent a colour, so an empty slot stays empty.
        </p>

        <div className="divide-y divide-border rounded-lg border border-border">
          {slots.map(({ key, label }) => {
            const raw = (colours[key] ?? '').trim()
            const parsed = parseColour(raw)
            const isUnset = raw.length === 0
            const isUnreadable = !isUnset && parsed === null
            const opacityPct = parsed ? Math.round(parsed.alpha * 100) : 100

            return (
              <div key={key} className="flex items-start gap-3 px-3 py-3">
                {/* Swatch + native picker overlay */}
                <label className="relative block h-10 w-10 shrink-0">
                  <span className="sr-only">{`${label} colour`}</span>
                  <input
                    type="color"
                    value={parsed?.hex ?? UNSET_PICKER_SEED}
                    onChange={e => handlePick(key, e.target.value)}
                    disabled={saving || isUnreadable}
                    aria-label={`${label} colour picker`}
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none block h-10 w-10 rounded-md border border-border transition-colors peer-hover:border-muted-foreground/60 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50"
                    style={
                      isUnset || isUnreadable
                        ? UNSET_SWATCH_STYLE
                        : { backgroundColor: raw }
                    }
                  />
                </label>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                    {isUnset && (
                      <span className="rounded-sm border border-border px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        Not set
                      </span>
                    )}
                    {!isUnset && parsed && parsed.alpha < 1 && (
                      <span className="rounded-sm border border-border px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        {opacityPct}% opacity
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={colours[key] ?? ''}
                      onChange={e => setSlot(key, e.target.value)}
                      disabled={saving}
                      placeholder="Not set"
                      aria-label={`${label} colour value`}
                      className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono transition-colors hover:border-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => clearSlot(key)}
                      disabled={saving || isUnset}
                      title={`Clear ${label}`}
                      aria-label={`Clear ${label}`}
                      className="shrink-0 rounded-md border border-border p-1 text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {!isUnset && parsed && parsed.alpha < 1 && (
                    <p className="text-[10px] text-muted-foreground">
                      Saved with transparency. Picking a new colour keeps the {opacityPct}% opacity.
                    </p>
                  )}

                  {isUnreadable && (
                    <p className="flex items-start gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        This is not a hex or rgb() value, so the picker cannot show it. It is left
                        exactly as it is — type a hex value like #1e293b to replace it.
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Preview */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <p className="text-[11px] text-muted-foreground">
          {unsetCount > 0
            ? `How your colours look together. ${unsetCount} slot${unsetCount === 1 ? ' is' : 's are'} not set, so ${unsetCount === 1 ? 'it shows' : 'they show'} as neutral grey here — nothing grey is saved to your brand.`
            : 'How your brand colours look together on a sample card.'}
        </p>

        <div
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: previewValue('background'),
            borderColor: previewValue('secondary'),
          }}
        >
          {/* Header */}
          <div className="px-4 py-3" style={{ backgroundColor: previewValue('primary') }}>
            <p className="text-sm font-semibold" style={{ color: previewValue('background') }}>
              Your Brand Name
            </p>
            <p className="text-[11px] opacity-80" style={{ color: previewValue('background') }}>
              A preview of your colour palette in action
            </p>
          </div>

          {/* Body */}
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs" style={{ color: previewValue('text') }}>
              This is how your body text will look against the background colour.
              The palette ensures readability and brand consistency across all outputs.
            </p>

            <div className="flex gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: previewValue('accent'), color: previewValue('background') }}
              >
                Accent tag
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: previewValue('secondary'), color: previewValue('background') }}
              >
                Secondary tag
              </span>
            </div>

            {/* Status indicators */}
            <div className="flex gap-3 text-[10px] font-medium">
              <span style={{ color: previewValue('success') }}>Success</span>
              <span style={{ color: previewValue('warning') }}>Warning</span>
              <span style={{ color: previewValue('error') }}>Error</span>
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Colours'}
        </button>
        {saveError && (
          <p className="flex items-start gap-1 text-[11px] text-amber-400">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            <span>{saveError}</span>
          </p>
        )}
      </div>
    </div>
  )
}
