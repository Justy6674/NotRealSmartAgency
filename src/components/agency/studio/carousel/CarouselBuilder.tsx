'use client'

import { useState, useRef, useCallback } from 'react'
import { Plus, Download, Loader2, ChevronUp, ChevronDown, Trash2, Copy } from 'lucide-react'
import { toPng } from 'html-to-image'
import { renderSlide } from './SlideTemplates'
import { PLATFORM_SIZES, DEFAULT_SIZE } from '@/lib/carousel/platform-sizes'
import type { SlideDefinition, SlideTemplate, BrandTheme } from './types'
import { createEmptySlide, TEMPLATE_OPTIONS } from './types'
import type { PlatformSize } from '@/lib/carousel/platform-sizes'

interface CarouselBuilderProps {
  brandId: string
  theme: BrandTheme
  onExported?: (collectionId: string) => void
}

export function CarouselBuilder({ brandId, theme, onExported }: CarouselBuilderProps) {
  const [slides, setSlides] = useState<SlideDefinition[]>([
    { ...createEmptySlide('intro'), title: theme.name },
    createEmptySlide('content'),
    { ...createEmptySlide('cta'), title: 'Ready to get started?' },
  ])
  const [activeIndex, setActiveIndex] = useState(0)
  const [platformSize, setPlatformSize] = useState<PlatformSize>(DEFAULT_SIZE)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const slideRef = useRef<HTMLDivElement>(null)

  const activeSlide = slides[activeIndex] ?? slides[0]

  // ── Slide management ─────────────────────────────────────────────────────

  const addSlide = (template: SlideTemplate = 'content') => {
    const newSlide = createEmptySlide(template)
    const newSlides = [...slides]
    newSlides.splice(activeIndex + 1, 0, newSlide)
    setSlides(newSlides)
    setActiveIndex(activeIndex + 1)
  }

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return
    const newSlides = slides.filter((_, i) => i !== index)
    setSlides(newSlides)
    setActiveIndex(Math.min(activeIndex, newSlides.length - 1))
  }

  const duplicateSlide = (index: number) => {
    const copy = { ...slides[index], id: crypto.randomUUID() }
    const newSlides = [...slides]
    newSlides.splice(index + 1, 0, copy)
    setSlides(newSlides)
    setActiveIndex(index + 1)
  }

  const moveSlide = (index: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= slides.length) return
    const newSlides = [...slides]
    ;[newSlides[index], newSlides[swap]] = [newSlides[swap], newSlides[index]]
    setSlides(newSlides)
    setActiveIndex(swap)
  }

  const updateSlide = (field: keyof SlideDefinition, value: string) => {
    setSlides(prev => prev.map((s, i) => i === activeIndex ? { ...s, [field]: value } : s))
  }

  // ── Export ────────────────────────────────────────────────────────────────

  const exportAll = useCallback(async () => {
    if (!slideRef.current) return
    setExporting(true)

    try {
      const pngUrls: string[] = []

      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Rendering slide ${i + 1}/${slides.length}...`)
        setActiveIndex(i)
        // Wait for render
        await new Promise(r => setTimeout(r, 200))

        const dataUrl = await toPng(slideRef.current, {
          width: platformSize.width,
          height: platformSize.height,
          pixelRatio: 1,
          cacheBust: true,
        })

        // Convert to blob and upload
        setExportProgress(`Uploading slide ${i + 1}/${slides.length}...`)
        const blob = await (await fetch(dataUrl)).blob()
        const formData = new FormData()
        formData.append('file', blob, `carousel-slide-${i + 1}.png`)
        formData.append('brandId', brandId)

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })

        if (uploadRes.ok) {
          const media = await uploadRes.json()
          pngUrls.push(media.id ?? media.media_item_id)
        }
      }

      // Create collection from uploaded slides
      if (pngUrls.length) {
        setExportProgress('Creating collection...')
        const collRes = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId,
            name: `Carousel — ${activeSlide.title || new Date().toLocaleDateString('en-AU')}`,
            collectionType: 'carousel',
            mediaItemIds: pngUrls,
          }),
        })

        if (collRes.ok) {
          const coll = await collRes.json()
          onExported?.(coll.id)
          setExportProgress(`Exported ${pngUrls.length} slides!`)
        }
      }
    } catch (err) {
      setExportProgress('Export failed — check console')
      console.error('Carousel export error:', err)
    } finally {
      setExporting(false)
      setTimeout(() => setExportProgress(''), 3000)
    }
  }, [slides, platformSize, brandId, activeSlide.title, onExported])

  // ── Preview scale ─────────────────────────────────────────────────────────

  const previewScale = Math.min(400 / platformSize.width, 500 / platformSize.height)

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar — slide thumbnails */}
      <div className="w-48 flex-shrink-0 space-y-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Slides</span>
          <button
            onClick={() => addSlide()}
            className="rounded p-1 hover:bg-muted transition-colors"
            title="Add slide"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {slides.map((slide, i) => (
          <div
            key={slide.id}
            onClick={() => setActiveIndex(i)}
            className={`group relative cursor-pointer rounded-lg border p-1.5 transition-colors ${
              i === activeIndex
                ? 'border-[oklch(0.55_0.1_240)] bg-[oklch(0.55_0.1_240)]/10'
                : 'border-border hover:border-border/80'
            }`}
          >
            {/* Mini preview */}
            <div
              className="rounded overflow-hidden pointer-events-none"
              style={{
                width: '100%',
                aspectRatio: `${platformSize.width}/${platformSize.height}`,
                transform: 'scale(1)',
                transformOrigin: 'top left',
              }}
            >
              <div style={{
                width: platformSize.width,
                height: platformSize.height,
                transform: `scale(${168 / platformSize.width})`,
                transformOrigin: 'top left',
              }}>
                {renderSlide({ slide, theme, width: platformSize.width, height: platformSize.height })}
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground truncate">
                {i + 1}. {slide.template}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={e => { e.stopPropagation(); moveSlide(i, 'up') }} className="p-0.5 hover:bg-muted rounded" title="Move up">
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); moveSlide(i, 'down') }} className="p-0.5 hover:bg-muted rounded" title="Move down">
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); duplicateSlide(i) }} className="p-0.5 hover:bg-muted rounded" title="Duplicate">
                  <Copy className="h-2.5 w-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); removeSlide(i) }} className="p-0.5 hover:bg-muted rounded" title="Remove">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add slide by template */}
        <div className="border-t border-border pt-2 mt-2 space-y-1">
          <span className="text-[9px] text-muted-foreground">Add slide:</span>
          <div className="grid grid-cols-2 gap-1">
            {TEMPLATE_OPTIONS.map(t => (
              <button
                key={t.value}
                onClick={() => addSlide(t.value)}
                className="rounded border border-border px-1.5 py-1 text-[9px] hover:bg-muted transition-colors text-left"
                title={t.description}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Centre — live preview */}
      <div className="flex-1 flex flex-col items-center gap-4">
        {/* Platform picker */}
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_SIZES.map(size => (
            <button
              key={size.key}
              onClick={() => setPlatformSize(size)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                platformSize.key === size.key
                  ? 'bg-[oklch(0.55_0.1_240)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {size.label} ({size.aspectRatio})
            </button>
          ))}
        </div>

        {/* Live preview */}
        <div
          className="relative border border-border rounded-lg overflow-hidden shadow-lg"
          style={{
            width: platformSize.width * previewScale,
            height: platformSize.height * previewScale,
          }}
        >
          <div
            ref={slideRef}
            style={{
              width: platformSize.width,
              height: platformSize.height,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
            }}
          >
            {renderSlide({
              slide: activeSlide,
              theme,
              width: platformSize.width,
              height: platformSize.height,
            })}
          </div>
        </div>

        {/* Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportAll}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.55_0.1_240)] px-4 py-2 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export {slides.length} Slide{slides.length !== 1 ? 's' : ''}
          </button>
          {exportProgress && (
            <span className="text-[10px] text-muted-foreground">{exportProgress}</span>
          )}
        </div>
      </div>

      {/* Right panel — slide editor */}
      <div className="w-56 flex-shrink-0 space-y-3 overflow-y-auto">
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground">Template</label>
          <select
            value={activeSlide.template}
            onChange={e => updateSlide('template', e.target.value)}
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TEMPLATE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label} — {t.description}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            value={activeSlide.title}
            onChange={e => updateSlide('title', e.target.value)}
            placeholder="Slide title..."
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground">Subtitle / CTA</label>
          <input
            type="text"
            value={activeSlide.subtitle}
            onChange={e => updateSlide('subtitle', e.target.value)}
            placeholder="Subtitle or CTA text..."
            className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground">Body</label>
          <textarea
            value={activeSlide.body}
            onChange={e => updateSlide('body', e.target.value)}
            placeholder="Body text, quote, or description..."
            rows={4}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {activeSlide.template === 'stat' && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-muted-foreground">Statistic</label>
              <input
                type="text"
                value={activeSlide.stat}
                onChange={e => updateSlide('stat', e.target.value)}
                placeholder="e.g. 95%"
                className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-muted-foreground">Stat Label</label>
              <input
                type="text"
                value={activeSlide.statLabel}
                onChange={e => updateSlide('statLabel', e.target.value)}
                placeholder="e.g. success rate"
                className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </>
        )}

        {(activeSlide.template === 'image' || activeSlide.template === 'content') && (
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground">Background Image URL</label>
            <input
              type="text"
              value={activeSlide.imageUrl}
              onChange={e => updateSlide('imageUrl', e.target.value)}
              placeholder="https://..."
              className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Theme preview */}
        <div className="border-t border-border pt-3 mt-3">
          <span className="text-[10px] font-medium text-muted-foreground">Brand Theme</span>
          <div className="flex gap-1.5 mt-1.5">
            {[theme.primary, theme.secondary, theme.accent].filter(Boolean).map((c, i) => (
              <div
                key={i}
                className="h-5 w-5 rounded-full border border-border"
                style={{ backgroundColor: c }}
                title={['Primary', 'Secondary', 'Accent'][i]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
