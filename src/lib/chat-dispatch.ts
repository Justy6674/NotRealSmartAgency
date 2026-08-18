import { useComposeDeskStore } from '@/stores/compose-desk-store'
import {
  composeDeskIsActive,
  wrapComposeDirectorPrompt,
} from '@/lib/desk/compose-desk'

/**
 * Send a message to the Director via the inline chat panel.
 * When Compose has a live desk snapshot, the prompt is wrapped with media,
 * platforms and caption facts — same payload the rail syncs to /api/desk/context.
 */
export function sendToDirector(message: string) {
  const snapshot = useComposeDeskStore.getState().snapshot
  const text =
    snapshot && composeDeskIsActive(snapshot)
      ? wrapComposeDirectorPrompt(snapshot, message)
      : message

  window.dispatchEvent(
    new CustomEvent('nrs-send-chat', { detail: { message: text } }),
  )
}
