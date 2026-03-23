import { LandingNav } from '@/components/landing/LandingNav'
import { TerminalFaq } from '@/components/faq/TerminalFaq'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export const metadata = {
  title: 'FAQ | NotRealSmart Agency',
  description:
    'Frequently asked questions about NotRealSmart Agency — AI-powered marketing for Australian health businesses.',
}

export default function FaqPage() {
  return (
    <>
      <LandingNav />
      <TerminalFaq />
      <AgencyFooter />
    </>
  )
}
