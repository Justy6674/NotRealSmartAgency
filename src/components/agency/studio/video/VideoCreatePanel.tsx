'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type Provider = 'heygen' | 'openclaw'
type AspectRatio = '9:16' | '16:9' | '1:1'

const PROVIDERS: { id: Provider; label: string; description: string; disabled?: boolean }[] = [
  { id: 'heygen', label: 'AI Presenter', description: 'An AI avatar speaks your script' },
  { id: 'openclaw', label: 'AI Generated', description: 'AI creates visuals + voiceover — coming soon', disabled: true },
]

const FORMATS: { id: AspectRatio; label: string; platforms: string }[] = [
  { id: '9:16', label: 'Vertical (9:16)', platforms: 'TikTok, Reels, Shorts' },
  { id: '16:9', label: 'Landscape (16:9)', platforms: 'YouTube, LinkedIn, Facebook' },
  { id: '1:1', label: 'Square (1:1)', platforms: 'Instagram Feed, Facebook' },
]

export function VideoCreatePanel({ brand, strategyContext }: VideoCreatePanelProps) {
  const [topic, setTopic] = useState('')
  const [provider, setProvider] = useState<Provider>('heygen')
  const [format, setFormat] = useState<AspectRatio>('9:16')
  const [sending, setSending] = useState(false)

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)

    const topicLine = topic.trim()
      ? `Topic: "${topic.trim()}"`
      : 'Choose the best topic based on the strategy context below.'

    const message = [
      `Create a ${format} video for ${brand.name} using ${provider === 'heygen' ? 'HeyGen (AI avatar presenter)' : 'OpenClaw/Remotion (template-based)'}.`,
      topicLine,
      `Platform format: ${FORMATS.find(f => f.id === format)?.platforms ?? format}.`,
      '',
      'Write the script, check compliance, then generate the video.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)

    // Reset after a beat so the user sees the chat open
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)

    const message = [
      `Suggest the best video topic for ${brand.name} right now based on the strategy.`,
      'Consider what content type is needed, which platform is underserved, and what pillar to rotate to.',
      'Write the script and generate the video using HeyGen.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Topic input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What is the video about?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. 5 tips for managing weight during winter"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[oklch(0.55_0.1_240)]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleLetAIChoose}
            disabled={sending || !brand}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let strategy choose
          </button>
        </div>
      </div>

      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Video style</label>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => !p.disabled && setProvider(p.id)}
              disabled={p.disabled}
              className={`rounded-lg border p-3 text-left transition-all ${
                p.disabled
                  ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                  : provider === p.id
                    ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10'
                    : 'border-border bg-card hover:border-[oklch(0.55_0.1_240)]/30'
              }`}
            >
              <div className="text-sm font-medium text-foreground">{p.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform format selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="flex gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`flex-1 rounded-lg border p-2.5 text-center transition-all ${
                format === f.id
                  ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10'
                  : 'border-border bg-card hover:border-[oklch(0.55_0.1_240)]/30'
              }`}
            >
              <div className="text-xs font-medium text-foreground">{f.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{f.platforms}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={sending || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-3 text-sm font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending to Director...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Video
          </>
        )}
      </button>
    </div>
  )
}
