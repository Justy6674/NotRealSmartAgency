'use client'

import { useEffect } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useBrandTheme } from '@/components/agency/shell/brand-theme'
import type { Brand } from '@/types/database'

/**
 * Paints `--brand` / `--brand-deep` / `--brand-wash` from the selected
 * business using the numeric ramp in brand-theme.ts.
 *
 * The layout already emits the same ramp as CSS `oklch(from … min(c,…) …)`.
 * That relative-colour form is invalid in some installed-app WebViews
 * (Safari Add to Dock, Chrome "Install app"), so `--brand` never overrides
 * the house silver and the desk looks like nobody picked a colour. Setting
 * the properties from the same math the mockups were locked to always works.
 * data-brand-id is kept in step with the store so the CSS rules stay honest
 * even if this effect has not run yet.
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
