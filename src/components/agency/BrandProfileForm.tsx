'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Brand } from '@/types/database'

interface BrandProfileFormProps {
  brand: Brand
}

export function BrandProfileForm({ brand }: BrandProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: brand.name,
    tagline: brand.tagline ?? '',
    description: brand.description ?? '',
    website_url: brand.website_url ?? '',
    niche: brand.niche,
    content_pillars: brand.content_pillars.join(', '),
    extra_context: brand.extra_context ?? '',
    ahpra: brand.compliance_flags?.ahpra ?? false,
    tga: brand.compliance_flags?.tga ?? false,
  })

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: brand.id,
        name: formData.name,
        tagline: formData.tagline || null,
        description: formData.description || null,
        website_url: formData.website_url || null,
        niche: formData.niche,
        content_pillars: formData.content_pillars.split(',').map((s) => s.trim()).filter(Boolean),
        extra_context: formData.extra_context || null,
        compliance_flags: {
          ahpra: formData.ahpra,
          tga: formData.tga,
          tga_categories: brand.compliance_flags?.tga_categories ?? [],
        },
      }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="name">Brand Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label htmlFor="website_url">Website URL</Label>
          <Input
            id="website_url"
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="niche">Niche</Label>
          <Input
            id="niche"
            value={formData.niche}
            onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="content_pillars">Content Pillars (comma separated)</Label>
          <Input
            id="content_pillars"
            value={formData.content_pillars}
            onChange={(e) => setFormData({ ...formData, content_pillars: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="extra_context">Additional Context</Label>
          <textarea
            id="extra_context"
            value={formData.extra_context}
            onChange={(e) => setFormData({ ...formData, extra_context: e.target.value })}
            rows={4}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            placeholder="Anything else the AI agents should know about this brand..."
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.ahpra}
              onChange={(e) => setFormData({ ...formData, ahpra: e.target.checked })}
              className="rounded"
            />
            AHPRA Compliance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.tga}
              onChange={(e) => setFormData({ ...formData, tga: e.target.checked })}
              className="rounded"
            />
            TGA Compliance
          </label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}
