/**
 * One keyboard focus indicator, for every surface.
 *
 * `--ring` cannot carry this. It is oklch(0.708 0 0) in light and
 * oklch(0.556 0 0) in dark (globals.css), which measures 2.59:1 against the
 * page at full opacity and 1.54:1 at the `ring-ring/50` opacity the shadcn
 * default uses. A focus indicator has to clear 3:1, so the shipped default was
 * invisible on a page that pauses real ad spend — and the companion
 * `focus-visible:border-ring` does not rescue it, because 1px of a 2.59:1
 * colour is not an indicator either.
 *
 * Drawn from `foreground` the same ring measures 19.79:1 in light and 18.96:1
 * in dark. That is the only reason these constants exist in one file: four
 * separate surfaces each re-typed the ring and one of them measured it, so the
 * fix has to be a thing you import rather than a thing you remember.
 *
 * Contrast is computed from oklch L directly — for these achromatic tokens
 * relative luminance is L³, so oklch(0.708) is Y 0.355 and oklch(0.145) is
 * Y 0.00305.
 */

/**
 * The default. An outset ring with a background-coloured gap, so it reads on
 * a bordered control and on a solid `bg-foreground` control alike.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * For a control inside an `overflow-hidden` container — a row in a bordered
 * list, a cell in a table. An outset ring is clipped along the container's
 * edges there, and a focused row reads as having no ring at all.
 */
export const FOCUS_RING_INSET =
  'focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-foreground'

/**
 * The inset ring on a solid `bg-foreground` control, where a foreground ring
 * would be the same colour as the button it sits inside.
 */
export const FOCUS_RING_INSET_ON_SOLID =
  'focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-background'
