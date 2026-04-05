/**
 * Send a message to the Director via the inline chat panel.
 * Uses DOM event to bypass Zustand — guaranteed to work.
 */
export function sendToDirector(message: string) {
  window.dispatchEvent(
    new CustomEvent('nrs-send-chat', { detail: { message } })
  )
}
