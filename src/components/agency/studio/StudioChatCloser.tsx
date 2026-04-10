'use client'

import { useEffect } from 'react'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * Closes the Director chat panel when entering Studio routes.
 *
 * Studio has its own left sidebar which, combined with the brand sidebar
 * and the 380px chat panel, leaves no room for content. The chat panel
 * auto-opened on every Studio page via CreativeStudio + RoomLayout, causing
 * the content to be squeezed or hidden behind the chat.
 *
 * This component runs once on mount to close the panel. Users can still
 * open it manually via the floating chat button.
 */
export function StudioChatCloser() {
  const setChatPanelOpen = useAgencyStore((s) => s.setChatPanelOpen)

  useEffect(() => {
    setChatPanelOpen(false)
  }, [setChatPanelOpen])

  return null
}
