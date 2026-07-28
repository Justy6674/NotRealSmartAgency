/**
 * Brand Portfolio Intelligence — Auto-scanned from local repos
 *
 * This provides deep context about each brand that goes beyond
 * what's stored in the brands table. Agents use this to understand
 * the full product ecosystem.
 *
 * Last scanned: 2026-07-28
 */

export const BRAND_PORTFOLIO: Record<string, string> = {
  'downscale-weight-loss': `
## Downscale Weight Loss — Deep Context
- **Product**: Telehealth weight loss clinic + AI health companion (7 pillars: medication, nutrition, activity, mental health, sleep, water, skin)
- **Tech**: Next.js, Supabase, Vercel AI SDK, Halaxy integration, gamified water tracker, push notifications, podcast platform
- **Practitioners**: Nurse Practitioners, Dietitians, Psychologists (NOT doctors)
- **Patient portal**: Free for current patients, premium features planned
- **Staff**: 40+ contracted clinicians with internal dashboard (downscale-dashboard)
- **Standalone products**: Water4WeightLoss tracker (can be white-labelled)
- **Key differentiator**: Full clinical ecosystem — telehealth consult + evidence-based resources + behaviour change tools. Not just an app.
- **Related repos**: DSWebsite_next.js (main site), downscale-dashboard (staff portal), water4weightlossvercel (hydration tracker), downdiary (AI companion)
`,

  'downscalederm': `
## DownscaleDerm — Deep Context
- **Product**: NP-led standalone Australian telehealth dermatology
- **Tech**: Next.js 14, Supabase, Resend, Halaxy for bookings
- **Model**: Marketing site + external Halaxy booking. NOT a clinical app.
- **Practitioners**: Nurse Practitioners ONLY (NEVER say "doctor" or "dermatologist")
- **TGA rules**: Cannot say "prescription skincare", "prescription-strength", "medical-grade". No before/after photos.
- **Services**: Telehealth consults, acne self-assessment tool
- **Status**: Marketing site live, admin area WIP
`,

  'telescribe': `
## TeleScribe — Deep Context
- **Product**: AI clinical scribe for 35+ clinician roles and 50+ specialties
- **How it works**: Captures audio (in-person, telehealth, hybrid) → 4-layer ASR fallback (Deepgram → OpenAI → Whisper → Groq) → structured SOAP notes
- **Tech**: Next.js 14.2, Supabase, Vercel AI SDK (GPT-4.1-mini default, Claude Sonnet premium), Stripe, Vonage/Twilio for phone
- **TeleCheck built-in**: Medicare telehealth eligibility checker with 9 exemption categories
- **Pricing**: $69/month per clinician (unlimited notes, TeleCheck, all note types). 14-day free trial. Group discounts.
- **Compliance**: TGA boundary — documentation aid only, NOT clinical decision support. Audio processed in-memory only (never stored).
- **Target**: Individual clinicians (GPs, NPs, psychologists, physios, midwives)
- **Competitors**: Heidi Health, Lyrebird Health (AI scribes). Best Practice, MedicalDirector (legacy PMS)
`,

  'tele360': `
## Tele360 — Deep Context
- **Product**: Full Australian practice management system (PMS) — telehealth-first, AI-native. Replaces Halaxy, Best Practice, MedicalDirector.
- **Repo**: Tele360PMS (local), tele360 (GitHub)
- **Tech**: Next.js 14.2, Supabase (23 tables), shadcn/ui, Tailwind CSS, PDFKit, Vercel Cron, Stripe (Phase 2)
- **Core features**: Day/week calendar scheduling, patient management, 9 clinical note types, MBS invoicing with fee schedule lookup, payment recording, Medicare/DVA claiming prep, pathology/radiology orders, prescriptions (ePrescribing-ready), referral letters, 12 validated clinical calculators (BMI, PHQ-9, K10, Epworth, ASRS, etc.), public booking page with auto-patient creation
- **TeleScribe embedded**: The consult workspace IS TeleScribe — AI scribe + phone/video + clinical tools
- **TeleCheck embedded**: Medicare disaster eligibility checker syncs daily
- **Competitors**: Halaxy (primary — being replaced), Best Practice, MedicalDirector, Cliniko, Zedmed, Jane App
- **Target**: Australian clinics — GP, allied health, multi-specialty. Phase 2: multi-clinic networks with SaaS model.
- **Pricing (Phase 2)**: Per-seat SaaS subscriptions, video add-on. Phase 1 is single-clinic free/trial.
- **Compliance**: Multi-tenancy via clinic_id + RLS. Audit logging on invoices, payments, notes, orders. Consent capture. GST-free medical services (Health Insurance Act 1973). AI = documentation aid only.
- **Key differentiator**: Only PMS built by a clinician who codes. AI-native from day one. Not a bolt-on — TeleScribe IS the consult experience.
`,

  'telecheck': `
## TeleCheck — Deep Context
- **Product**: Medicare telehealth disaster eligibility checker
- **Two products**: Individual ($14.95/mo, Vite app) + Clinic-Wide ($299/mo, Next.js 15.5 with team management)
- **4 access methods**: Web Portal (25 seats), REST API, SSO/SAML, Embeddable Widget
- **How it works**: Postcode → LGA → disaster zone matching. Traffic light system (Green/Amber/Red). Bulk bill + patient claim + DVA support.
- **Tech**: Next.js 15.5, Supabase, Stripe, TanStack React Query
- **Halaxy integration**: Webhooks for PMS sync
- **Team management**: Org owner/admin/practitioner/reception roles
- **Audit logging**: All searches logged (search_audit_log table)
`,

  'notrealsmart': `
## NotRealSmart — Deep Context
- **Product**: Self-serve AI guide for building Australian health businesses. Maps complete lifecycle: 15 phase groups → 34 phases → 200+ verified tools.
- **Target**: B2B — healthcare professionals building practices (NOT patients)
- **Agency platform**: 13 AI agents (1 Director + 12 departments) running marketing autonomously across 8 brands
- **Pricing**: Starter $29/mo, Professional $79/mo, Practice $149/mo
- **Tech**: Next.js 15.3, React 19, Supabase, Stripe, Vercel AI SDK v6, shadcn/ui v4
- **Features**: Tool map, phase tracking, compliance scans, meeting room (multi-dept collaboration), 10-action report bar
`,

  'downscale-diary': `
## Downscale Diary — Deep Context
- **Product**: National paid AI health companion (ChatGPT-style conversational interface)
- **7 tracking domains**: Nutrition, hydration, sleep, activity, mood, clinical/medication, intimacy
- **Tech**: Next.js 16, React 19, Drizzle ORM, Supabase, Vercel AI SDK v6, Stripe
- **Model**: 5 free messages logged-out. Unlimited with premium subscription.
- **Practitioners**: NPs, Dietitians, Psychologists
- **Ported from**: AbeAI v1
`,

  'scent-sell': `
## Scent Sell — Deep Context
- **Product**: Australian second-hand fragrance marketplace — buy, sell and swap authentic perfume, cologne, niche fragrance and decants (scentsell.com.au). NOT an intimacy app. NOT seggs.life.
- **Audience**: AU fragrance enthusiasts 18–45 — collectors, hobbyists, people hunting affordable niche bottles without full-bottle risk.
- **Voice**: Casual, community-first, fragrance-literate. Keywords: fragrance, perfume, niche, decant, authentic, community. Never say fake/replica/knockoff about legitimate listings.
- **Content pillars**: Fragrance reviews, collection showcases, marketplace tips, niche discoveries, community features.
- **Angle for "why look at Scent Sell"**: trusted AU marketplace for real bottles and decants; try/own niche without RRP pain; community of enthusiasts, not department-store fluff.
- **Social focus (searchable + brand-aware)**: Instagram + Facebook + YouTube are the primary surfaces. Captions must be fragrance-specific and searchable (notes, house, bottle format, AU marketplace intent) — not generic "check us out". Hashtags: 3–5 niche tags max (#nichefragrance #perfumecommunity #scenttok etc.), never a 30-tag dump.
- **Sibling house**: Underground Parfums is a separate indie perfume house brand — do not mix Scent Sell marketplace copy with Underground house authorship unless the owner explicitly asks for a cross-promo.
- **Compliance**: Not AHPRA/TGA. Still no invented scent notes for a specific bottle unless the owner or listing evidence supplies them.
`,

  'underground-parfums': `
## Underground Parfums — Deep Context
- **Product**: Australian small-batch independent perfume house — scent as memory, quiet craft and restraint (undergroundparfums.com).
- **Audience**: Art-house fragrance buyers in AU and internationally who reject mainstream perfume sameness and generic note-pyramid marketing.
- **Voice (IMMUTABLE)**: Memory before note. One quiet declarative idea per sentence. Never invent a scent profile, accord, or notes. Avoid: exclusive, best, luxury, must-have.
- **Founder voice**: small-batch house authorship. Signature: "Memories turned into Perfumes….Fragrances to make new Memories".
- **Content pillars**: memory and place, quiet craft, behind the bench, the house.
- **Social / searchable copy**: Captions should read as authored sensory writing, not marketplace hype. Put searchable place/memory language in the caption body (Instagram/YouTube search indexes captions). Hashtags sparse and specific — never luxury-hype tags.
- **Sibling**: Scent Sell is the marketplace brand — keep Underground house voice separate unless the owner asks for a deliberate cross-link.
`,

  'endorseme': `
## EndorseMe — Deep Context
- **Product**: Portfolio builder for Australian Registered Nurses pursuing NP endorsement via AHPRA/NMBA
- **Tech**: Next.js (App Router), Vercel
- **Core features**: Hours tracking (5,000 advanced practice hours requirement), CPD log (AHPRA year: 1 Jun–31 May), document storage, referee request workflows, portfolio export (PDF)
- **Integrity-first**: NEVER fabricates evidence. Only stores and organises real uploads.
- **Two pathways**: (1) Approved NP Master's, (2) Substantial equivalence
- **Target**: Registered Nurses post-Master's NP program
- **AHPRA compliance**: All NP Standards for Practice mapped. Evidence categories: transcripts, statements of service, CV, support letters, CPD, leadership/research exemplars
`,

  'matron': `
## Matron — Deep Context (internal consultancy, NOT an NRS brand)
- **Product**: Premium healthcare digital transformation consultancy
- **Model**: Invitation-only, colleague-to-colleague
- **Rate**: $350/hour base. Colleague discounts 25-50%.
- **Service tiers**: Essential ($1K-4K), Professional ($2K-5K), Enterprise ($8K-15K)
- **Services**: Healthcare websites, Halaxy setup, brand identity, telehealth integration, compliance audits
- **Tech**: React 18, Vite, Supabase
- **NOT a public brand** — internal B2B tool
`,
}

/**
 * Get deep brand context for a brand slug.
 * Falls back to null if not found.
 */
export function getBrandPortfolioContext(brandSlug: string): string | null {
  if (BRAND_PORTFOLIO[brandSlug]) return BRAND_PORTFOLIO[brandSlug]

  for (const [key, value] of Object.entries(BRAND_PORTFOLIO)) {
    if (brandSlug.includes(key) || key.includes(brandSlug)) return value
  }

  return null
}
