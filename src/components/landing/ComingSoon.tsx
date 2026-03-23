import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: 'oklch(0.08 0 0)' }}
    >
      <Image src="/Favicon.png" alt="NRS" width={48} height={48} className="mb-8 rounded" />
      <h1
        className="text-3xl font-bold uppercase tracking-wider md:text-4xl"
        style={{
          backgroundImage: 'linear-gradient(170deg, oklch(0.9 0.005 250), oklch(0.55 0.008 240))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {title}
      </h1>
      <p className="mt-4 text-sm" style={{ color: 'oklch(0.5 0 0)' }}>
        {description}
      </p>
      <div
        className="mt-3 inline-block rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest"
        style={{ background: 'oklch(0.15 0.01 240)', color: 'oklch(0.6 0.01 240)' }}
      >
        Coming Soon
      </div>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-widest transition-colors hover:text-white"
        style={{ color: 'oklch(0.45 0 0)' }}
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </Link>
    </div>
  )
}
