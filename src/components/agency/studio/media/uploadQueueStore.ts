'use client'

/**
 * Lightweight module-level upload queue store.
 *
 * Lives outside React so navigating between Studio tabs doesn't drop in-flight
 * uploads. Components subscribe via the `useUploadQueue` hook below. Mirrors
 * the behavior of Mixpost's persistent upload tray, but kept dependency-free
 * (no zustand needed — the agency-store already lives in zustand and we don't
 * want UI ephemera to be persisted to localStorage).
 */

import { useSyncExternalStore } from 'react'

export type QueueItemStatus =
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted'

export interface UploadQueueItem {
  id: string
  fileName: string
  fileSize: number
  /** So a refusal can say "this video" rather than "this file". */
  fileType?: string
  progress: number
  status: QueueItemStatus
  error?: string
  startedAt: number
  completedAt?: number
  brandId: string
  /** Optional handle wired by the uploader so the panel can call pause/abort. */
  pause?: () => void
  resume?: () => void
  abort?: () => void
}

/**
 * Which platforms will refuse a file this size, and the size table behind it,
 * now live in `platform-limits.ts` — the API route that asks the publisher the
 * same question for a landed file needs them too, and two copies of a size
 * table is how one of them goes stale without anybody noticing.
 *
 * Re-exported here because the upload panel and its callers already import
 * from this module, and moving the file should not move their imports.
 */
export {
  PLATFORM_SIZE_CEILINGS,
  platformsThatWillRefuse,
  tooLargeSentence,
} from './platform-limits'

type Listener = () => void

let queue: UploadQueueItem[] = []
const listeners = new Set<Listener>()

function emit() {
  // Always create a new array reference so React re-renders.
  queue = [...queue]
  for (const l of listeners) l()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): UploadQueueItem[] {
  return queue
}

function getServerSnapshot(): UploadQueueItem[] {
  return []
}

export const uploadQueue = {
  add(item: Omit<UploadQueueItem, 'startedAt' | 'progress' | 'status'> & {
    progress?: number
    status?: QueueItemStatus
  }): UploadQueueItem {
    const next: UploadQueueItem = {
      progress: 0,
      status: 'queued',
      startedAt: Date.now(),
      ...item,
    }
    queue.push(next)
    emit()
    return next
  },

  update(id: string, patch: Partial<UploadQueueItem>) {
    let changed = false
    queue = queue.map((q) => {
      if (q.id !== id) return q
      changed = true
      const merged: UploadQueueItem = { ...q, ...patch }
      if (
        (patch.status === 'completed' || patch.status === 'failed' || patch.status === 'aborted') &&
        !merged.completedAt
      ) {
        merged.completedAt = Date.now()
      }
      return merged
    })
    if (changed) emit()
  },

  remove(id: string) {
    const next = queue.filter((q) => q.id !== id)
    if (next.length !== queue.length) {
      queue = next
      emit()
    }
  },

  clearCompleted() {
    const next = queue.filter((q) => q.status !== 'completed')
    if (next.length !== queue.length) {
      queue = next
      emit()
    }
  },

  clearAll() {
    if (queue.length === 0) return
    queue = []
    emit()
  },

  snapshot(): UploadQueueItem[] {
    return queue
  },
}

/**
 * React hook — subscribes to the queue and re-renders on changes.
 */
export function useUploadQueue(): UploadQueueItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
