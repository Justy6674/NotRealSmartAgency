import { create } from 'zustand'
import type { ComposeDeskSnapshot } from '@/lib/desk/compose-desk'
import type { PostPlatform } from '@/types/database'

export interface CaptionApplyPayload {
  brandId: string
  caption: string
  hashtags: string[]
  platforms?: PostPlatform[]
  /** Director prose — not hashtag groups or process_media */
  hashtagsAreSuggested?: boolean
}

interface ComposeDeskState {
  snapshot: ComposeDeskSnapshot | null
  setSnapshot: (snapshot: ComposeDeskSnapshot | null) => void
  pendingCaptionApply: CaptionApplyPayload | null
  setPendingCaptionApply: (payload: CaptionApplyPayload | null) => void
}

/** Ephemeral — never persisted. Compose publishes; Director rail consumes. */
export const useComposeDeskStore = create<ComposeDeskState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  pendingCaptionApply: null,
  setPendingCaptionApply: (payload) => set({ pendingCaptionApply: payload }),
}))
