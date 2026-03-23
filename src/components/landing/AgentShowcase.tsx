import {
  PenLine, Search, Megaphone, Target, Mail,
  TrendingUp, Palette, Eye, Globe, ShieldCheck,
} from 'lucide-react'

const DEPARTMENTS = [
  { name: 'Content & Copy', icon: PenLine, desc: 'Social posts, blogs, landing pages — publish-ready' },
  { name: 'SEO', icon: Search, desc: 'Keywords, topic clusters, on-page optimisation' },
  { name: 'Paid Ads', icon: Megaphone, desc: 'Meta, Google, LinkedIn, TikTok ad sets' },
  { name: 'Strategy & Launch', icon: Target, desc: 'Campaign plans, GTM, launch playbooks' },
  { name: 'Email Marketing', icon: Mail, desc: 'Sequences, EDMs, newsletters — subject to send' },
  { name: 'Growth', icon: TrendingUp, desc: 'Referral programs, PR pitches, partnerships' },
  { name: 'Brand', icon: Palette, desc: 'Voice guides, pillars, competitor analysis' },
  { name: 'Competitor Intel', icon: Eye, desc: 'Messaging gaps, pricing analysis, SWOT' },
  { name: 'Website', icon: Globe, desc: 'Page copy, UX suggestions, conversion optimisation' },
  { name: 'Compliance', icon: ShieldCheck, desc: 'AHPRA/TGA advertising checks and rewrites' },
]

export function AgentShowcase() {
  return (
    <section className="px-6 py-24" style={{ background: 'oklch(0.08 0 0)' }}>
      <div className="mx-auto max-w-6xl">
        <h2
          className="text-center text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: 'oklch(0.92 0 0)' }}
        >
          10 Departments. One Agency. Zero Headcount.
        </h2>
        <p
          className="mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: 'oklch(0.55 0 0)' }}
        >
          Each agent is a specialist. Pick one, brief it, get finished output.
        </p>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DEPARTMENTS.map(({ name, icon: Icon, desc }) => (
            <div
              key={name}
              className="group rounded-xl border p-5 transition-all hover:border-[oklch(0.55_0.12_55)]"
              style={{
                background: 'oklch(0.12 0 0)',
                borderColor: 'oklch(0.2 0 0)',
              }}
            >
              <Icon
                className="h-5 w-5 transition-colors group-hover:text-[oklch(0.75_0.15_75)]"
                style={{ color: 'oklch(0.5 0 0)' }}
              />
              <h3
                className="mt-3 text-sm font-semibold"
                style={{ color: 'oklch(0.88 0 0)' }}
              >
                {name}
              </h3>
              <p
                className="mt-1.5 text-xs leading-relaxed"
                style={{ color: 'oklch(0.5 0 0)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
