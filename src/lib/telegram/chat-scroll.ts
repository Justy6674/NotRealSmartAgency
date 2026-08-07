/**
 * Scroll behaviour, as arithmetic so it can be tested without a browser.
 *
 * The old screen never scrolled at all: a new answer appeared below the fold
 * and the owner had to find it. But "always scroll to the bottom" is worse —
 * it yanks the page away mid-sentence when a background job finishes while
 * something earlier is being read.
 *
 * So: follow the bottom only while the reader is already at the bottom.
 */

/** Within this many pixels of the bottom counts as "at the bottom". */
export const FOLLOW_THRESHOLD_PX = 96

export interface ScrollMetrics {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

/** Is the reader at the bottom, and therefore expecting to be kept there? */
export function shouldFollow(
  { scrollHeight, scrollTop, clientHeight }: ScrollMetrics,
  threshold = FOLLOW_THRESHOLD_PX,
): boolean {
  return scrollHeight - (scrollTop + clientHeight) <= threshold
}

/**
 * Where to put the scroll position after new content arrives at the bottom.
 *
 * Returns the CURRENT position unchanged when not following — strictly equal,
 * so the caller can skip the write entirely rather than assigning the same
 * number and fighting the browser's own anchoring.
 */
export function nextScrollTop({
  following,
  scrollHeight,
  clientHeight,
  currentTop,
}: {
  following: boolean
  scrollHeight: number
  clientHeight: number
  currentTop: number
}): number {
  if (!following) return currentTop
  return Math.max(0, scrollHeight - clientHeight)
}

/**
 * Keep the reader looking at the same message after older history is loaded in
 * above it. Without this, loading a page of history teleports the view.
 */
export function anchorAfterPrepend(
  previousHeight: number,
  nextHeight: number,
  previousTop: number,
): number {
  return Math.max(0, previousTop + (nextHeight - previousHeight))
}

/**
 * Whether to offer a "jump to latest" affordance: something new arrived while
 * the reader was up the page, so they should be told rather than moved.
 */
export function shouldOfferJump({
  following,
  newestChanged,
}: {
  following: boolean
  newestChanged: boolean
}): boolean {
  return !following && newestChanged
}
