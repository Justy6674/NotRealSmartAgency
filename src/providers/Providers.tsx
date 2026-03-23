'use client'

import { type ReactNode } from 'react'
import { ThemeProvider } from './ThemeProvider'
import { AuthProvider } from './AuthProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  )
}
