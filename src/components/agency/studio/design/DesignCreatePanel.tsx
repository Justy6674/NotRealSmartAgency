'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface CanvaBrandKit {
  id: string
  name: string
  is_default?: boolean
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

  // Fetch Canva brand kits on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/canva/brand-kits')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.brand_kits?.length) return
        const kits: CanvaBrandKit[] = data.brand_kits
        setBrandKits(kits)
        // Auto-select: match by brand name if possible, otherwise pick the default or first
        const brandName = brand?.name?.toLowerCase() ?? ''
        const matched =
          kits.find((k) => k.name.toLowerCase().includes(brandName)) ??
          kits.find((k) => k.is_default) ??
          kits[0]
        if (matched) setSelectedBrandKit(matched)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [brand?.name])

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)

    const selectedFormat = FORMATS.find(f => f.id === format)
    const brandKitLine = selectedBrandKit
      ? `Use Canva brand kit ID "${selectedBrandKit.id}" for consistent brand colours and fonts.`
      : 'Use the brand kit if available.'

    const message = [
      `Design a ${selectedFormat?.label ?? format} graphic for ${brand.name}.`,
      prompt.trim()
        ? `Design brief: "${prompt.trim()}"`
        : 'Choose the best design based on the strategy context.',
      `Format: ${format} (${selectedFormat?.dimensions}).`,
      `${brandKitLine} Create it in Canva, then show me the result.`,
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)

    sendToDirector(
      [
        `Suggest and create the best graphic design for ${brand.name} right now based on the strategy.`,
        'Consider which platform needs content and what visual would support the next post.',
        'Create it in Canva using the brand kit.',
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
    </div>
  )
}
