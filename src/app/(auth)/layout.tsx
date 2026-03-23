import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Not<span className="text-primary">Real</span>Smart
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
