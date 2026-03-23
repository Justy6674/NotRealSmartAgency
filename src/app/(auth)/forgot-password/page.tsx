import { constructMetadata } from '@/lib/seo'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = constructMetadata({
  title: 'Reset Password',
  description: 'Reset your NotRealSmart Agency password',
  path: '/forgot-password',
})

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
