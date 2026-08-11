'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUpRight, CheckCircle2, FileText, Loader2, Palette } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { useAgencyStore } from '@/stores/agency-store'

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

const PLATFORM_OPTIONS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn'] as const

const STARTERS = [
  { label: 'Canva asset', prompt: 'Create a polished Canva image proposal using my selected media.' },
  { label: 'TikTok caption', prompt: 'Write a TikTok caption proposal using my selected media.' },
  { label: 'Carousel', prompt: 'Create a social carousel proposal using my selected media.' },
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
  hasUploadedMedia,
  initialConversationId,
}: {
  brand: DeskBrand
  selectedMediaIds: string[]
  selectedMediaNames: string[]
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
  const [platforms, setPlatforms] = useState<string[]>([])
  const [results, setResults] = useState<DeskResults>({ outputs: [], drafts: [] })
  const [resultLoading, setResultLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  brandIdRef.current = brand.id
  const effectiveMediaIds = hasUploadedMedia ? selectedMediaIds : restoredMediaIds
  const effectiveMediaNames = hasUploadedMedia
    ? selectedMediaNames
    : restoredMediaIds.map((_, index) => `saved NRS file ${index + 1}`)

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
    setLocalError('NRS kept your work context, but this reply did not finish. You can send the instruction again.')
  }, [clearError, error, refreshResults, setMessages])

  useEffect(() => {
    if (!initialConversationId) return
    conversationIdRef.current = initialConversationId
    setConversationId(initialConversationId)
    useAgencyStore.getState().setConversation(initialConversationId)

    void Promise.all([
      fetch(`/api/conversations/${initialConversationId}/messages`).then(async (response) => {
        if (!response.ok) throw new Error('That saved NRS Desk conversation is no longer available.')
        const data = await response.json() as {
          conversation?: { brand_id?: string }
          messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
        }
        if (data.conversation?.brand_id !== brand.id) throw new Error('That conversation belongs to a different business.')
        setMessages((data.messages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          parts: [{ type: 'text' as const, text: message.content }],
        })))
      }),
      fetch(`/api/desk/context?conversationId=${encodeURIComponent(initialConversationId)}`).then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { context?: { media_item_ids?: string[] } }
        setRestoredMediaIds(data.context?.media_item_ids ?? [])
      }),
      refreshResults(initialConversationId),
    ]).catch((cause) => {
      setLocalError(cause instanceof Error ? cause.message : 'NRS could not restore this conversation.')
    })
  }, [brand.id, initialConversationId, refreshResults, setMessages])

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
      const contextResponse = await fetch('/api/desk/context', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          selectedMediaIds: effectiveMediaIds,
          mediaItemIds: effectiveMediaIds,
          intent: instruction,
          platforms,
          state: 'working',
        }),
      })
      if (!contextResponse.ok) {
        const details = await contextResponse.json().catch(() => ({})) as { error?: string }
        throw new Error(details.error || 'NRS could not save the selected files for this instruction.')
      }

      clientTurnIdRef.current = crypto.randomUUID()
      await sendMessage({ text: instruction })
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'NRS could not send that instruction.')
    }
  }, [clearError, effectiveMediaIds, ensureConversation, isLoading, platforms, sendMessage])

  const togglePlatform = (platform: string) => {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform])
  }

  const hasResults = results.outputs.length > 0 || results.drafts.length > 0

  return (
    <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border bg-card shadow-sm">
      <header className="border-b px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">NRS Director</p>
            <h2 className="mt-1 text-xl font-semibold">What should we make?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {effectiveMediaIds.length > 0
                ? `${effectiveMediaIds.length} selected file${effectiveMediaIds.length === 1 ? '' : 's'}: ${effectiveMediaNames.join(', ')}`
                : 'Ask a question, plan content, or upload media beside this chat.'}
            </p>
          </div>
          {conversationId && (
            <Link href={`/agency/studio/create?conversation=${conversationId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Open in Creator <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Where is this for?</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((platform) => (
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
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col justify-center">
            <p className="text-sm font-medium">Start with one clear instruction</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((starter) => (
                <button key={starter.label} type="button" onClick={() => void handleSend(starter.prompt)} className="rounded-2xl border bg-background p-4 text-left transition hover:border-primary/60 hover:bg-muted/50">
                  <p className="text-sm font-medium">{starter.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{starter.prompt}</p>
                </button>
              ))}
              <button
                type="button"
                disabled={platforms.length === 0}
                onClick={() => void handleSend(`Create a review draft for ${platforms.join(', ')} using my selected media. Do not publish it.`)}
                className="rounded-2xl border bg-background p-4 text-left transition hover:border-primary/60 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <p className="text-sm font-medium">Create review draft</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose at least one platform first. Nothing publishes from NRS Desk.</p>
              </button>
            </div>
          </div>
        ) : messages.map((message) => <ChatMessage key={message.id} message={message} />)}
        {isLoading && <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> The Director is working…</div>}
        {(localError || error) && <div role="alert" className="my-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{localError || error?.message}</div>}

        {hasResults && (
          <div className="mt-5 border-t pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ready for you</h3>
              {resultLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="mt-3 space-y-2">
              {results.outputs.map((output) => (
                <div key={output.id} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  {output.metadata?.canva_design_id || output.output_type === 'video' ? <Palette className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{output.title || 'Content proposal'}</p><p className="text-xs text-muted-foreground">Proposal saved in NRS</p></div>
                  <Link href={`/agency/studio/create?conversation=${conversationId}&output=${output.id}`} className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted">Continue</Link>
                </div>
              ))}
              {results.drafts.map((draft) => {
                const sync = mixpostState(draft)
                return (
                  <div key={draft.id} className="rounded-xl border bg-background p-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{draft.platform || 'Social'} review draft</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{draft.caption || 'Draft created for review.'}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">Mixpost: {sync}. Nothing has been published.</p>
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

      <ChatInput
        onSend={(text) => void handleSend(text)}
        isLoading={isLoading}
        placeholder={`Ask NRS about ${brand.name}, or type / for shortcuts`}
        agentType="overall"
        showChips={false}
        allowAttachments={false}
      />
    </section>
  )
}
