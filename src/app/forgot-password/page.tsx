export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { constructMetadata } from '@/lib/seo'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = constructMetadata({
  title: 'Reset Password',
  description: 'Reset your NotRealSmart Agency password',
  path: '/forgot-password',
})

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          NRS<span className="text-muted-foreground font-normal text-lg ml-1.5">Agency</span>
        </Link>
      </div>
      <div className="w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
