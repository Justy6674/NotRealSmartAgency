'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { SortableItem } from '../dnd/SortableItem'
import { PagePreview, type PageBlock } from './PagePreview'
import {
  Plus,
  Trash2,
  Type,
  AlignLeft,
  ImageIcon,
  Link2,
  Share2,
  User,
  Megaphone,
  Save,
  Loader2,
} from 'lucide-react'

const BLOCK_TYPE_OPTIONS: { value: PageBlock['type']; label: string; icon: React.ReactNode }[] = [
  { value: 'bio', label: 'Bio', icon: <User className="h-3.5 w-3.5" /> },
  { value: 'heading', label: 'Heading', icon: <Type className="h-3.5 w-3.5" /> },
  { value: 'text', label: 'Text', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { value: 'image', label: 'Image', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { value: 'link_button', label: 'Link Button', icon: <Link2 className="h-3.5 w-3.5" /> },
  { value: 'social_links', label: 'Social Links', icon: <Share2 className="h-3.5 w-3.5" /> },
  { value: 'cta', label: 'Call to Action', icon: <Megaphone className="h-3.5 w-3.5" /> },
]

interface PageBuilderProps {
  initialTitle: string
  initialSlug: string
  initialBlocks: PageBlock[]
  brandName?: string
  onSave: (data: { title: string; slug: string; blocks: PageBlock[] }) => Promise<void>
}

function BlockEditor({
  block,
  onChange,
  onDelete,
}: {
  block: PageBlock
  onChange: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const update = (key: string, value: unknown) => {
    onChange(block.id, { ...block.data, [key]: value })
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {BLOCK_TYPE_OPTIONS.find(o => o.value === block.type)?.label ?? block.type}
        </span>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {block.type === 'heading' && (
          <>
            <input
              className={inputClass}
              placeholder="Heading text"
              value={(block.data.text as string) ?? ''}
              onChange={e => update('text', e.target.value)}
            />
            <select
              className={inputClass}
              value={(block.data.size as string) ?? 'h2'}
              onChange={e => update('size', e.target.value)}
            >
              <option value="h1">H1 — Large</option>
              <option value="h2">H2 — Medium</option>
              <option value="h3">H3 — Small</option>
            </select>
          </>
        )}

        {block.type === 'text' && (
          <textarea
            className={inputClass + ' min-h-[60px] resize-y'}
            placeholder="Paragraph text"
            value={(block.data.text as string) ?? ''}
            onChange={e => update('text', e.target.value)}
          />
        )}

        {block.type === 'image' && (
          <>
            <input
              className={inputClass}
              placeholder="Image URL"
              value={(block.data.url as string) ?? ''}
              onChange={e => update('url', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Alt text"
              value={(block.data.alt as string) ?? ''}
              onChange={e => update('alt', e.target.value)}
            />
          </>
        )}

        {block.type === 'link_button' && (
          <>
            <input
              className={inputClass}
              placeholder="Button label"
              value={(block.data.label as string) ?? ''}
              onChange={e => update('label', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="URL"
              value={(block.data.url as string) ?? ''}
              onChange={e => update('url', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Colour (e.g. #4285f4)"
              value={(block.data.colour as string) ?? ''}
              onChange={e => update('colour', e.target.value)}
            />
          </>
        )}

        {block.type === 'social_links' && (
          <SocialLinksEditor
            links={(block.data.links as Array<{ platform: string; url: string }>) ?? []}
            onChange={links => update('links', links)}
          />
        )}

        {block.type === 'bio' && (
          <>
            <input
              className={inputClass}
              placeholder="Name"
              value={(block.data.name as string) ?? ''}
              onChange={e => update('name', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Tagline"
              value={(block.data.tagline as string) ?? ''}
              onChange={e => update('tagline', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Avatar URL"
              value={(block.data.avatar as string) ?? ''}
              onChange={e => update('avatar', e.target.value)}
            />
          </>
        )}

        {block.type === 'cta' && (
          <>
            <input
              className={inputClass}
              placeholder="Headline"
              value={(block.data.headline as string) ?? ''}
              onChange={e => update('headline', e.target.value)}
            />
            <textarea
              className={inputClass + ' min-h-[40px] resize-y'}
              placeholder="Description"
              value={(block.data.description as string) ?? ''}
              onChange={e => update('description', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Button label"
              value={(block.data.buttonLabel as string) ?? ''}
              onChange={e => update('buttonLabel', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Button URL"
              value={(block.data.url as string) ?? ''}
              onChange={e => update('url', e.target.value)}
            />
          </>
        )}
      </div>
    </div>
  )
}

function SocialLinksEditor({
  links,
  onChange,
}: {
  links: Array<{ platform: string; url: string }>
  onChange: (links: Array<{ platform: string; url: string }>) => void
}) {
  const inputClass =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'

  const addLink = () => onChange([...links, { platform: '', url: '' }])
  const removeLink = (i: number) => onChange(links.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'platform' | 'url', value: string) => {
    const updated = [...links]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-1.5">
      {links.map((link, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            className={inputClass}
            placeholder="Platform"
            value={link.platform}
            onChange={e => updateLink(i, 'platform', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="URL"
            value={link.url}
            onChange={e => updateLink(i, 'url', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeLink(i)}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLink}
        className="text-[10px] font-medium text-primary hover:underline"
      >
        + Add social link
      </button>
    </div>
  )
}

export function PageBuilder({ initialTitle, initialSlug, initialBlocks, brandName, onSave }: PageBuilderProps) {
  const [title, setTitle] = useState(initialTitle)
  const [slug, setSlug] = useState(initialSlug)
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIndex = prev.findIndex(b => b.id === active.id)
        const newIndex = prev.findIndex(b => b.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

  const addBlock = (type: PageBlock['type']) => {
    setBlocks(prev => [
      ...prev,
      { id: crypto.randomUUID(), type, data: {} },
    ])
  }

  const updateBlock = (id: string, data: Record<string, unknown>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, data } : b)))
  }

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ title, slug, blocks })
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="flex gap-6 h-full">
      {/* Editor panel */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-4 pb-8">
        {/* Title + slug */}
        <div className="space-y-2">
          <input
            className={inputClass}
            placeholder="Page title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">/p/</span>
            <input
              className={inputClass}
              placeholder="page-slug"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
          </div>
        </div>

        {/* Blocks */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map(block => (
                <SortableItem key={block.id} id={block.id}>
                  <BlockEditor block={block} onChange={updateBlock} onDelete={deleteBlock} />
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add block buttons */}
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Add block
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => addBlock(opt.value)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving...' : 'Save Page'}
        </button>
      </div>

      {/* Preview panel */}
      <div className="hidden lg:block shrink-0">
        <div className="sticky top-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Preview
          </p>
          <PagePreview blocks={blocks} brandName={brandName ?? title} />
        </div>
      </div>
    </div>
  )
}
