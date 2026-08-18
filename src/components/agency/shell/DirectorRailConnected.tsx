'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { DirectorRail, type DirectorSuggestion } from '@/components/agency/shell/DirectorRail'
import type { DirectorConversation } from '@/components/agency/shell/DirectorHistory'
import { useAgencyStore } from '@/stores/agency-store'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import {
  buildComposeDeskIntent,
  composeDeskIsActive,
  composeDirectorIdleCopy,
  composeDirectorSuggestions,
  wrapComposeDirectorPrompt,
} from '@/lib/desk/compose-desk'
import { deskCreativeStateForMessage, type DeskCreativeState } from '@/lib/desk/creative-flow'
import { readDeskContext } from '@/lib/desk/context'

/**
 * The Director rail, actually wired — including live Compose desk context.
 *
 * When PostCreator publishes a snapshot, this container PATCHes
 * `/api/desk/context` on the active conversation so `/api/chat` receives
 * media IDs, platforms and caption facts via conversation metadata. The footer
 * badge only claims "sees this screen" after that sync succeeds.
 */
export function DirectorRailConnected({
  brandName,
  brands = [],
}: {
  brandName?: string | null
  brands?: Array<{ id: string; name: string }>
}) {
  const {
    activeBrandId,
    activeConversationId,
    setConversation,
    selectConversation,
    setChatPanelOpen,
    setChatPanelMinimised,
  } = useAgencyStore()

  const composeSnapshot = useComposeDeskStore((s) => s.snapshot)

  const [panelConversationId, setPanelConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<DirectorConversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [deskContextLive, setDeskContextLive] = useState(false)
  const [deskState, setDeskState] = useState<DeskCreativeState>('collecting')

  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId
  const convIdRef = useRef(panelConversationId)
  convIdRef.current = panelConversationId
  const creationRef = useRef<Promise<string> | null>(null)
  const clientTurnIdRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          get brandId() {
            return brandIdRef.current
          },
          agentType: 'overall',
          get conversationId() {
            return convIdRef.current
          },
          get clientTurnId() {
            return clientTurnIdRef.current
          },
        },
      }),
    [],
  )

  const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
    transport,
    onError: (err) => {
      console.error('[director-rail] Stream error:', err.message)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const loadHistory = useCallback(async () => {
    if (!activeBrandId) {
      setConversations([])
      return
    }
    setHistoryLoading(true)
    setHistoryFailed(false)
    try {
      const res = await fetch(`/api/conversations?brandId=${activeBrandId}`)
      if (!res.ok) throw new Error(`conversations ${res.status}`)
      const rows = (await res.json()) as DirectorConversation[]
      setConversations(Array.isArray(rows) ? rows : [])
    } catch {
      setHistoryFailed(true)
      setConversations([])
    } finally {
      setHistoryLoading(false)
    }
  }, [activeBrandId])

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`)
      if (!res.ok) return
      const msgs = (await res.json()) as Array<{
        id: string
        role: string
        content: string
        created_at?: string
      }>
      if (!Array.isArray(msgs) || msgs.length === 0) {
        setMessages([])
        return
      }
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          parts: [{ type: 'text' as const, text: m.content }],
          createdAt: m.created_at ? new Date(m.created_at) : new Date(),
        })),
      )
    },
    [setMessages],
  )

  useEffect(() => {
    if (!activeBrandId) {
      setMessages([])
      setPanelConversationId(null)
      setConversations([])
      setDeskContextLive(false)
      return
    }

    let cancelled = false
    fetch(`/api/conversations?brandId=${activeBrandId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(async (convs: Array<DirectorConversation & { agent_type?: string; metadata?: unknown }>) => {
        if (cancelled) return
        const list = Array.isArray(convs) ? convs : []
        setConversations(list)
        const latest = list.find((c) => c.agent_type === 'overall') ?? list[0]
        if (!latest) {
          setMessages([])
          setPanelConversationId(null)
          setDeskContextLive(false)
          return
        }
        setPanelConversationId(latest.id)
        const ctx = readDeskContext(latest.metadata)
        setDeskContextLive(!!ctx)
        if (ctx?.state) setDeskState(ctx.state)
        await loadMessages(latest.id)
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setPanelConversationId(null)
          setDeskContextLive(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeBrandId, loadMessages, setMessages])

  useEffect(() => {
    if (activeConversationId && activeConversationId !== panelConversationId) {
      setPanelConversationId(activeConversationId)
      void loadMessages(activeConversationId)
    }
  }, [activeConversationId, panelConversationId, loadMessages])

  const ensureDeskConversation = useCallback(
    async (title: string) => {
      if (panelConversationId) return panelConversationId
      if (creationRef.current) return creationRef.current
      if (!activeBrandId) throw new Error('Select a business first.')

      creationRef.current = (async () => {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: activeBrandId,
            agentType: 'overall',
            title: title.slice(0, 90),
            source: 'nrs_desk',
            mediaItemIds: composeSnapshot?.mediaItemIds ?? [],
            platforms: composeSnapshot?.platforms ?? [],
          }),
        })
        const conv = await res.json()
        if (!res.ok || !conv?.id) {
          throw new Error(conv?.error ?? 'Could not start this conversation.')
        }
        setPanelConversationId(conv.id)
        setConversation(conv.id)
        void loadHistory()
        return conv.id as string
      })()

      try {
        return await creationRef.current
      } finally {
        creationRef.current = null
      }
    },
    [activeBrandId, composeSnapshot, loadHistory, panelConversationId, setConversation],
  )

  const syncDeskContext = useCallback(
    async (conversationId: string, intent?: string) => {
      if (!composeSnapshot || !composeDeskIsActive(composeSnapshot)) {
        setDeskContextLive(false)
        return false
      }
      if (composeSnapshot.brandId !== activeBrandId) return false

      const res = await fetch('/api/desk/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          mediaItemIds: composeSnapshot.mediaItemIds,
          platforms: composeSnapshot.platforms,
          intent: intent ?? buildComposeDeskIntent(composeSnapshot),
          state: deskState,
        }),
      })
      if (!res.ok) {
        setDeskContextLive(false)
        return false
      }
      setDeskContextLive(true)
      return true
    },
    [activeBrandId, composeSnapshot, deskState],
  )

  // Debounced sync whenever Compose publishes a new snapshot
  useEffect(() => {
    if (!composeSnapshot || !composeDeskIsActive(composeSnapshot)) {
      setDeskContextLive(false)
      return
    }
    if (composeSnapshot.brandId !== activeBrandId) return

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const id = await ensureDeskConversation('Compose desk')
          await syncDeskContext(id)
        } catch {
          setDeskContextLive(false)
        }
      })()
    }, 400)

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [activeBrandId, composeSnapshot, ensureDeskConversation, syncDeskContext])

  const handleSend = useCallback(
    async (text: string, images?: { data: string; mimeType: string }[]) => {
      if (!activeBrandId) return

      const id = await ensureDeskConversation(text)
      convIdRef.current = id

      if (composeSnapshot && composeDeskIsActive(composeSnapshot)) {
        const nextState = deskCreativeStateForMessage(deskState, text)
        setDeskState(nextState)
        await syncDeskContext(id, text.trim() || buildComposeDeskIntent(composeSnapshot))
      }

      clientTurnIdRef.current = crypto.randomUUID()

      const outbound =
        composeSnapshot && composeDeskIsActive(composeSnapshot)
          ? wrapComposeDirectorPrompt(composeSnapshot, text)
          : text

      if (images?.length) {
        const files = images.map((img) => ({
          type: 'file' as const,
          mediaType: img.mimeType,
          url: `data:${img.mimeType};base64,${img.data}`,
        }))
        await sendMessage({ text: outbound || 'What do you see in this image?', files })
      } else {
        await sendMessage({ text: outbound })
      }
    },
    [activeBrandId, composeSnapshot, deskState, ensureDeskConversation, sendMessage, syncDeskContext],
  )

  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message
      if (!msg) return
      setChatPanelMinimised(false)
      setChatPanelOpen(true)
      void handleSendRef.current(msg)
    }
    window.addEventListener('nrs-send-chat', handler)
    return () => window.removeEventListener('nrs-send-chat', handler)
  }, [setChatPanelMinimised, setChatPanelOpen])

  const handleSelectConversation = useCallback(
    (conversation: DirectorConversation) => {
      setPanelConversationId(conversation.id)
      selectConversation(conversation.id, conversation.agent_type ?? 'overall')
      void loadMessages(conversation.id)
    },
    [selectConversation, loadMessages],
  )

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setPanelConversationId(null)
    setConversation(null)
    setDeskContextLive(false)
  }, [setMessages, setConversation])

  const handleForgetBusiness = useCallback(async () => {
    if (!activeBrandId) return
    await fetch(`/api/memories?scope=brand&brandId=${activeBrandId}`, { method: 'DELETE' })
  }, [activeBrandId])

  const liveBrandName = brands.find((row) => row.id === activeBrandId)?.name ?? brandName

  const composeActive =
    composeSnapshot &&
    composeDeskIsActive(composeSnapshot) &&
    composeSnapshot.brandId === activeBrandId

  const idle = composeActive
    ? composeDirectorIdleCopy(composeSnapshot)
    : {
        headline: 'Director',
        body: 'Everything on this screen works without me. I am here if you want a hand.',
      }

  const railSuggestions: DirectorSuggestion[] = useMemo(() => {
    if (!composeActive || messages.length > 0) return []
    return composeDirectorSuggestions(composeSnapshot!).map((item) => ({
      id: item.id,
      label: item.label,
      prompt: item.prompt,
    }))
  }, [composeActive, composeSnapshot, messages.length])

  const contextLabel = deskContextLive
    ? composeSnapshot?.screen === 'compose'
      ? 'sees your post in progress'
      : 'sees this screen'
    : 'ready when you are'

  return (
    <DirectorRail
      brandName={liveBrandName}
      messages={messages}
      isLoading={isLoading}
      onSend={handleSend}
      errorMessage={error ? 'Something went wrong talking to the Director. Try again.' : null}
      onDismissError={clearError}
      suggestions={railSuggestions}
      conversations={conversations}
      historyLoading={historyLoading}
      historyFailed={historyFailed}
      activeConversationId={panelConversationId}
      onSelectConversation={handleSelectConversation}
      onOpenHistory={loadHistory}
      onNewConversation={handleNewConversation}
      onForgetBusiness={activeBrandId ? handleForgetBusiness : undefined}
      historyCount={conversations.length > 0 ? conversations.length : null}
      contextLabel={contextLabel}
      deskContextLive={deskContextLive}
      idleHeadline={idle.headline}
      idleBody={idle.body}
    />
  )
}
