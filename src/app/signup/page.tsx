import Link from 'next/link'
import { constructMetadata } from '@/lib/seo'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = constructMetadata({
  title: 'Create Account',
  description: 'Create your NotRealSmart Agency account',
  path: '/signup',
})

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          NRS<span className="text-muted-foreground font-normal text-lg ml-1.5">Agency</span>
        </Link>
      </div>
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  )
}
