'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Brand } from '@/types/database'

interface Props {
  brands: Brand[]
  onClose: () => void
  onInvited: () => void
}

export function InviteTeamDialog({ brands, onClose, onInvited }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'viewer'>('admin')
  const [allBrands, setAllBrands] = useState(true)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        role,
        brandIds: allBrands ? null : selectedBrands,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to send invitation')
      setLoading(false)
      return
    }

    onInvited()
  }

  const toggleBrand = (id: string) => {
    setSelectedBrands(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'viewer')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="admin">Admin — can chat, create, edit, publish</option>
              <option value="viewer">Viewer — read-only access</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Brand Access</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allBrands}
                onChange={e => setAllBrands(e.target.checked)}
                className="rounded border-border"
              />
              All brands
            </label>

            {!allBrands && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                {brands.map(brand => (
                  <label key={brand.id} className="flex items-center gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand.id)}
                      onChange={() => toggleBrand(brand.id)}
                      className="rounded border-border"
                    />
                    {brand.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
