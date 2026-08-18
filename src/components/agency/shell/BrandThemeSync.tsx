'use client'

import { useEffect } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useBrandTheme } from '@/components/agency/shell/use-brand-theme'
import type { Brand } from '@/types/database'

/**
 * Paints `--bg` / `--panel` / `--ink` from stored website colours and
 * `--brand*` from the business primary, using the same math as brand-theme.ts.
 *
 * The layout already emits the same values as CSS on first paint. BrandThemeSync
 * re-applies them for WebViews that ignore `oklch(from …)` in stylesheets.
 */
export function BrandThemeSync({ brands }: { brands: Brand[] }) {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const brand = brands.find((row) => row.id === activeBrandId) ?? null
  const vars = useBrandTheme(brand)

  useEffect(() => {
    const shell = document.querySelector('[data-nrs-shell]') as HTMLElement | null
    if (!shell) return
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') shell.style.setProperty(key, value)
    }
    if (activeBrandId) shell.setAttribute('data-brand-id', activeBrandId)
  }, [vars, activeBrandId])

  return null
}
