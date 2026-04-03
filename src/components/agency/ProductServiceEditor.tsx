'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ChipInput } from './ChipInput'
import type { ProductService } from '@/types/database'

interface ProductServiceEditorProps {
  products: ProductService[]
  onChange: (products: ProductService[]) => void
  complianceMode?: boolean
}

const EMPTY_PRODUCT: ProductService = {
  name: '',
  description: '',
  price: '',
  target_audience: '',
  usps: [],
  compliance_notes: '',
}

export function ProductServiceEditor({ products, onChange, complianceMode }: ProductServiceEditorProps) {
  const [editing, setEditing] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<ProductService>({ ...EMPTY_PRODUCT })

  const handleAdd = (product: ProductService) => {
    if (!product.name.trim() || !product.description.trim()) return
    onChange([...products, product])
    setDraft({ ...EMPTY_PRODUCT })
    setShowAdd(false)
  }

  const handleRemove = (index: number) => {
    onChange(products.filter((_, i) => i !== index))
    if (editing === index) setEditing(null)
  }

  const handleUpdate = (index: number, updated: ProductService) => {
    const next = [...products]
    next[index] = updated
    onChange(next)
    setEditing(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Products &amp; Services ({products.length})
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Product / Service
        </button>
      </div>

      {products.length === 0 && !showAdd && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No products or services added yet. Add your offerings so agents can reference them in content.
        </p>
      )}

      {products.map((product, i) => {
        if (editing === i) {
          return (
            <ProductForm
              key={i}
              value={product}
              complianceMode={complianceMode}
              onSave={(updated) => handleUpdate(i, updated)}
              onCancel={() => setEditing(null)}
            />
          )
        }

        return (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{product.name}</span>
              {product.price && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {product.price}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setEditing(i)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{product.description}</p>
            {product.target_audience && (
              <p className="text-[10px] text-muted-foreground">
                Audience: {product.target_audience}
              </p>
            )}
            {product.usps && product.usps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.usps.map((usp) => (
                  <span key={usp} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {usp}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {showAdd && (
        <ProductForm
          value={draft}
          complianceMode={complianceMode}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          isNew
        />
      )}
    </div>
  )
}

// ─── Product Form ─────────────────────────────────────────────────────────────

function ProductForm({
  value,
  complianceMode,
  onSave,
  onCancel,
  isNew,
}: {
  value: ProductService
  complianceMode?: boolean
  onSave: (product: ProductService) => void
  onCancel: () => void
  isNew?: boolean
}) {
  const [form, setForm] = useState<ProductService>({ ...value })

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground">Name</label>
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., Telehealth Weight Loss Consultation"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="What this product or service is and what it includes"
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Price</label>
          <input
            value={form.price ?? ''}
            onChange={e => setForm({ ...form, price: e.target.value })}
            placeholder="e.g., $99/month"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Target Audience</label>
          <input
            value={form.target_audience ?? ''}
            onChange={e => setForm({ ...form, target_audience: e.target.value })}
            placeholder="e.g., Women 25-45 seeking weight loss"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">USPs</label>
        <ChipInput
          items={form.usps ?? []}
          onChange={usps => setForm({ ...form, usps })}
          placeholder="e.g., evidence-based, Medicare bulk-billed"
        />
      </div>

      {complianceMode && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Compliance Notes</label>
          <textarea
            value={form.compliance_notes ?? ''}
            onChange={e => setForm({ ...form, compliance_notes: e.target.value })}
            placeholder="e.g., Must include risk disclaimer"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || !form.description.trim()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isNew ? 'Add' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
