import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentType } from '@/types/database'

interface AgencyState {
  activeBrandId: string | null
  activeAgentType: AgentType
  activeConversationId: string | null
  setBrand: (brandId: string) => void
  setAgent: (agentType: AgentType) => void
  setConversation: (conversationId: string | null) => void
}

export const useAgencyStore = create<AgencyState>()(
  persist(
    (set) => ({
      activeBrandId: null,
      activeAgentType: 'content',
      activeConversationId: null,
      setBrand: (brandId) =>
        set({ activeBrandId: brandId, activeConversationId: null }),
      setAgent: (agentType) =>
        set({ activeAgentType: agentType, activeConversationId: null }),
      setConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),
    }),
    { name: 'nrs-agency' }
  )
)
