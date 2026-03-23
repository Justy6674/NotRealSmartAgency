'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ComplianceBadge } from './ComplianceBadge'
import { AGENT_LABELS } from '@/types/database'
import type { Brand } from '@/types/database'
import { Bot } from 'lucide-react'

interface ChatInterfaceProps {
  conversationId?: string
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const { activeBrandId, activeAgentType, setConversation } = useAgencyStore()

  // Fetch active brand for compliance badge and context display
  useEffect(() => {
    if (!activeBrandId) return
    const supabase = createClient()
    supabase
      .from('brands')
      .select('*')
      .eq('id', activeBrandId)
      .single()
      .then(({ data }) => {
        if (data) setBrand(data as Brand)
      })
  }, [activeBrandId])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          brandId: activeBrandId,
          agentType: activeAgentType,
          conversationId: conversationId ?? null,
        },
      }),
    [activeBrandId, activeAgentType, conversationId]
  )

  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Load existing messages when opening a conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              parts: [{ type: 'text' as const, text: m.content }],
            }))
          )
        }
      })
  }, [conversationId, setMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text: string) => {
    await sendMessage({ text })

    // Create conversation on first message if no conversationId
    if (!conversationId && activeBrandId && messages.length === 0) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          agentType: activeAgentType,
          title: text.slice(0, 80),
        }),
      })
      const conv = await res.json()
      if (conv?.id) {
        setConversation(conv.id)
        window.history.replaceState(null, '', `/agency/chat/${conv.id}`)
      }
    }
  }

  if (!activeBrandId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>Select a brand to get started</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {AGENT_LABELS[activeAgentType]}
          </span>
        </div>
        {brand && (
          <ComplianceBadge
            ahpra={brand.compliance_flags?.ahpra}
            tga={brand.compliance_flags?.tga}
          />
        )}
        {brand && (
          <span className="ml-auto text-xs text-muted-foreground">
            {brand.name}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {AGENT_LABELS[activeAgentType]} Agent
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ready to work on {brand?.name ?? 'your brand'}. What would you like to create?
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl divide-y divide-border/50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  )
}
