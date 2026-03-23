import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { SITE_CONFIG } from '@/lib/constants'

export default function PrivacyPage() {
  return (
    <>
      <LandingNav />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: 'oklch(0.08 0 0)', color: 'oklch(0.7 0 0)' }}>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color: 'oklch(0.9 0 0)' }}>
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'oklch(0.45 0 0)' }}>
            Last updated: March 2026
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed" style={{ color: 'oklch(0.6 0 0)' }}>
            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>1. Who We Are</h2>
              <p>{SITE_CONFIG.company} (ABN {SITE_CONFIG.abn}) operates {SITE_CONFIG.name} at {SITE_CONFIG.domain}. We are an Australian company subject to the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>2. What We Collect</h2>
              <p>We collect: email address, name, brand profiles you create, marketing content you generate, and usage analytics. We do NOT collect or store patient health information, clinical data, or sensitive personal information.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>3. How We Use Your Information</h2>
              <p>Your information is used to: provide the agency platform, generate marketing outputs via AI, improve our service, and communicate with you about your account. We do not sell your data.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>4. Third-Party Services</h2>
              <p>We use: Supabase (database and authentication), Vercel (hosting and AI Gateway), and Anthropic (Claude AI for content generation). Your data may be processed by these services in accordance with their privacy policies. AI-generated content is not stored by Anthropic after processing.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>5. Data Security</h2>
              <p>We implement industry-standard security measures including encryption in transit (TLS), row-level security on all database tables, and secure authentication via Supabase Auth. Access to service-role credentials is restricted to server-side webhook handlers.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>6. Your Rights</h2>
              <p>Under the APPs, you have the right to: access your personal information, request correction of inaccurate data, request deletion of your data, and lodge a complaint with the Office of the Australian Information Commissioner (OAIC).</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'oklch(0.8 0 0)' }}>7. Contact</h2>
              <p>For privacy enquiries: <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="underline hover:text-white">{SITE_CONFIG.contactEmail}</a></p>
              <p className="mt-2">{SITE_CONFIG.company} | ABN {SITE_CONFIG.abn}</p>
            </section>
          </div>
        </div>
      </div>
      <AgencyFooter />
    </>
  )
}
