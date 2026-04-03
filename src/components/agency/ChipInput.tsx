'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface ChipInputProps {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}

export function ChipInput({ items, onChange, placeholder }: ChipInputProps) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const trimmed = input.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setInput('')
    }
  }

  const handleRemove = (item: string) => {
    onChange(items.filter(i => i !== item))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
            {item}
            <button onClick={() => handleRemove(item)} className="text-muted-foreground hover:text-foreground">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
