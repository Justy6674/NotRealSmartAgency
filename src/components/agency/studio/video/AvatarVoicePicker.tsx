'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Square, Settings } from 'lucide-react'
import type { HeyGenAvatar, HeyGenVoice } from '@/lib/heygen/client'

interface AvatarVoicePickerProps {
  onSelect: (selection: { avatarId: string; voiceId: string }) => void
  initialAvatarId?: string
  initialVoiceId?: string
}

export function AvatarVoicePicker({
  onSelect,
  initialAvatarId,
  initialVoiceId,
}: AvatarVoicePickerProps) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([])
  const [voices, setVoices] = useState<HeyGenVoice[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)

  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarId ?? '')
  const [selectedVoice, setSelectedVoice] = useState(initialVoiceId ?? '')
  const [playingAudio, setPlayingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch avatars and voices in parallel on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [avatarRes, voiceRes] = await Promise.all([
          fetch('/api/heygen/avatars'),
          fetch('/api/heygen/voices'),
        ])
        const [avatarData, voiceData] = await Promise.all([
          avatarRes.json(),
          voiceRes.json(),
        ])

        if (cancelled) return

        // If either says not configured, HeyGen is not connected
        if (avatarData.configured === false || voiceData.configured === false) {
          setConfigured(false)
          setLoading(false)
          return
        }

        setAvatars(avatarData.avatars ?? [])
        setVoices(voiceData.voices ?? [])

        // Auto-select first if no initial values
        const firstAvatar =
          initialAvatarId || (avatarData.avatars?.[0]?.avatar_id ?? '')
        const firstVoice =
          initialVoiceId || (voiceData.voices?.[0]?.voice_id ?? '')

        if (!cancelled) {
          setSelectedAvatar(firstAvatar)
          setSelectedVoice(firstVoice)
          if (firstAvatar && firstVoice) {
            onSelect({ avatarId: firstAvatar, voiceId: firstVoice })
          }
        }
      } catch {
        // Silent fail — picker just stays in loading/empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId)
    onSelect({ avatarId, voiceId: selectedVoice })
  }

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId)
    onSelect({ avatarId: selectedAvatar, voiceId })
  }

  const handlePlayPreview = () => {
    const voice = voices.find((v) => v.voice_id === selectedVoice)
    if (!voice?.preview_audio) return

    if (playingAudio && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlayingAudio(false)
      return
    }

    const audio = new Audio(voice.preview_audio)
    audioRef.current = audio
    setPlayingAudio(true)
    audio.addEventListener('ended', () => setPlayingAudio(false))
    audio.play().catch(() => setPlayingAudio(false))
  }

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  /* ---- No API key state ---- */
  if (!loading && !configured) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.55_0.1_240)]/10">
            <Settings className="h-4 w-4 text-[oklch(0.55_0.1_240)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Connect HeyGen to pick your AI presenter
            </p>
            <p className="text-xs text-muted-foreground">
              Add your API key in Brand Settings &rarr; Video tab to browse
              avatars and voices.
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ---- Loading skeletons ---- */
  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <div className="mb-2 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 w-20 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  const currentVoice = voices.find((v) => v.voice_id === selectedVoice)

  return (
    <div className="space-y-4">
      {/* Avatar thumbnails — horizontal scroll */}
      <div>
        <label className="text-sm font-medium text-foreground">
          AI Presenter
        </label>
        {avatars.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No avatars available.
          </p>
        ) : (
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {avatars.map((avatar) => (
              <button
                key={avatar.avatar_id}
                type="button"
                onClick={() => handleAvatarSelect(avatar.avatar_id)}
                className={`flex-none rounded-lg transition-all ${
                  selectedAvatar === avatar.avatar_id
                    ? 'ring-2 ring-[oklch(0.55_0.1_240)] ring-offset-1 ring-offset-background'
                    : 'ring-1 ring-border hover:ring-[oklch(0.55_0.1_240)]/30'
                }`}
              >
                {avatar.preview_image_url ? (
                  <img
                    src={avatar.preview_image_url}
                    alt={avatar.avatar_name}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    {avatar.avatar_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="mt-1 max-w-[80px] truncate text-center text-[10px] text-muted-foreground">
                  {avatar.avatar_name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice dropdown + preview */}
      <div>
        <label className="text-sm font-medium text-foreground">Voice</label>
        <div className="mt-2 flex gap-2">
          <select
            value={selectedVoice}
            onChange={(e) => handleVoiceSelect(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[oklch(0.55_0.1_240)]/50 focus:outline-none"
          >
            {voices.map((voice) => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.display_name}
                {voice.gender !== 'unknown' ? ` (${voice.gender})` : ''}
              </option>
            ))}
          </select>

          {currentVoice?.preview_audio && (
            <button
              type="button"
              onClick={handlePlayPreview}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30 hover:text-foreground transition-colors"
              title={playingAudio ? 'Stop preview' : 'Play voice preview'}
            >
              {playingAudio ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {playingAudio ? 'Stop' : 'Preview'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
