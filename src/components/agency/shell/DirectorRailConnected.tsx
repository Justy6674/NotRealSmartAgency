'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { DirectorRail } from '@/components/agency/shell/DirectorRail'
import type { DirectorConversation } from '@/components/agency/shell/DirectorHistory'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * The Director rail, actually wired.
 *
 * DirectorRail itself does not fetch — that was the right seam, and it stays.
 * This container is the missing half the restored shell never landed: without
 * it the input fires `nrs-send-chat` at a ChatPanel that is no longer mounted,
 * history never appears, and "the Director on every screen" is a 380px blank.
 *
 * One history store (`GET /api/conversations`), one chat transport
 * (`POST /api/chat`), one listener for every "Ask the Director" button that
 * still dispatches the old event.
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

  const [panelConversationId, setPanelConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<DirectorConversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)

  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId
  const convIdRef = useRef(panelConversationId)
  convIdRef.current = panelConversationId

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
      return
    }

    let cancelled = false
    fetch(`/api/conversations?brandId=${activeBrandId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(async (convs: Array<DirectorConversation & { agent_type?: string }>) => {
        if (cancelled) return
        const list = Array.isArray(convs) ? convs : []
        setConversations(list)
        const latest = list.find((c) => c.agent_type === 'overall') ?? list[0]
        if (!latest) {
          setMessages([])
          setPanelConversationId(null)
          return
        }
        setPanelConversationId(latest.id)
        await loadMessages(latest.id)
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setPanelConversationId(null)
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

  const handleSend = useCallback(
    async (text: string, images?: { data: string; mimeType: string }[]) => {
      if (!activeBrandId) return

      if (images?.length) {
        const files = images.map((img) => ({
          type: 'file' as const,
          mediaType: img.mimeType,
          url: `data:${img.mimeType};base64,${img.data}`,
        }))
        await sendMessage({ text: text || 'What do you see in this image?', files })
      } else {
        await sendMessage({ text })
      }

      if (!panelConversationId) {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: activeBrandId,
            agentType: 'overall',
            title: text.slice(0, 80),
          }),
        })
        const conv = await res.json()
        if (conv?.id) {
          setPanelConversationId(conv.id)
          setConversation(conv.id)
          void loadHistory()
        }
      }
    },
    [activeBrandId, panelConversationId, sendMessage, setConversation, loadHistory],
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
  }, [setMessages, setConversation])

  const handleForgetBusiness = useCallback(async () => {
    if (!activeBrandId) return
    await fetch(`/api/memories?scope=brand&brandId=${activeBrandId}`, { method: 'DELETE' })
  }, [activeBrandId])

  const liveBrandName = brands.find((row) => row.id === activeBrandId)?.name ?? brandName

  return (
    <DirectorRail
      brandName={liveBrandName}
      messages={messages}
      isLoading={isLoading}
      onSend={handleSend}
      errorMessage={error ? 'Something went wrong talking to the Director. Try again.' : null}
      onDismissError={clearError}
      conversations={conversations}
      historyLoading={historyLoading}
      historyFailed={historyFailed}
      activeConversationId={panelConversationId}
      onSelectConversation={handleSelectConversation}
      onOpenHistory={loadHistory}
      onNewConversation={handleNewConversation}
      onForgetBusiness={activeBrandId ? handleForgetBusiness : undefined}
      historyCount={conversations.length > 0 ? conversations.length : null}
    />
  )
}
