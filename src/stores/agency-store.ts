import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentType } from '@/types/database'

interface AgencyState {
  activeBrandId: string | null
  activeAgentType: AgentType
  activeConversationId: string | null
  sidebarOpen: boolean
  setBrand: (brandId: string) => void
  setAgent: (agentType: AgentType) => void
  setConversation: (conversationId: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAgencyStore = create<AgencyState>()(
  persist(
    (set) => ({
      activeBrandId: null,
      activeAgentType: 'overall',
      activeConversationId: null,
      sidebarOpen: false,
      setBrand: (brandId) =>
        set({ activeBrandId: brandId, activeAgentType: 'overall', activeConversationId: null }),
      setAgent: (agentType) =>
        set({ activeAgentType: agentType, activeConversationId: null }),
      setConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }),
    }),
    { name: 'nrs-agency' }
  )
)
