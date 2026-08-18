import { create } from 'zustand'
import type { ComposeDeskSnapshot } from '@/lib/desk/compose-desk'
import type { SocialDeskAction } from '@/lib/social/actions'

export interface DeskActionBatch {
  brandId: string
  actions: SocialDeskAction[]
  hashtagsAreSuggested?: boolean
}

interface ComposeDeskState {
  snapshot: ComposeDeskSnapshot | null
  setSnapshot: (snapshot: ComposeDeskSnapshot | null) => void
  pendingDeskActions: DeskActionBatch | null
  enqueueDeskActions: (batch: DeskActionBatch | null) => void
  appliedFillIds: Record<string, true>
  markFillApplied: (fillId: string) => void
  undoActions: SocialDeskAction[] | null
  setUndoActions: (actions: SocialDeskAction[] | null) => void
  requestUndo: () => void
}

/** Ephemeral — never persisted. Compose publishes; Director rail consumes. */
export const useComposeDeskStore = create<ComposeDeskState>((set, get) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  pendingDeskActions: null,
  enqueueDeskActions: (batch) => set({ pendingDeskActions: batch }),
  appliedFillIds: {},
  markFillApplied: (fillId) => set({ appliedFillIds: { ...get().appliedFillIds, [fillId]: true } }),
  undoActions: null,
  setUndoActions: (actions) => set({ undoActions: actions && actions.length > 0 ? actions : null }),
  requestUndo: () => {
    const { undoActions, snapshot } = get()
    if (!undoActions || !snapshot?.brandId) return
    set({
      pendingDeskActions: { brandId: snapshot.brandId, actions: undoActions },
      undoActions: null,
    })
  },
}))
