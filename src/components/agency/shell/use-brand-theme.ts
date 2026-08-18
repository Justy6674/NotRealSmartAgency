'use client'

import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'

import {
  brandHasSurfacePalette,
  brandThemeVars,
  type BrandColourSource,
} from '@/components/agency/shell/brand-theme'

/**
 * Read from the `dark` class on <html> rather than from `useTheme()`.
 *
 * next-themes writes that class in a script that runs before paint, but its
 * hook reports `undefined` until after mount — so a style object computed from
 * it renders one frame of the wrong theme's accents on every load. Reading the
 * class through `useSyncExternalStore` gets the right answer on the very first
 * client render, and React treats a server/client snapshot difference here as
 * expected rather than as a hydration error.
 *
 * The server snapshot is `true` because the app's ThemeProvider is
 * `defaultTheme="dark"` with `enableSystem={false}`.
 */
function subscribeToTheme(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

function readDarkFromDom(): boolean {
  return document.documentElement.classList.contains('dark')
}

function darkOnServer(): boolean {
  return true
}

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribeToTheme, readDarkFromDom, darkOnServer)
}

/**
 * The one call the shell needs: give it the active business, spread the result
 * onto the root element.
 */
export function useBrandTheme(brand: BrandColourSource): CSSProperties {
  const dark = useIsDarkTheme()
  // Brand paper wins over the global dark toggle when a background is stored.
  const effectiveDark = brandHasSurfacePalette(brand) ? false : dark
  return brandThemeVars(brand, { dark: effectiveDark })
}
