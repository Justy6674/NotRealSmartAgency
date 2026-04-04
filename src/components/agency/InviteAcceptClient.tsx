'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  ownerName: string
  role: string
  brandNames: string
}

export function InviteAcceptClient({ token, ownerName, role, brandNames }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAccept = async () => {
    setLoading(true)
    setError('')

    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/agency')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">You&apos;re Invited!</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong>{ownerName}</strong> has invited you to join their agency
          as <strong className="capitalize">{role}</strong>.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll have access to <strong>{brandNames}</strong>.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={loading}
          className="mt-6 inline-block rounded-lg bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading ? 'Accepting...' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  )
}
