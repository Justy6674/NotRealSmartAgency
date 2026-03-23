'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, MessageSquare } from 'lucide-react'
import type { Conversation } from '@/types/database'

export function ConversationList() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const { activeBrandId, activeAgentType, activeConversationId, setConversation } =
    useAgencyStore()

  useEffect(() => {
    if (!activeBrandId) return

    const params = new URLSearchParams()
    params.set('brandId', activeBrandId)
    params.set('agentType', activeAgentType)

    fetch(`/api/conversations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data)
      })
  }, [activeBrandId, activeAgentType])

  const handleNewChat = () => {
    setConversation(null)
    router.push('/agency/chat')
  }

  const handleSelectConversation = (conv: Conversation) => {
    setConversation(conv.id)
    router.push(`/agency/chat/${conv.id}`)
  }

  return (
    <div className="hidden lg:flex w-56 flex-col border-r bg-background">
      <div className="flex h-14 items-center justify-between border-b px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">New chat</span>
        </Button>
      </div>
      <ScrollArea className="flex-1 py-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                activeConversationId === conv.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {conv.title ?? 'Untitled'}
              </span>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  )
}
