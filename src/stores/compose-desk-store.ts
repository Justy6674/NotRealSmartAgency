import { create } from 'zustand'
import type { ComposeDeskSnapshot } from '@/lib/desk/compose-desk'

interface ComposeDeskState {
  snapshot: ComposeDeskSnapshot | null
  setSnapshot: (snapshot: ComposeDeskSnapshot | null) => void
}

/** Ephemeral — never persisted. Compose publishes; Director rail consumes. */
export const useComposeDeskStore = create<ComposeDeskState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}))
