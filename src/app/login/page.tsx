export const dynamic = 'force-dynamic'

import { constructMetadata } from '@/lib/seo'
import { LoginPageClient } from '@/components/auth/LoginPageClient'

export const metadata = constructMetadata({
  title: 'Log In',
  description: 'Log in to your NotRealSmart Agency account',
  path: '/login',
})

export default function LoginPage() {
  return <LoginPageClient />
}
