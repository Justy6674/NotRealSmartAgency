'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Palette, Sparkles, Wand2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand, ToneOfVoice } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type VideoType = 'talking_head' | 'slideshow' | 'explainer' | 'promo' | 'testimonial' | 'tutorial'
type AspectRatio = '9:16' | '16:9' | '1:1'

const VIDEO_TYPES: { id: VideoType; label: string; description: string; icon: string }[] = [
  { id: 'talking_head', label: 'Talking Head', description: 'Record or edit a direct-to-camera video', icon: '🎙️' },
  { id: 'slideshow', label: 'Photo Slideshow', description: 'Images with narration and music', icon: '🖼️' },
  { id: 'explainer', label: 'Explainer', description: 'Step-by-step with visuals', icon: '📋' },
  { id: 'promo', label: 'Promo / Ad', description: 'Short, punchy promotional clip', icon: '🔥' },
  { id: 'testimonial', label: 'Customer Story', description: 'Customer story format', icon: '⭐' },
  { id: 'tutorial', label: 'How-To', description: 'Tutorial or demo walkthrough', icon: '🎓' },
]

const FORMATS: { id: AspectRatio; label: string; platforms: string }[] = [
  { id: '9:16', label: 'Vertical (9:16)', platforms: 'TikTok, Reels, Shorts' },
  { id: '16:9', label: 'Landscape (16:9)', platforms: 'YouTube, LinkedIn, Facebook' },
  { id: '1:1', label: 'Square (1:1)', platforms: 'Instagram Feed, Facebook' },
]

export function VideoCreatePanel({ brand, strategyContext }: VideoCreatePanelProps) {
  const [topic, setTopic] = useState('')
  const [videoType, setVideoType] = useState<VideoType>('talking_head')
  const [format, setFormat] = useState<AspectRatio>('9:16')
  const [sending, setSending] = useState(false)

  function sendVideoBrief(chooseTopic: boolean) {
    if (!brand) return
    setSending(true)

    const tone = brand.tone_of_voice as ToneOfVoice | null
    const typeLabel = VIDEO_TYPES.find((type) => type.id === videoType)?.label ?? videoType
    const topicLine = chooseTopic
      ? 'Choose the best topic from the current strategy before writing anything.'
      : topic.trim()
        ? `Topic: "${topic.trim()}"`
        : 'Choose the best topic from the current strategy before writing anything.'

    sendToDirector([
      `Prepare a ${format} ${typeLabel.toLowerCase()} production brief for ${brand.name}.`,
      topicLine,
      `Platform format: ${FORMATS.find((item) => item.id === format)?.platforms ?? format}.`,
      `Brand voice: ${tone?.formality ?? 'not set'}, ${tone?.humour ?? 'no'} humour.`,
      tone?.keywords?.length ? `Keywords to use: ${tone.keywords.join(', ')}.` : '',
      tone?.avoid_words?.length ? `Words to avoid: ${tone.avoid_words.join(', ')}.` : '',
      (brand.content_pillars as string[] | null)?.length ? `Content pillars: ${(brand.content_pillars as string[]).join(', ')}.` : '',
      'Return a speakable script, timed scene list, visual directions, on-screen captions, accessibility captions, and an asset checklist. Check compliance before recommending publication. Use only NRS-owned video tooling where it is configured; otherwise clearly mark the brief ready for recording or editing.',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n'))

    window.setTimeout(() => setSending(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What is the video about?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. 5 tips for managing weight during winter"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[oklch(0.55_0.1_240)]/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => sendVideoBrief(true)}
            disabled={sending || !brand}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let strategy choose
          </button>
        </div>
      </div>

      {brand?.tone_of_voice && (() => {
        const tone = brand.tone_of_voice as ToneOfVoice
        return (
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Brand Voice</p>
            <div className="flex flex-wrap gap-1.5">
              {tone.formality && <span className="rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[10px] text-[oklch(0.55_0.1_240)]">{tone.formality}</span>}
              {tone.humour && tone.humour !== 'none' && <span className="rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[10px] text-[oklch(0.55_0.1_240)]">{tone.humour} humour</span>}
              {tone.keywords?.slice(0, 3).map((keyword: string) => <span key={keyword} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">{keyword}</span>)}
            </div>
          </div>
        )
      })()}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What type of video?</label>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setVideoType(type.id)}
              className={`rounded-lg border p-2.5 text-left transition-all ${videoType === type.id ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10' : 'border-border bg-card hover:border-primary/30'}`}
            >
              <div className="text-sm font-medium text-foreground">{type.icon} {type.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="flex gap-2">
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFormat(item.id)}
              className={`flex-1 rounded-lg border p-2.5 text-center transition-all ${format === item.id ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10' : 'border-border bg-card hover:border-primary/30'}`}
            >
              <div className="text-xs font-medium text-foreground">{item.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{item.platforms}</div>
            </button>
          ))}
        </div>
      </div>

      {topic.trim() && brand && (
        <button
          type="button"
          onClick={() => sendToDirector(`Create a video thumbnail for ${brand.name} about "${topic.trim()}". Use Canva with our brand kit. Format: ${format === '9:16' ? '1080x1920' : format === '16:9' ? '1280x720' : '1080x1080'}.`)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <Palette className="h-3.5 w-3.5" />
          Generate Thumbnail
        </button>
      )}

      <button
        type="button"
        onClick={() => sendVideoBrief(false)}
        disabled={sending || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Preparing...</> : <>{brand?.logo_url && <Image src={brand.logo_url} alt={brand.name ?? 'Brand'} width={20} height={20} className="rounded-full object-cover" />}<Sparkles className="h-4 w-4" />Build Video Plan</>}
      </button>
    </div>
  )
}
