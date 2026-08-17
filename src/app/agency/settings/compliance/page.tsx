'use client'

export const dynamic = 'force-dynamic'

import { DepartmentNotReady } from '@/components/agency/shell/DepartmentNotReady'

export default function SettingsCompliancePage() {
  return (
    <DepartmentNotReady
      title="Compliance record — not set up"
      body="The checks that run before a post goes out are already live. This screen will become the record of those checks. It is not connected yet."
    />
  )
}
