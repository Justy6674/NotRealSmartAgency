'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

/**
 * Google OAuth — hidden until Google Cloud OAuth credentials are configured
 * in Supabase Dashboard → Authentication → Providers → Google.
 * To enable: add Client ID + Secret, toggle ON, then remove the early return below.
 */
export function OAuthButtons() {
  // TODO: Enable when Google OAuth is configured in Supabase
  return null
}
