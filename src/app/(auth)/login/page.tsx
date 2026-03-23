import { constructMetadata } from '@/lib/seo'
import { LoginForm } from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'

export const metadata = constructMetadata({
  title: 'Log In',
  description: 'Log in to your NotRealSmart account',
  path: '/login',
})

export default function LoginPage() {
  return <LoginForm />
}
