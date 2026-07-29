'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Wand2, Loader2, ExternalLink } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface CanvaBrandKit {
  id: string
  name: string
  is_default?: boolean
}

/** "DownscaleDerm" and "Downscale Derm" name the same brand. */
function normaliseBrandName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Find the Canva brand kit belonging to a brand, or null. Matching is
 * bidirectional because a kit is often named slightly longer than the project
 * ("Downscale Weight Loss Clinic" for "Downscale Weight Loss"), and returns
 * null rather than a near-miss — the cost of a wrong kit is off-brand output.
 */
export function findBrandKitForBrand(
  kits: readonly CanvaBrandKit[],
  brandName: string,
): CanvaBrandKit | null {
  const target = normaliseBrandName(brandName)
  if (!target) return null

  const exact = kits.find((kit) => normaliseBrandName(kit.name) === target)
  if (exact) return exact

  return (
    kits.find((kit) => {
      const candidate = normaliseBrandName(kit.name)
      return candidate.includes(target) || target.includes(candidate)
    }) ?? null
  )
}

interface DesignCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type DesignFormat =
  | 'instagram_post'
  | 'instagram_story'
  | 'facebook_post'
  | 'linkedin_post'
  | 'tiktok_video'
  | 'youtube_thumbnail'
  | 'a4_document'

const FORMATS: { id: DesignFormat; label: string; dimensions: string }[] = [
  { id: 'instagram_post', label: 'IG Post', dimensions: '1080x1080' },
  { id: 'instagram_story', label: 'IG Story', dimensions: '1080x1920' },
  { id: 'facebook_post', label: 'Facebook', dimensions: '1200x630' },
  { id: 'linkedin_post', label: 'LinkedIn', dimensions: '1200x627' },
  { id: 'tiktok_video', label: 'TikTok', dimensions: '1080x1920' },
  { id: 'youtube_thumbnail', label: 'YT Thumbnail', dimensions: '1280x720' },
  { id: 'a4_document', label: 'A4', dimensions: '595x842' },
]

export function DesignCreatePanel({ brand, strategyContext }: DesignCreatePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState<DesignFormat>('instagram_post')
  const [sending, setSending] = useState(false)
  const [brandKits, setBrandKits] = useState<CanvaBrandKit[]>([])
  const [selectedBrandKit, setSelectedBrandKit] = useState<CanvaBrandKit | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generatedDesign, setGeneratedDesign] = useState<{
    id: string
    title: string
    thumbnail_url?: string
    edit_url?: string
  } | null>(null)

  // Fetch Canva brand kits on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/canva/brand-kits')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.brand_kits?.length) return
        const kits: CanvaBrandKit[] = data.brand_kits
        setBrandKits(kits)
        // Auto-select only this brand's own kit. There is deliberately no
        // fallback to a default or first kit: applying another brand's kit
        // would put its colours and logo on this brand's designs, which is
        // worse than generating from the brand's own colours. When nothing
        // matches, the user picks a kit explicitly.
        const matched = brand?.name ? findBrandKitForBrand(kits, brand.name) : null
        setSelectedBrandKit(matched)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [brand?.name])

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)
    setGeneratedDesign(null)
    setGenerating(true)

    const selectedFormat = FORMATS.find(f => f.id === format)
    const brandKitLine = selectedBrandKit
      ? `Use Canva brand kit ID "${selectedBrandKit.id}" for consistent brand colours and fonts.`
      : `${brand.name} has no Canva brand kit. Use its saved brand colours — never another brand's kit.`

    const message = [
      `I'd like to create a ${selectedFormat?.label ?? format} design for ${brand.name}.`,
      prompt.trim()
        ? `Topic: ${prompt.trim()}.`
        : 'Choose a topic based on the current strategy.',
      `Format: ${format} (${selectedFormat?.dimensions}).`,
      brandKitLine,
      '',
      'Before you generate it, can you suggest 2-3 design concepts and ask which one I prefer? Include style, colours, and layout ideas.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)
    setGeneratedDesign(null)
    setGenerating(true)

    sendToDirector(
      [
        `I need a new graphic design for ${brand.name} but I'm not sure what to create.`,
        'Based on the current strategy, which platform needs content most and what visual would work best?',
        `Suggest 2-3 design concepts with style, colours, and layout ideas — then ask which one I'd like you to create in Canva.`,
        '',
        strategyContext?.agentContext ?? '',
      ].filter(Boolean).join('\n')
    )
    setTimeout(() => setSending(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Prompt input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What do you need designed?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. Announcement post for new telehealth booking feature"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <button
            onClick={handleLetAIChoose}
            disabled={sending || !brand}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let AI choose
          </button>
        </div>
      </div>

      {/* Format selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                format === f.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <div className="font-medium">{f.label}</div>
              <div className="text-[9px] opacity-60">{f.dimensions}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Brand kit indicator */}
      {selectedBrandKit && (
        <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            Using brand kit: <span className="font-medium text-foreground">{selectedBrandKit.name}</span>
            {brandKits.length > 1 && (
              <select
                value={selectedBrandKit.id}
                onChange={(e) => {
                  const kit = brandKits.find((k) => k.id === e.target.value)
                  if (kit) setSelectedBrandKit(kit)
                }}
                className="ml-2 rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground"
              >
                {brandKits.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            )}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={sending || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending to Director...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Design
          </>
        )}
      </button>

      {/* Generating — click to check for result */}
      {generating && !generatedDesign && (
        <button
          type="button"
          onClick={async () => {
            if (!brand) return
            try {
              const res = await fetch(`/api/outputs?brandId=${brand.id}&limit=1`)
              if (res.ok) {
                const outputs = await res.json()
                const latest = outputs[0]
                if (latest && latest.output_type === 'design') {
                  setGeneratedDesign({
                    id: latest.id,
                    title: latest.title,
                    thumbnail_url: latest.metadata?.thumbnail_url,
                    edit_url: latest.metadata?.edit_url,
                  })
                  setGenerating(false)
                }
              }
            } catch {
              // Silently ignore fetch errors
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating... (click to check)
        </button>
      )}

      {/* Inline result display */}
      {generatedDesign && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">{generatedDesign.title}</h4>
            <span className="text-[10px] text-emerald-400">Generated</span>
          </div>
          {generatedDesign.thumbnail_url && (
            <img
              src={generatedDesign.thumbnail_url}
              alt={generatedDesign.title}
              className="w-full rounded-lg"
            />
          )}
          <div className="flex gap-2">
            {generatedDesign.edit_url && (
              <a
                href={generatedDesign.edit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[oklch(0.55_0.1_240)] px-3 py-2 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Canva
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setGeneratedDesign(null)
                setPrompt('')
                setGenerating(false)
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
