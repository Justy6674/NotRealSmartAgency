'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PostTemplate } from '@/types/database'

export interface TemplateVariableDef {
  key: string
  label: string
  description?: string
  type?: 'text' | 'date' | 'select' | 'hashtag_group'
  default?: string
  options?: string[]
}

export interface TemplateDraft {
  name: string
  captionTemplate: string
  defaultHashtags: string[]
  platform: string | null
  variables: TemplateVariableDef[]
}

interface UseTemplatesReturn {
  templates: PostTemplate[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getTemplate: (id: string) => Promise<PostTemplate | null>
  createTemplate: (draft: TemplateDraft & { brandId: string }) => Promise<PostTemplate | null>
  updateTemplate: (id: string, patch: Partial<TemplateDraft>) => Promise<PostTemplate | null>
  deleteTemplate: (id: string) => Promise<boolean>
  duplicateTemplate: (template: PostTemplate) => Promise<PostTemplate | null>
}

/**
 * CRUD hook for post templates. Wraps the `/api/post-templates` endpoint —
 * body-based PATCH/DELETE style (see `src/app/api/post-templates/route.ts`).
 *
 * Pass a `brandId` to automatically fetch templates for that brand.
 */
export function useTemplates(brandId: string | null): UseTemplatesReturn {
  const [templates, setTemplates] = useState<PostTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!brandId) {
      setTemplates([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/post-templates?brandId=${brandId}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load templates')
      setTemplates(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getTemplate = useCallback(async (id: string): Promise<PostTemplate | null> => {
    // The API doesn't have a per-id GET route — filter locally from the list,
    // falling back to a fresh list fetch if the cached list is empty.
    const cached = templates.find(t => t.id === id)
    if (cached) return cached
    if (!brandId) return null
    const res = await fetch(`/api/post-templates?brandId=${brandId}`)
    if (!res.ok) return null
    const list: PostTemplate[] = await res.json()
    setTemplates(list)
    return list.find(t => t.id === id) ?? null
  }, [templates, brandId])

  const createTemplate = useCallback(async (
    draft: TemplateDraft & { brandId: string }
  ): Promise<PostTemplate | null> => {
    try {
      const res = await fetch('/api/post-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: draft.brandId,
          name: draft.name,
          captionTemplate: draft.captionTemplate,
          defaultHashtags: draft.defaultHashtags,
          platform: draft.platform,
          variables: draft.variables,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create template')
      const created: PostTemplate = await res.json()
      setTemplates(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      return created
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }, [])

  const updateTemplate = useCallback(async (
    id: string,
    patch: Partial<TemplateDraft>
  ): Promise<PostTemplate | null> => {
    try {
      const res = await fetch('/api/post-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: patch.name,
          captionTemplate: patch.captionTemplate,
          defaultHashtags: patch.defaultHashtags,
          platform: patch.platform,
          variables: patch.variables,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update template')
      const updated: PostTemplate = await res.json()
      setTemplates(prev => prev.map(t => (t.id === id ? updated : t)))
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/post-templates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to delete template')
      setTemplates(prev => prev.filter(t => t.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [])

  const duplicateTemplate = useCallback(async (template: PostTemplate): Promise<PostTemplate | null> => {
    return createTemplate({
      brandId: template.brand_id,
      name: `${template.name} (copy)`,
      captionTemplate: template.caption_template,
      defaultHashtags: template.default_hashtags,
      platform: template.platform,
      variables: (template.variables ?? []) as TemplateVariableDef[],
    })
  }, [createTemplate])

  return {
    templates,
    loading,
    error,
    refresh,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  }
}
