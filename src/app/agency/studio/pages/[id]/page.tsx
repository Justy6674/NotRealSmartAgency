'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { PageBuilder } from '@/components/agency/studio/pages/PageBuilder'
import type { PageBlock } from '@/components/agency/studio/pages/PagePreview'
import { Loader2 } from 'lucide-react'

export default function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const brandId = useAgencyStore(s => s.activeBrandId)
  const router = useRouter()
  const isNew = id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [blocks, setBlocks] = useState<PageBlock[]>([])
  const [pageOutputId, setPageOutputId] = useState<string | null>(isNew ? null : id)

  useEffect(() => {
    if (isNew || !pageOutputId) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/pages?id=${pageOutputId}`)
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setTitle(data.title ?? '')
            setSlug((data.metadata?.slug as string) ?? '')
            setBlocks((data.metadata?.blocks as PageBlock[]) ?? [])
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isNew, pageOutputId])

  const handleSave = async (data: { title: string; slug: string; blocks: PageBlock[] }) => {
    if (!brandId) return

    if (isNew || !pageOutputId) {
      // Create
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          title: data.title,
          slug: data.slug,
          blocks: data.blocks,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setPageOutputId(created.id)
        router.replace(`/agency/studio/pages/${created.id}`)
      }
    } else {
      // Update
      await fetch('/api/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pageOutputId,
          title: data.title,
          slug: data.slug,
          blocks: data.blocks,
        }),
      })
    }
  }

  if (!brandId) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Select a brand first
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push('/agency/studio/pages')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Pages
        </button>
        <h1 className="text-lg font-bold text-foreground mt-1">
          {isNew ? 'New Page' : 'Edit Page'}
        </h1>
      </div>
      <PageBuilder
        initialTitle={title}
        initialSlug={slug}
        initialBlocks={blocks}
        onSave={handleSave}
      />
    </div>
  )
}
