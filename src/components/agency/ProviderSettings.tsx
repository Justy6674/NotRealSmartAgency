'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const VIDEO_PROVIDERS = [
  { id: 'heygen', name: 'HeyGen', description: 'AI avatar presenter videos, lip-synced, multiple accents' },
  { id: 'runway', name: 'Runway', description: 'Cinematic text-to-video, no avatar, creative shots' },
  { id: 'synthesia', name: 'Synthesia', description: 'Corporate avatar videos, SCORM export' },
  { id: 'kling', name: 'Kling AI', description: 'Affordable text-to-video for social clips' },
  { id: 'google_veo', name: 'Google Veo', description: 'Highest quality cinematic video' },
]

const SOCIAL_PROVIDERS = [
  { id: 'ayrshare', name: 'Ayrshare', description: 'Post to Instagram, TikTok, YouTube, LinkedIn, Facebook, X — single API ($29/mo)' },
  { id: 'deepgram', name: 'Deepgram', description: 'Video/audio transcription for content automation' },
]

export function ProviderSettings() {
  const [saving, setSaving] = useState(false)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/integrations')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const configMap: Record<string, boolean> = {}
          data.forEach((int: { provider: string; is_active: boolean }) => {
            configMap[int.provider] = int.is_active
          })
          setConfigured(configMap)
        }
      })
  }, [])

  const handleSave = async (providerId: string) => {
    const key = keys[providerId]
    if (!key) return

    setSaving(true)
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerId,
        api_key: key,
      }),
    })

    if (res.ok) {
      setConfigured((prev) => ({ ...prev, [providerId]: true }))
      setKeys((prev) => ({ ...prev, [providerId]: '' }))
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-2">Video Generation Providers</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add your own API keys to enable AI video generation. HeyGen is the default provider for avatar videos.
        </p>
      </div>

      <div className="space-y-6">
        {VIDEO_PROVIDERS.map((provider) => (
          <div key={provider.id} className="p-4 border rounded-md bg-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{provider.name}</h3>
              {configured[provider.id] && (
                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>

            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={configured[provider.id] ? 'Enter new API key to update...' : 'Enter API key...'}
                value={keys[provider.id] || ''}
                onChange={(e) => setKeys({ ...keys, [provider.id]: e.target.value })}
              />
              <Button
                onClick={() => handleSave(provider.id)}
                disabled={saving || !keys[provider.id]}
              >
                Save
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t">
        <h2 className="text-lg font-semibold mb-2">Social Media & Transcription</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect Ayrshare to auto-post across all platforms. Add Deepgram for video transcription.
        </p>
      </div>

      <div className="space-y-6">
        {SOCIAL_PROVIDERS.map((provider) => (
          <div key={provider.id} className="p-4 border rounded-md bg-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{provider.name}</h3>
              {configured[provider.id] && (
                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>

            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={configured[provider.id] ? 'Enter new API key to update...' : 'Enter API key...'}
                value={keys[provider.id] || ''}
                onChange={(e) => setKeys({ ...keys, [provider.id]: e.target.value })}
              />
              <Button
                onClick={() => handleSave(provider.id)}
                disabled={saving || !keys[provider.id]}
              >
                Save
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
