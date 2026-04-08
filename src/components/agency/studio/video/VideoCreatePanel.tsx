'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Sparkles, Wand2, Loader2, Palette } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { AvatarVoicePicker } from './AvatarVoicePicker'
import type { Brand, ToneOfVoice } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type VideoType = 'presenter' | 'slideshow' | 'explainer' | 'promo' | 'testimonial' | 'tutorial'
type AspectRatio = '9:16' | '16:9' | '1:1'

const VIDEO_TYPES: { id: VideoType; label: string; description: string; icon: string }[] = [
  { id: 'presenter', label: 'Talking Head', description: 'AI presenter speaks to camera', icon: '🎙️' },
  { id: 'slideshow', label: 'Photo Slideshow', description: 'Images with voiceover + music', icon: '🖼️' },
  { id: 'explainer', label: 'Explainer', description: 'Step-by-step with visuals', icon: '📋' },
  { id: 'promo', label: 'Promo / Ad', description: 'Short punchy promotional clip', icon: '🔥' },
  { id: 'testimonial', label: 'Testimonial', description: 'Customer story format', icon: '⭐' },
  { id: 'tutorial', label: 'How-To', description: 'Tutorial or demo walkthrough', icon: '🎓' },
]

const FORMATS: { id: AspectRatio; label: string; platforms: string }[] = [
  { id: '9:16', label: 'Vertical (9:16)', platforms: 'TikTok, Reels, Shorts' },
  { id: '16:9', label: 'Landscape (16:9)', platforms: 'YouTube, LinkedIn, Facebook' },
  { id: '1:1', label: 'Square (1:1)', platforms: 'Instagram Feed, Facebook' },
]

export function VideoCreatePanel({ brand, strategyContext }: VideoCreatePanelProps) {
  const [topic, setTopic] = useState('')
  const [videoType, setVideoType] = useState<VideoType>('presenter')
  const [format, setFormat] = useState<AspectRatio>('9:16')
  const [sending, setSending] = useState(false)
  const [avatarId, setAvatarId] = useState(
    (brand?.video_preferences as Record<string, string> | null)?.avatar_id ?? ''
  )
  const [voiceId, setVoiceId] = useState(
    (brand?.video_preferences as Record<string, string> | null)?.accent ?? ''
  )
  const [credits, setCredits] = useState<number | null>(null)
  const [toolkitConfigured, setToolkitConfigured] = useState(false)
  const [aiVoice, setAiVoice] = useState('Ryan')
  const [includeMusic, setIncludeMusic] = useState(true)

  // Fetch HeyGen credits (used for presenter type)
  useEffect(() => {
    let cancelled = false
    fetch('/api/heygen/credits')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.configured) setCredits(data.credits)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Check if AI toolkit endpoints are configured
  useEffect(() => {
    let cancelled = false
    fetch('/api/video-toolkit/status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setToolkitConfigured(data.configured === true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Auto-save avatar/voice selection to brand video_preferences
  const handleAvatarVoiceSelect = useCallback(
    (selection: { avatarId: string; voiceId: string }) => {
      setAvatarId(selection.avatarId)
      setVoiceId(selection.voiceId)

      if (!brand?.id) return
      const updatedPrefs = {
        ...(brand.video_preferences as Record<string, string> | null),
        avatar_id: selection.avatarId,
        accent: selection.voiceId,
      }
      // Fire-and-forget save
      fetch('/api/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: brand.id,
          video_preferences: updatedPrefs,
        }),
      }).catch(() => {})
    },
    [brand]
  )

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)

    const tov = brand.tone_of_voice as ToneOfVoice | null
    const topicLine = topic.trim()
      ? `Topic: "${topic.trim()}"`
      : 'Choose the best topic based on the strategy context below.'

    const typeLabel = VIDEO_TYPES.find(t => t.id === videoType)?.label ?? videoType
    const avatarLine = avatarId ? `Avatar ID: ${avatarId}` : ''
    const voiceLine = voiceId ? `Voice ID: ${voiceId}` : ''

    const typeInstructions: Record<VideoType, string> = {
      presenter: 'Create a talking head video — AI presenter speaks directly to camera.',
      slideshow: 'Create a photo slideshow video with voiceover narration and background music. Use images that match the topic.',
      explainer: 'Create an explainer video — break down the topic step-by-step with visual aids and clear narration.',
      promo: 'Create a short promotional video — punchy, attention-grabbing, designed for ads or organic reach.',
      testimonial: 'Create a testimonial-style video — frame the content as a customer success story or case study.',
      tutorial: 'Create a how-to tutorial video — demonstrate the process with clear instructions and visual guidance.',
    }

    const message = [
      `Create a ${format} ${typeLabel.toLowerCase()} video for ${brand.name}.`,
      typeInstructions[videoType],
      topicLine,
      videoType === 'presenter' ? avatarLine : '',
      videoType === 'presenter' ? voiceLine : '',
      `Platform format: ${FORMATS.find(f => f.id === format)?.platforms ?? format}.`,
      `Brand voice: ${tov?.formality ?? 'not set'}, ${tov?.humour ?? 'no'} humour.`,
      tov?.keywords?.length ? `Keywords to use: ${tov.keywords.join(', ')}.` : '',
      tov?.avoid_words?.length ? `Words to AVOID: ${tov.avoid_words.join(', ')}.` : '',
      (brand.content_pillars as string[] | null)?.length ? `Content pillars: ${(brand.content_pillars as string[]).join(', ')}.` : '',
      '',
      'Write the script, check compliance, then generate the video.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)

    const tovAI = brand.tone_of_voice as ToneOfVoice | null

    const message = [
      `Suggest the best video topic for ${brand.name} right now based on the strategy.`,
      'Consider what content type is needed, which platform is underserved, and what pillar to rotate to.',
      `Brand voice: ${tovAI?.formality ?? 'not set'}, ${tovAI?.humour ?? 'no'} humour.`,
      tovAI?.keywords?.length ? `Keywords to use: ${tovAI.keywords.join(', ')}.` : '',
      tovAI?.avoid_words?.length ? `Words to AVOID: ${tovAI.avoid_words.join(', ')}.` : '',
      (brand.content_pillars as string[] | null)?.length ? `Content pillars: ${(brand.content_pillars as string[]).join(', ')}.` : '',
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
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let strategy choose
          </button>
        </div>
      </div>

      {/* Brand voice summary */}
      {brand?.tone_of_voice && (() => {
        const tv = brand.tone_of_voice as ToneOfVoice
        return (
          <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Brand Voice</p>
            <div className="flex flex-wrap gap-1.5">
              {tv.formality && (
                <span className="rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[10px] text-[oklch(0.55_0.1_240)]">
                  {tv.formality}
                </span>
              )}
              {tv.humour && tv.humour !== 'none' && (
                <span className="rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[10px] text-[oklch(0.55_0.1_240)]">
                  {tv.humour} humour
                </span>
              )}
              {tv.keywords?.slice(0, 3).map((k: string) => (
                <span key={k} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                  {k}
                </span>
              ))}
            </div>
            {!tv.formality && (
              <p className="text-[10px] text-amber-400 mt-1">Set your brand voice in Brand Settings for better videos</p>
            )}
          </div>
        )
      })()}

      {/* Avatar & Voice picker — HeyGen only */}
      {videoType === 'presenter' && (
        <AvatarVoicePicker
          onSelect={handleAvatarVoiceSelect}
          initialAvatarId={avatarId || undefined}
          initialVoiceId={voiceId || undefined}
        />
      )}

      {/* Video type selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What type of video?</label>
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setVideoType(t.id)}
              className={`rounded-lg border p-2.5 text-left transition-all ${
                videoType === t.id
                  ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="text-sm font-medium text-foreground">{t.icon} {t.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{t.description}</div>
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
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="text-xs font-medium text-foreground">{f.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{f.platforms}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate thumbnail */}
      {topic.trim() && brand && (
        <button
          type="button"
          onClick={() => {
            sendToDirector(
              `Create a video thumbnail for ${brand.name} about "${topic.trim()}". Use Canva with our brand kit for consistent design. Format: ${format === '9:16' ? '1080x1920' : format === '16:9' ? '1280x720' : '1080x1080'}.`
            )
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
        >
          <Palette className="h-3.5 w-3.5" />
          Generate Thumbnail
        </button>
      )}

      {/* Generate button + credits badge */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={sending || !brand}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending to Director...
            </>
          ) : (
            <>
              {brand?.logo_url && (
                <Image
                  src={brand.logo_url}
                  alt={brand.name ?? 'Brand'}
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              )}
              <Sparkles className="h-4 w-4" />
              Generate Video
            </>
          )}
        </button>
        {videoType === 'presenter' && credits !== null && credits >= 0 && (
          <span className="whitespace-nowrap rounded-md bg-[oklch(0.55_0.1_240)]/10 px-2.5 py-1.5 text-xs font-medium text-[oklch(0.55_0.1_240)]">
            {credits} credits
          </span>
        )}
      </div>
    </div>
  )
}
