import { constructMetadata } from '@/lib/seo'
import { SignupForm } from '@/components/auth/SignupForm'

export const dynamic = 'force-dynamic'

export const metadata = constructMetadata({
  title: 'Create Account',
  description: 'Create your NotRealSmart account and start building a compliant health business',
  path: '/signup',
})

export default function SignupPage() {
  return <SignupForm />
}
