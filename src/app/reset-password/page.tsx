import Image from 'next/image'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = {
  title: 'Set New Password | NotRealSmart Agency',
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-3">
        <Image src="/Favicon.png" alt="NRS" width={40} height={40} className="rounded" />
        <span className="text-lg font-bold uppercase tracking-widest" style={{ color: 'oklch(0.65 0.01 240)' }}>
          NRS Agency
        </span>
      </div>
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
