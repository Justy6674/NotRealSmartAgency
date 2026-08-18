'use client'

export const dynamic = 'force-dynamic'

import { use, useEffect, useState } from 'react'
import { TemplateEditor } from '@/components/agency/studio/templates/TemplateEditor'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

interface PageProps {
  params: Promise<{ templateId: string }>
}

/**
 * Editing one template, inside the Social chrome.
 *
 * THE FAULT THIS CLOSES: the editor existed only at
 * `/agency/studio/templates/[id]`, and both the index and the create button
 * pushed there. So pressing "New template" from the Social department swapped
 * the sidebar, the tab strip and the department out from under the owner — he
 * pressed a button on one screen and arrived somewhere that looked like a
 * different product, with no route back except the browser's Back button.
 *
 * The Studio route stays where it is and still works; it simply is no longer
 * the only door. The editor takes the route family as a prop so "Back" returns
 * to whichever index the owner actually came from.
 */
export default function SocialTemplateEditorPage({ params }: PageProps) {
  const { templateId } = use(params)
  const { activeBrandId } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }
    let cancelled = false
    fetch('/api/brands')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Brand[] | null) => {
        if (cancelled || !data) return
        setBrand(data.find((b) => b.id === activeBrandId) ?? null)
      })
      .catch(() => {
        /* the editor renders without a brand name; it is decoration */
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  return (
    <TemplateEditor
      brandId={activeBrandId}
      brandName={brand?.name}
      templateId={templateId}
      basePath="/agency/social/templates"
    />
  )
}
