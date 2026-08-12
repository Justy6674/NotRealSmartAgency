'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { useAgencyStore } from '@/stores/agency-store'
import { deskCreativeStateForMessage, type DeskCreativeState } from '@/lib/desk/creative-flow'
import { deskPlatformOptions } from '@/lib/desk/platform-options'
import { useConnectedPlatforms } from '@/hooks/useConnectedPlatforms'

interface DeskBrand {
  id: string
  name: string
  slug: string
}

interface DeskOutput {
  id: string
  output_type?: string | null
  title?: string | null
  content?: string | null
  metadata?: Record<string, unknown> | null
}

interface DeskDraft {
  id: string
  platform?: string | null
  caption?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
}

interface DeskResults {
  outputs: DeskOutput[]
  drafts: DeskDraft[]
}

const STARTERS = [
  { label: 'A social post', prompt: 'I want to make a social post. Start by confirming the point, audience and voice before you write it.' },
  { label: 'A caption', prompt: 'I need a caption. First tell me what you understand the message and purpose to be, then ask one question if needed.' },
  { label: 'A campaign idea', prompt: 'Help me shape a campaign idea. Start by reflecting the outcome you think I want before proposing anything.' },
]

function mixpostState(draft: DeskDraft): 'synced' | 'failed' | 'pending' {
  const mixpost = draft.metadata?.mixpost
  if (mixpost && typeof mixpost === 'object') {
    const details = mixpost as Record<string, unknown>
    if (details.post_uuid) return 'synced'
    if (details.error || details.last_error) return 'failed'
  }
  return 'pending'
}

export function NrsDeskConversation({
  brand,
  selectedMediaIds,
  selectedMediaNames,
  selectedMediaTypes,
  hasUploadedMedia,
  initialConversationId,
}: {
  brand: DeskBrand
  selectedMediaIds: string[]
  selectedMediaNames: string[]
  selectedMediaTypes: string[]
  hasUploadedMedia: boolean
  initialConversationId?: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(initialConversationId ?? null)
  const creationRef = useRef<Promise<string> | null>(null)
  const clientTurnIdRef = useRef<string | null>(null)
  const brandIdRef = useRef(brand.id)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null)
  const [restoredMediaIds, setRestoredMediaIds] = useState<string[]>([])
  const [deskState, setDeskState] = useState<DeskCreativeState>('collecting')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [results, setResults] = useState<DeskResults>({ outputs: [], drafts: [] })
  const [resultLoading, setResultLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const { platforms: connectedPlatforms, loading: connectedPlatformsLoading } = useConnectedPlatforms(brand.id)
  const platformOptions = useMemo(
    () => deskPlatformOptions(connectedPlatforms),
    [connectedPlatforms],
  )

  brandIdRef.current = brand.id
  const effectiveMediaIds = hasUploadedMedia ? selectedMediaIds : restoredMediaIds
  const effectiveMediaNames = hasUploadedMedia
    ? selectedMediaNames
    : restoredMediaIds.map((_, index) => `saved NRS file ${index + 1}`)
  const effectiveMediaTypes = hasUploadedMedia ? selectedMediaTypes : []
  const sourceTypes = effectiveMediaTypes.length > 0
    ? effectiveMediaTypes
    : effectiveMediaNames.map(() => '')
  const sourceSummary = effectiveMediaIds.length === 0
    ? null
    : sourceTypes.map((type, index) => `${type.startsWith('video/') ? 'Video' : type.startsWith('image/') ? 'Image' : type.startsWith('audio/') ? 'Audio' : 'File'} uploaded: ${effectiveMediaNames[index] ?? `file ${index + 1}`}`)

  useEffect(() => {
    useAgencyStore.getState().setBrand(brand.id)
    return () => {
      useAgencyStore.getState().setConversation(null)
    }
  }, [brand.id])

  const refreshResults = useCallback(async (id = conversationIdRef.current) => {
    if (!id) return
    setResultLoading(true)
    try {
      const response = await fetch(`/api/desk/results?conversationId=${encodeURIComponent(id)}`)
      if (!response.ok) return
      const data = await response.json() as Partial<DeskResults>
      setResults({ outputs: data.outputs ?? [], drafts: data.drafts ?? [] })
    } finally {
      setResultLoading(false)
    }
  }, [])

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: {
      get brandId() { return brandIdRef.current },
      agentType: 'overall',
      get conversationId() { return conversationIdRef.current },
      get clientTurnId() { return clientTurnIdRef.current },
    },
  }), [])

  const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
    id: `nrs-desk-${brand.id}`,
    transport,
    onFinish: () => { void refreshResults() },
  })
  const isLoading = status === 'streaming' || status === 'submitted'

  const reloadSavedMessages = useCallback(async (id = conversationIdRef.current) => {
    if (!id) return false
    const response = await fetch(`/api/conversations/${id}/messages`)
    if (!response.ok) return false
    const data = await response.json() as {
      conversation?: { brand_id?: string }
      messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
    }
    if (data.conversation?.brand_id !== brand.id) return false
    setMessages((data.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: 'text' as const, text: message.content }],
    })))
    return true
  }, [brand.id, setMessages])

  useEffect(() => {
    if (!error) return
    try {
      const replay = JSON.parse(error.message) as {
        error?: string
        friendlyMessage?: string
        existingResponse?: string
      }
      if (replay.error === 'DuplicateTurn') {
        if (replay.existingResponse) {
          const existingResponse = replay.existingResponse
          const replayId = `desk-replay-${clientTurnIdRef.current ?? crypto.randomUUID()}`
          setMessages((current) => current.some((message) => message.id === replayId)
            ? current
            : [...current, {
                id: replayId,
                role: 'assistant',
                parts: [{ type: 'text' as const, text: existingResponse }],
              }])
          setLocalError(null)
          clearError()
          void refreshResults()
          return
        }
        setLocalError(replay.friendlyMessage || 'NRS is already working on this request. Its answer will remain in this conversation.')
        return
      }
    } catch {
      // Non-JSON transport errors use the plain recovery message below.
    }
    let cancelled = false
    void reloadSavedMessages().then((restored) => {
      if (cancelled) return
      if (restored) {
        setLocalError('The connection dropped after the Director finished. The saved reply is back in this chat.')
        clearError()
        void refreshResults()
        return
      }
      setLocalError('The connection dropped before the Director could finish. Your source and work context are still here.')
    }).catch(() => {
      if (!cancelled) setLocalError('The connection dropped before the Director could finish. Your source and work context are still here.')
    })
    return () => { cancelled = true }
  }, [clearError, error, refreshResults, reloadSavedMessages, setMessages])

  useEffect(() => {
    if (!initialConversationId) return
    conversationIdRef.current = initialConversationId
    setConversationId(initialConversationId)
    useAgencyStore.getState().setConversation(initialConversationId)

    void Promise.all([
      reloadSavedMessages(initialConversationId).then((restored) => {
        if (!restored) throw new Error('That saved NRS Desk conversation is no longer available.')
      }),
      fetch(`/api/desk/context?conversationId=${encodeURIComponent(initialConversationId)}`).then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { context?: { media_item_ids?: string[]; state?: DeskCreativeState } }
        setRestoredMediaIds(data.context?.media_item_ids ?? [])
        setDeskState(data.context?.state ?? 'collecting')
      }),
      refreshResults(initialConversationId),
    ]).catch((cause) => {
      setLocalError(cause instanceof Error ? cause.message : 'NRS could not restore this conversation.')
    })
  }, [initialConversationId, refreshResults, reloadSavedMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  const ensureConversation = useCallback(async (title: string) => {
    if (conversationIdRef.current) return conversationIdRef.current
    if (creationRef.current) return creationRef.current

    creationRef.current = (async () => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          agentType: 'overall',
          title: title.slice(0, 90),
          source: 'nrs_desk',
          mediaItemIds: effectiveMediaIds,
          platforms,
        }),
      })
      const data = await response.json().catch(() => ({})) as { id?: string; error?: string }
      if (!response.ok || !data.id) throw new Error(data.error || 'NRS could not start this piece of work.')
      conversationIdRef.current = data.id
      setConversationId(data.id)
      useAgencyStore.getState().setConversation(data.id)
      window.history.replaceState(null, '', `/desktop-upload?brand=${encodeURIComponent(brand.slug)}&conversation=${encodeURIComponent(data.id)}`)
      return data.id
    })()

    try {
      return await creationRef.current
    } finally {
      creationRef.current = null
    }
  }, [brand.id, brand.slug, effectiveMediaIds, platforms])

  const handleSend = useCallback(async (text: string) => {
    const instruction = text.trim()
    if (!instruction || isLoading) return
    setLocalError(null)
    clearError()

    try {
      const id = await ensureConversation(instruction)
      const nextDeskState = deskCreativeStateForMessage(deskState, instruction)
      const contextResponse = await fetch('/api/desk/context', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          selectedMediaIds: effectiveMediaIds,
          mediaItemIds: effectiveMediaIds,
          intent: instruction,
          platforms,
          state: nextDeskState,
        }),
      })
      if (!contextResponse.ok) {
        const details = await contextResponse.json().catch(() => ({})) as { error?: string }
        throw new Error(details.error || 'NRS could not save the selected files for this instruction.')
      }

      setDeskState(nextDeskState)

      clientTurnIdRef.current = crypto.randomUUID()
      await sendMessage({ text: instruction })
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'NRS could not send that instruction.')
    }
  }, [clearError, deskState, effectiveMediaIds, ensureConversation, isLoading, platforms, sendMessage])

  const togglePlatform = (platform: string) => {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform])
  }

  const hasResults = results.drafts.length > 0

  return (
    <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border bg-card shadow-sm lg:h-[calc(100dvh-12rem)] lg:max-h-[900px]">
      <header className="border-b px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">NRS Director</p>
            <h2 className="mt-1 text-xl font-semibold">Let’s get the post right</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sourceSummary
                ? `${sourceSummary.join(' · ')}. The Director will confirm what it understands before suggesting a post.`
                : 'Ask a question, plan content, or upload media beside this chat.'}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Where should we shape this for?</p>
          {connectedPlatformsLoading ? (
            <p className="text-xs text-muted-foreground">Checking your connected channels…</p>
          ) : platformOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {platformOptions.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  aria-pressed={platforms.includes(platform)}
                  onClick={() => togglePlatform(platform)}
                  className="rounded-full border px-3 py-1.5 text-xs transition aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {platform}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No publishing channels are connected to this brand yet.</p>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-44 pt-4 sm:px-6 lg:pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col justify-center">
            <p className="text-sm font-medium">Start with what you want to say</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(effectiveMediaIds.length > 0
                ? [{ label: 'Review this first', prompt: 'Review my selected media first. Tell me what you understand it to be, the point of the post, and the strongest direction. Do not create, save or draft anything yet.' }]
                : STARTERS).map((starter) => (
                <button key={starter.label} type="button" onClick={() => void handleSend(starter.prompt)} className="rounded-2xl border bg-background p-4 text-left transition hover:border-primary/60 hover:bg-muted/50">
                  <p className="text-sm font-medium">{starter.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{starter.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((message) => <ChatMessage key={message.id} message={message} />)}
        {isLoading && <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> The Director is working…</div>}
        {(localError || error) && <div role="alert" className="my-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{localError || error?.message}</div>}

        {hasResults && (
          <div className="mt-5 border-t pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Mixpost drafts</h3>
              {resultLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="mt-3 space-y-2">
              {results.drafts.map((draft) => {
                const sync = mixpostState(draft)
                return (
                  <div key={draft.id} className="rounded-xl border bg-background p-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{draft.platform || 'Social'} review draft</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{draft.caption || 'Draft created for review.'}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">Mixpost draft: {sync}. Nothing has been published.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Link href={`/agency/studio/create?conversation=${conversationId}&draft=${draft.id}`} className="rounded-md px-3 py-1.5 text-xs font-medium transition hover:bg-muted">Edit</Link>
                      <Link href={`/agency/studio/review?draft=${draft.id}`} className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted">Review</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div
        data-testid="nrs-desk-director-composer"
        className="pb-[env(safe-area-inset-bottom)] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:bg-background/95 max-lg:shadow-[0_-16px_36px_rgba(0,0,0,0.28)] max-lg:backdrop-blur-xl lg:shrink-0 lg:pb-0"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between px-4 pt-2 text-[11px] font-medium text-muted-foreground lg:hidden">
            <span>NRS Director</span>
            <span className="max-w-[55vw] truncate">{brand.name}</span>
          </div>
          <ChatInput
            onSend={(text) => void handleSend(text)}
            isLoading={isLoading}
            placeholder={`Ask NRS about ${brand.name}, or type / for shortcuts`}
            agentType="overall"
            showChips={false}
            allowAttachments={false}
          />
        </div>
      </div>
    </section>
  )
}
