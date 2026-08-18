'use client'

import type { CSSProperties } from 'react'

import {
  brandThemeVars,
  type BrandColourSource,
} from '@/components/agency/shell/brand-theme'

/**
 * Signed-in desk is paper. html.dark is for login/marketing; it must not
 * invert furniture, icons, or buttons here. The business still retints
 * --brand* (and stored website paper) from brandThemeVars.
 */
export function useIsDarkTheme(): boolean {
  return false
}

/**
 * The one call the shell needs: give it the active business, spread the result
 * onto the root element.
 */
export function useBrandTheme(brand: BrandColourSource): CSSProperties {
  return brandThemeVars(brand, { dark: false })
}
