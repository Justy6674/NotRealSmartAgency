import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentType } from '@/types/database'

export type AgencyView = 'chat' | 'tasks' | 'agents' | 'approvals' | 'costs'

interface AgencyState {
  activeBrandId: string | null
  activeAgentType: AgentType
  activeConversationId: string | null
  activeView: AgencyView
  sidebarOpen: boolean
  setBrand: (brandId: string) => void
  setAgent: (agentType: AgentType) => void
  setConversation: (conversationId: string | null) => void
  setView: (view: AgencyView) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAgencyStore = create<AgencyState>()(
  persist(
    (set) => ({
      activeBrandId: null,
      activeAgentType: 'overall',
      activeConversationId: null,
      activeView: 'chat',
      sidebarOpen: false,
      setBrand: (brandId) =>
        set({ activeBrandId: brandId, activeAgentType: 'overall', activeConversationId: null }),
      setAgent: (agentType) =>
        set({ activeAgentType: agentType, activeConversationId: null }),
      setConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),
      setView: (view) =>
        set({ activeView: view }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }),
    }),
    { name: 'nrs-agency' }
  )
)
