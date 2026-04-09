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
  chatPanelOpen: boolean
  chatPanelMinimised: boolean
  pendingReviewMessage: string | null
  pendingDraftId: string | null
  pendingMediaId: string | null
  setBrand: (brandId: string) => void
  setAgent: (agentType: AgentType) => void
  setConversation: (conversationId: string | null) => void
  selectConversation: (conversationId: string, agentType: AgentType) => void
  restoreContext: (brandId: string, agentType: AgentType, conversationId: string) => void
  setView: (view: AgencyView) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setChatPanelOpen: (open: boolean) => void
  setChatPanelMinimised: (minimised: boolean) => void
  setPendingReviewMessage: (message: string | null) => void
  setPendingDraftId: (id: string | null) => void
  setPendingMediaId: (id: string | null) => void
}

export const useAgencyStore = create<AgencyState>()(
  persist(
    (set) => ({
      activeBrandId: null,
      activeAgentType: 'overall',
      activeConversationId: null,
      activeView: 'chat',
      sidebarOpen: false,
      chatPanelOpen: false,
      chatPanelMinimised: false,
      pendingReviewMessage: null,
      pendingDraftId: null,
      pendingMediaId: null,
      setBrand: (brandId) =>
        set({ activeBrandId: brandId, activeAgentType: 'overall', activeConversationId: null }),
      setAgent: (agentType) =>
        set({ activeAgentType: agentType, activeConversationId: null }),
      setConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),
      selectConversation: (conversationId, agentType) =>
        set({ activeConversationId: conversationId, activeAgentType: agentType }),
      restoreContext: (brandId, agentType, conversationId) =>
        set({ activeBrandId: brandId, activeAgentType: agentType, activeConversationId: conversationId }),
      setView: (view) =>
        set({ activeView: view }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }),
      setChatPanelOpen: (open) =>
        set({ chatPanelOpen: open, ...(open ? { chatPanelMinimised: false } : {}) }),
      setChatPanelMinimised: (minimised) =>
        set({ chatPanelMinimised: minimised }),
      setPendingReviewMessage: (message) =>
        set({ pendingReviewMessage: message }),
      setPendingDraftId: (id) =>
        set({ pendingDraftId: id }),
      setPendingMediaId: (id) =>
        set({ pendingMediaId: id }),
    }),
    {
      name: 'nrs-agency',
      partialize: (state) => ({
        activeBrandId: state.activeBrandId,
        activeAgentType: state.activeAgentType,
        activeConversationId: state.activeConversationId,
        activeView: state.activeView,
        sidebarOpen: state.sidebarOpen,
        chatPanelOpen: state.chatPanelOpen,
        chatPanelMinimised: state.chatPanelMinimised,
        // pendingReviewMessage excluded — transient
      }),
    }
  )
)
