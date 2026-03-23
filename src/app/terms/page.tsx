import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { SITE_CONFIG } from '@/lib/constants'

export default function TermsPage() {
  return (
    <>
      <LandingNav />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: 'oklch(0.08 0 0)', color: 'oklch(0.7 0 0)' }}>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color: 'oklch(0.9 0 0)' }}>
            Terms of Service
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
            Last updated: March 2026
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed" style={{ color: 'oklch(0.6 0 0)' }}>
            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>1. Service Description</h2>
              <p>{SITE_CONFIG.name} is an AI-powered marketing agency platform operated by {SITE_CONFIG.company}. The platform uses AI agents to produce marketing content including social media posts, ad copy, blog articles, SEO strategies, email sequences, and campaign plans.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>2. AI-Generated Content</h2>
              <p>All content produced by the platform is AI-generated and should be reviewed before publishing. AI outputs are not a substitute for professional marketing, legal, financial, or clinical advice. For regulated industries (healthcare, finance), you are responsible for ensuring all published content complies with relevant advertising guidelines including AHPRA, TGA, and ACMA regulations.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>3. Compliance Disclaimer</h2>
              <p>The compliance checking feature provides guidance only — it is not a legal determination. AHPRA and TGA advertising rules are complex and subject to change. Always consult a qualified legal advisor before publishing health-related marketing content. Penalties for non-compliant advertising can reach $60,000 per individual and $120,000 per body corporate per offence.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>4. Acceptable Use</h2>
              <p>You agree not to: use the platform for unlawful purposes, input patient health data or sensitive personal information, share your account credentials, or use AI outputs to mislead consumers or breach advertising regulations.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>5. Intellectual Property</h2>
              <p>Content you generate through the platform belongs to you. The platform, its design, code, and brand assets remain the property of {SITE_CONFIG.company}. You may not reproduce, redistribute, or reverse-engineer any part of the platform.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>6. Limitation of Liability</h2>
              <p>{SITE_CONFIG.company} is not liable for any loss, damage, or penalty arising from the use of AI-generated content, including but not limited to regulatory fines, reputational damage, or lost revenue. Our total liability is limited to fees paid in the preceding 12 months.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>7. Governing Law</h2>
              <p>These terms are governed by the laws of Queensland, Australia. Any disputes shall be resolved in the courts of Queensland.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>8. Contact</h2>
              <p>For enquiries: <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="underline hover:text-white">{SITE_CONFIG.contactEmail}</a></p>
              <p className="mt-2">{SITE_CONFIG.company} | ABN {SITE_CONFIG.abn}</p>
            </section>
          </div>
        </div>
      </div>
      <AgencyFooter />
    </>
  )
}
