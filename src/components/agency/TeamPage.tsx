'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserPlus, Trash2, Shield, Eye, Crown } from 'lucide-react'
import type { TeamMember, Brand } from '@/types/database'
import { InviteTeamDialog } from './InviteTeamDialog'

const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, colour: 'bg-amber-500/10 text-amber-500' },
  admin: { label: 'Admin', icon: Shield, colour: 'bg-blue-500/10 text-blue-500' },
  viewer: { label: 'Viewer', icon: Eye, colour: 'bg-zinc-500/10 text-zinc-400' },
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', colour: 'bg-yellow-500/10 text-yellow-500' },
  accepted: { label: 'Active', colour: 'bg-green-500/10 text-green-500' },
  revoked: { label: 'Revoked', colour: 'bg-red-500/10 text-red-500' },
}

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const fetchMembers = useCallback(() => {
    fetch('/api/team')
      .then(r => r.ok ? r.json() : [])
      .then(setMembers)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMembers()
    fetch('/api/brands')
      .then(r => r.ok ? r.json() : [])
      .then(setBrands)
  }, [fetchMembers])

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this team member?')) return
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
    if (res.ok) fetchMembers()
  }

  const handleRoleChange = async (id: string, role: string) => {
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) fetchMembers()
  }

  const getBrandNames = (brandIds: string[] | null) => {
    if (!brandIds) return 'All brands'
    return brandIds
      .map(id => brands.find(b => b.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'No brands'
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Team Members</h1>
          <p className="text-sm text-muted-foreground">
            Invite people to view or manage your brands.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : members.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">No team members yet.</p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Invite your first team member
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {members.map(member => {
            const roleConf = ROLE_CONFIG[member.role]
            const statusConf = STATUS_CONFIG[member.status]
            const RoleIcon = roleConf.icon

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <RoleIcon className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.member_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {getBrandNames(member.brand_ids)} &middot; Invited {new Date(member.invited_at).toLocaleDateString('en-AU')}
                  </p>
                </div>

                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusConf.colour}`}>
                  {statusConf.label}
                </span>

                <select
                  value={member.role}
                  onChange={e => handleRoleChange(member.id, e.target.value)}
                  className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>

                <button
                  onClick={() => handleRemove(member.id)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showInvite && (
        <InviteTeamDialog
          brands={brands}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false)
            fetchMembers()
          }}
        />
      )}
    </div>
  )
}
