'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, Github, Loader2 } from 'lucide-react'
import type { Brand } from '@/types/database'

interface BrandProfileFormProps {
  brand: Brand
}

export function BrandProfileForm({ brand }: BrandProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [formData, setFormData] = useState({
    name: brand.name,
    tagline: brand.tagline ?? '',
    description: brand.description ?? '',
    website_url: brand.website_url ?? '',
    github_url: brand.github_url ?? '',
    logo_url: (brand as Brand & { logo_url?: string }).logo_url ?? '',
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
        github_url: formData.github_url || null,
        logo_url: formData.logo_url || null,
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

  // Auto-scan website to extract branding
  const handleScanWebsite = async () => {
    if (!formData.website_url) return
    setScanning(true)
    try {
      // Try to get favicon from the website
      const domain = new URL(formData.website_url).hostname
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      setFormData(prev => ({ ...prev, logo_url: faviconUrl }))
    } catch {
      // ignore
    }
    setScanning(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid gap-4">
        {/* Logo preview + URL */}
        <div>
          <Label htmlFor="logo_url">Logo URL</Label>
          <div className="flex items-center gap-3 mt-1">
            {formData.logo_url && (
              <div className="h-10 w-10 rounded-lg border border-border overflow-hidden bg-muted shrink-0">
                <Image
                  src={formData.logo_url}
                  alt={formData.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )}
            <Input
              id="logo_url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Paste a URL to your logo, or click &quot;Scan Website&quot; to auto-detect the favicon.
          </p>
        </div>

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
          <div className="flex gap-2">
            <Input
              id="website_url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              placeholder="https://yourbrand.com.au"
            />
            <Button
              onClick={handleScanWebsite}
              disabled={scanning || !formData.website_url}
              variant="outline"
              className="shrink-0"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Scan</span>
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="github_url">GitHub Repository</Label>
          <div className="flex gap-2">
            <Input
              id="github_url"
              value={formData.github_url}
              onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              placeholder="https://github.com/org/repo"
            />
            <div className="flex items-center shrink-0 px-2">
              <Github className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Link your repo so agents can read your codebase, README, and tech stack.
          </p>
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
