'use client'

import { useState } from 'react'
import { Link2, Loader2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UrlShortenerProps {
  onShorten?: (shortUrl: string) => void
}

export function UrlShortener({ onShorten }: UrlShortenerProps) {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleShorten = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setShortUrl(null)

    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setShortUrl(data.short_url)
        onShorten?.(data.short_url)
      }
    } catch {
      setError('Failed to shorten URL. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL to shorten..."
          className={cn(
            'h-7 flex-1 rounded-md border bg-background px-2 text-xs',
            'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleShorten()
            }
          }}
        />
        <button
          type="button"
          onClick={handleShorten}
          disabled={loading || !url.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/80 disabled:opacity-40 transition-colours"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Shorten'}
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}

      {shortUrl && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
            {shortUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
          >
            {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
