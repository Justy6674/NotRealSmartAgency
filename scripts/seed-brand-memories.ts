/**
 * Seed script: Inject business knowledge about all 8 brands into agent_memories.
 *
 * Usage: npx tsx scripts/seed-brand-memories.ts
 *
 * Idempotent — upserts by namespace + key.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ---------------------------------------------------------------------------
// Brand knowledge to seed
// ---------------------------------------------------------------------------

interface BrandMemory {
  namespace: string          // nrs-{slug}-{agentType} or nrs-agency (global)
  key: string
  value: string
  tags: string[]
}

const BRAND_MEMORIES: BrandMemory[] = [

  // ─── GLOBAL AGENCY KNOWLEDGE ──────────────────────────────────────────────
  {
    namespace: 'nrs-agency',
    key: 'agency-overview',
    value: `NotRealSmart Agency is a self-owned agentic AI marketing agency owned by Black Health Intelligence Pty Ltd (ABN 23 693 026 112). The founder is Justin. The agency runs marketing autonomously across 8 brands using 1 Director + 12 department heads. The agency is NOT a client-service business — it markets Justin's own brands.`,
    tags: ['agency', 'overview', 'ownership'],
  },
  {
    namespace: 'nrs-agency',
    key: 'brand-portfolio',
    value: `Justin's 8 brands:
1. Downscale Weight Loss — NP-led GLP-1 telehealth weight management ($45 consults)
2. DownscaleDerm — Prescription skincare via telehealth (tretinoin compounding, $79/$49)
3. TeleScribe — AI clinical scribe for healthcare professionals ($69/mo)
4. TeleCheck — Medicare compliance checker for telehealth ($14.95 individual, $299 clinic-wide)
5. EndorseMe — NP endorsement tracking app (5000-hour tracking, NMBA portfolio)
6. ScentSell — Australia's trusted fragrance marketplace (24,000+ fragrances, escrowed payments, verified sellers, prepaid shipping)
7. Downscale Diary — Conversational AI health journal (messenger-style, Drizzle ORM)
8. NotRealSmart — The agency platform itself (13 agents, self-owned orchestration)`,
    tags: ['brands', 'portfolio', 'overview'],
  },
  {
    namespace: 'nrs-agency',
    key: 'compliance-context',
    value: `Compliance requirements across brands:
- AHPRA-regulated: Downscale Weight Loss, DownscaleDerm, EndorseMe (health practitioner advertising)
- TGA-regulated: Downscale Weight Loss (weight loss category), DownscaleDerm (prescription_medicines, skincare)
- Non-regulated: TeleScribe, TeleCheck, ScentSwap, Downscale Diary, NotRealSmart (SaaS/tech products)
- AHPRA now uses AI to scan websites and social media since Sep 2025
- Penalties: up to $60K individual, $120K body corporate per offence`,
    tags: ['compliance', 'ahpra', 'tga', 'regulation'],
  },

  // ─── DOWNSCALE WEIGHT LOSS ────────────────────────────────────────────────
  {
    namespace: 'nrs-downscale-weight-loss-overall',
    key: 'brand-context',
    value: `Downscale Weight Loss is a nurse practitioner-led telehealth weight management service.

Key facts:
- $45 initial consultations (significantly cheaper than competitors at $99-199)
- NP-led model (nurse practitioners, not GPs — lower overhead, same prescribing rights for GLP-1s)
- 7 Pillars approach: Nutrition, Movement, Sleep, Stress, Medication, Mindset, Community
- GLP-1 medications prescribed (semaglutide, tirzepatide) — NEVER name these in marketing
- Halaxy for booking and practice management
- Podcast: "The Weight Loss Conversation" — educational, compliance-safe
- Target audience: Women 30-55, regional Australia, time-poor, tried diets before
- Competitors: Juniper ($99/mo), Eucalyptus/Pilot ($149/mo), Rosemary Health, Found (US)
- USP: Most affordable NP-led weight management in AU + holistic 7-pillar approach`,
    tags: ['downscale', 'weight-loss', 'context', 'overview'],
  },
  {
    namespace: 'nrs-downscale-weight-loss-overall',
    key: 'marketing-strategy',
    value: `Marketing strategy for Downscale Weight Loss:
- Lead with affordability ($45 vs $99-199 competitors) and accessibility (telehealth, no waitlist)
- Content pillars: Education (how GLP-1s work — without naming drugs), 7 Pillars lifestyle content, Behind-the-scenes (team, process), Success framing (journey stories, NOT testimonials)
- Primary channels: Instagram (carousel education), TikTok (myth-busting), Google Ads (high-intent search), Blog (SEO content clusters)
- NEVER: name medications, promise weight loss amounts, use before/after without disclaimers
- ALWAYS: include health disclaimer, use "evidence-based", mention "clinician-prescribed"
- Podcast strategy: weekly episodes, guest experts, cross-promote on social
- Referral program: $10 credit per referral (service credit, not cash)`,
    tags: ['downscale', 'weight-loss', 'strategy', 'marketing'],
  },

  // ─── DOWNSCALEDERM ────────────────────────────────────────────────────────
  {
    namespace: 'nrs-downscalederm-overall',
    key: 'brand-context',
    value: `DownscaleDerm is a prescription skincare telehealth service (coming soon).

Key facts:
- Tretinoin compounding (custom concentrations via compounding pharmacy)
- Pricing: $79 initial consult, $49 follow-ups
- TGA Category D (prescription_medicines + skincare)
- Target audience: Women 25-45, interested in anti-ageing, acne management, prescription-strength skincare
- Competitors: Software (AU), Dermatica (UK model), Curology (US model), Skin+Me
- USP: Compounded tretinoin (custom strength) + NP-led + affordable
- NEVER name tretinoin, adapalene, or any S4 ingredients in consumer marketing
- Use: "prescription-strength skincare", "medical-grade skincare", "clinician-prescribed"`,
    tags: ['downscalederm', 'skincare', 'context', 'overview'],
  },

  // ─── TELESCRIBE ───────────────────────────────────────────────────────────
  {
    namespace: 'nrs-telescribe-overall',
    key: 'brand-context',
    value: `TeleScribe — Australian AI Clinical Scribe for every consultation type.

PRODUCT:
- $69/mo (14-day free trial) — unlimited notes, all features
- 4-layer ASR fallback: Deepgram nova-3-medical → OpenAI gpt-4o-mini-transcribe → Whisper → Groq
- 10+ note types in Australian SOAP format via AI Gateway (GPT-4.1-mini default, Claude Sonnet premium)
- 35+ clinician roles, 50+ specialties, clinical knowledge packs
- BYO phone consults: Vonage/Twilio — clinics keep their own number, server-side audio capture via WebSocket
- Video consults: Raw WebRTC browser-to-browser (admin-gated)
- TeleCheck integration: Medicare disaster eligibility, MBS item suggestions, 9 exemption categories
- Smart Send: Clinician-curated patient resource bank with email audit
- Supplementary documents: referral letters, certificates, addendums
- Group discounts via negotiated coupon codes

ARCHITECTURE:
- Audio worker on BinaryLane Brisbane VPS ($7.50/mo) — Vonage WebSocket streams mixed L16/PCM audio
- Core data in Supabase Sydney (Australian data sovereignty)
- Audio NEVER stored — processed in-memory, discarded after transcription
- Draft documentation disclaimer on all outputs (TGA-safe)
- Clinician review workflow aligned with RACGP/Avant guidance

ZERO SUBSCRIBERS — BIGGEST MONEY PIT:
- Product is fully built and functional
- Website live at telescribe.com.au
- Stripe billing configured ($69/mo Clinician plan)
- No marketing has been done — zero customer acquisition effort
- Need: launch campaign, content marketing, direct outreach to clinicians

TARGET AUDIENCE:
- Primary: Time-poor GPs doing 30+ consults/day (save 1-2 hrs/day on docs)
- Secondary: NPs in telehealth (documentation burden is highest)
- Tertiary: Allied health practitioners, practice managers
- Pain point: "I spend more time typing notes than seeing patients"

COMPETITORS:
- Heidi Health: 50,000+ clinicians, $6.6M funding, workflow automation — THE market leader
- Lyrebird Health: 4,500+ GPs, deep EMR integration (Best Practice, Medical Director), on-device option
- mAIscribe: MBS billing optimisation (15-20% billing uplift) — unique angle
- Coviu Assist: Built into Coviu telehealth platform
- Amplify+: "Gold standard" claim
- i-scribe: AU accent focus

TELESCRIBE DIFFERENTIATORS vs COMPETITORS:
1. $69/mo (cheapest — Heidi/Lyrebird are $99-149+)
2. BYO phone (Vonage/Twilio — NO ONE else does this)
3. TeleCheck integration (Medicare compliance built-in — NO ONE else)
4. Server-side audio capture (works with headphones — browser-only scribes can't)
5. 35+ roles + 50+ specialties (broadest coverage)
6. Australian data sovereignty (Supabase Sydney)
7. Built by an NP who uses it in their own clinic (dogfooding)

KEY SELLING POINTS FOR MARKETING:
- "Save 1-2 hours/day on documentation"
- "Use your own phone — no app to install"
- "$69/mo — less than the cost of 1 missed consult"
- "Built by an Australian NP, for Australian clinicians"
- "TeleCheck built in — Medicare compliance in every note"
- "35+ roles, 50+ specialties, one subscription"
- "Your notes. Your patients. Your data stays in Australia."`,
    tags: ['telescribe', 'scribe', 'context', 'overview', 'zero-subscribers'],
  },

  // ─── TELECHECK ────────────────────────────────────────────────────────────
  {
    namespace: 'nrs-telecheck-overall',
    key: 'brand-context',
    value: `TeleCheck is a Medicare compliance checker for telehealth providers.

Key facts:
- Pricing: $14.95/month individual, $299/month clinic-wide
- Checks telehealth consultations against Medicare compliance requirements
- 9 exemption categories for the 12-month rule (Medicare telehealth requires in-person visit within 12 months, with exceptions)
- Medicare items: 91 (telehealth GP), 92 (telehealth specialist), 2799-2802 (mental health)
- Target audience: Telehealth clinics, GPs, practice managers worried about Medicare audit
- Competitors: None directly — most practices rely on manual compliance checking
- USP: Only automated Medicare telehealth compliance checker in AU
- Key pain point: Practices fear Medicare audits and clawbacks for non-compliant billing`,
    tags: ['telecheck', 'medicare', 'compliance', 'context'],
  },

  // ─── ENDORSEME ────────────────────────────────────────────────────────────
  {
    namespace: 'nrs-endorseme-overall',
    key: 'brand-context',
    value: `EndorseMe is a nurse practitioner endorsement tracking app.

Key facts:
- Tracks the 5,000 advanced practice hours required for NP endorsement through AHPRA/NMBA
- Portfolio evidence builder (maps activities to NMBA NP Standards for Practice)
- Integrity-first approach (no shortcuts, genuine evidence)
- Target audience: Registered nurses pursuing NP endorsement (estimated 2,000-3,000 candidates at any time in AU)
- AHPRA/NMBA regulations: NP endorsement requires 5,000 hours of advanced practice, master's degree, portfolio assessment
- Competitors: None — most NP candidates use spreadsheets or paper logs
- USP: Only purpose-built NP endorsement tracker in AU
- Marketing angle: "Built by an NP candidate, for NP candidates"
- AHPRA-regulated (advertising of health practitioner services)`,
    tags: ['endorseme', 'np', 'ahpra', 'context'],
  },

  // ─── SCENTSWAP ────────────────────────────────────────────────────────────
  {
    namespace: 'nrs-scentswap-overall',
    key: 'brand-context',
    value: `ScentSell (formerly ScentSwap) — Australia's trusted fragrance marketplace. A peer-to-peer marketplace for pre-owned fragrances with escrowed payments, verified sellers, and prepaid shipping.

PLATFORM MODEL: Peer-to-peer marketplace (buy/sell, NOT barter)
- Stripe Payments + Stripe Connect (platform fee + delayed payouts = escrow-style)
- Escrowed payouts: buyer pays → funds held → seller ships → buyer confirms → payout released
- Commission on each completed sale (platform fee via Stripe Connect)
- Optional paid boosts/pinned listings for extra visibility

Key facts:
- 24,000+ verified fragrances in master database (fragrance_master table)
- Escrow-style payments via Stripe (trust layer)
- Verified sellers with KYC, authenticity checks, batch code verification
- Prepaid shipping labels via Shippit + Australia Post integration
- House Scanner: automated fragrance discovery (scan fragrance houses → enrich DB)
- Curated collections: "Scent Sell Sniffs" — admin-curated brand/theme promotions
- Dispute resolution system with admin overrides

AUTOMATED VALUATION (Equity Calculation Logic):
- 15% base second-hand reduction from RRP
- Proportional usage deduction (fill percentage)
- Missing cap: -5% | Missing box: -2%
- Rarity/Discontinued premium: +15%
- International availability adjustment: +$15
- Result: fair suggested price that protects buyers and sellers

Tech stack: React 18 + TypeScript + Vite, Supabase (DB/Auth/Storage), Stripe Connect, Shippit/AusPost

Buyer flow: Browse/search → offer or buy now → pay (escrowed) → track AusPost → confirm delivery → seller paid
Seller flow: Create listing (photos + details + pricing) → receive offers/buys → print prepaid label → ship → funds released

Target audience:
- Primary: Fragrance enthusiasts with "fragrance graveyards" (25-45, 60% F / 40% M)
- Secondary: Budget-conscious wanting to try niche/designer at reduced prices (18-30)
- Tertiary: Collectors seeking discontinued/rare fragrances
- Pain points: High AU retail prices (GST + import = $20-50 more than US), trust issues on Facebook groups, no dedicated AU fragrance marketplace

Competitors:
- Facebook groups ("Fragrance Swap Australia") — no escrow, no verification, trust issues
- Reddit r/fragranceswap — unstructured, no AU shipping integration
- eBay AU — general marketplace, no fragrance specialisation, high fees
- Mercari — not popular in AU, no fragrance focus
- Depop — fashion-focused, fragrance is secondary
- NONE with escrow + verification + AU shipping + fragrance-specific features

Marketing channels (priority):
1. TikTok #perfumetok (8B+ views — unboxing, haul videos, "selling my collection")
2. Instagram #FragComm (flat-lays, collection grids, listing showcases)
3. Reddit r/fragrance (500K+ members — community engagement, seller verification posts)
4. Fragrantica forums (community engagement, database cross-reference)
5. YouTube (fragrance reviews, "I sold X fragrances on ScentSell" content)
6. Facebook fragrance groups (direct outreach to existing swap communities)

Content pillars:
- Trust: "Escrowed payments mean you're always protected"
- Discovery: Curated collections (Sniffs), seasonal picks, trending fragrances
- Education: Fragrance families, note structures, "how to spot fakes"
- Community: Seller spotlights, top-rated sellers, swap/sell success stories
- Seasonal: "Best summer fragrances AU", "Winter warmers", "Valentine's Day picks"
- Value: "Designer fragrances at pre-owned prices", "Try niche without the full-bottle risk"

USP: Australia's only dedicated fragrance marketplace with escrowed payments, verified sellers, and prepaid shipping.
NOT health-regulated — lifestyle/consumer product. GST applies (10% on all transactions).`,
    tags: ['scentsell', 'fragrance', 'marketplace', 'context', 'escrow', 'shipping'],
  },

  // ─── DOWNSCALE DIARY ──────────────────────────────────────────────────────
  {
    namespace: 'nrs-downscale-diary-overall',
    key: 'brand-context',
    value: `Downscale Diary is a conversational AI health journal — your weight management companion that feels like texting a friend.

Key facts:
- Messenger-style interface (chat with your health journal, not forms or spreadsheets)
- AI-powered insights from journal entries (mood tracking, food logging, medication adherence, sleep, exercise)
- Built with Drizzle ORM, conversational AI backend
- Integrated into the Downscale ecosystem (cross-sell with Weight Loss + Derm)
- NOT a medical device — personal wellness tool (no TGA regulation)
- Privacy-first: data stays on device where possible, encrypted at rest

Why conversational journaling works:
- 78% of people abandon traditional health trackers within 2 weeks (form fatigue)
- Chat-based logging reduces friction: "Had a coffee and toast for brekkie" → AI parses → food log
- CBT-based journaling has strong evidence for weight management, mood, and behaviour change
- Conversational UI creates accountability without judgement
- AI can spot patterns humans miss: "You tend to snack more on days you skip breakfast"

Core features:
- Food logging: Natural language → structured nutrition data ("Had sushi for lunch" → parsed)
- Mood tracking: Emoji + free text → sentiment analysis → pattern detection
- Medication adherence: "Took my injection" → logged with timestamp + reminders
- Sleep logging: "Slept terribly, woke up 3 times" → sleep quality score
- Exercise logging: "Walked the dog for 30 min" → activity logged
- Weekly AI insights: "This week you logged 4/7 meals, mood averaged 7/10, exercise 3x"
- Progress photos: Optional photo timeline with privacy controls
- Clinician sharing: Export journal summary to share at next consult

Target audience:
- Primary: Downscale Weight Loss patients (cross-sell — offered during onboarding)
- Secondary: Anyone on a weight management journey wanting a low-friction tracker
- Tertiary: Mental health patients who benefit from mood journaling
- Demographics: Women 30-55, same as Downscale Weight Loss
- Pain points: Hate calorie counting apps, find MyFitnessPal tedious, want something that feels natural

Competitor landscape:
- Noom ($70/mo): Journal feature buried in larger programme, form-based, expensive
- MyFitnessPal (free/premium): Barcode scanning, calorie-focused, not conversational, feels clinical
- Day One ($36/yr): Beautiful generic journal, no health focus, no AI insights
- Reflectly ($60/yr): AI mood journal, no food/health logging, targeted at mental health
- Bearable (free/premium): Symptom + mood tracker, not conversational, form-heavy
- Cara (free): Gut health diary, niche, not weight management
- NONE combine conversational AI + food + mood + medication + exercise in one chat interface

USP: "The health journal that talks back — log everything by just chatting."

Marketing angles:
- "Ditch the calorie counting. Just tell your diary what you ate."
- "Your weight loss companion that actually listens"
- "AI-powered insights from your daily habits"
- "Share your journal with your clinician at your next consult"
- "No forms. No barcodes. Just conversation."
- Cross-sell: "Free for all Downscale Weight Loss patients"

Content pillars:
- Education: Benefits of health journaling, CBT evidence, habit formation
- Features: Demo videos of conversational logging, AI insight examples
- Lifestyle: "A day in the life with Downscale Diary", morning routine integration
- Testimonial-safe: "How journaling supports weight management" (educational, not patient stories)
- Cross-promotion: Paired content with Downscale Weight Loss

Marketing channels:
1. In-app upsell from Downscale Weight Loss (primary acquisition channel)
2. Instagram stories/reels (demo the chat interface, before/after journal entries)
3. TikTok (show how easy it is: "logging my lunch in 5 seconds")
4. Blog SEO: "best health journal app Australia", "food diary app", "weight loss journal"
5. Email: Included in Downscale welcome sequence

Tech stack: Drizzle ORM, conversational AI, natural language food parsing, sentiment analysis
NOT health-regulated — personal wellness tool (documentation aid, not medical device)`,
    tags: ['downscale-diary', 'journal', 'ai', 'conversational', 'wellness', 'context'],
  },

  // ─── NOTREALSMART ─────────────────────────────────────────────────────────
  {
    namespace: 'nrs-notrealsmart-overall',
    key: 'brand-context',
    value: `NotRealSmart is the AI agency platform itself.

Key facts:
- Name meaning: Not(Artificial) Real(Intelligence) Smart
- 13 agents: 1 Director + 12 department heads
- Self-owned orchestration (not a client-service business)
- Built on: Next.js 15.3, React 19, Tailwind CSS 4, Supabase, Vercel AI SDK v6
- Marketing angle: "What if your marketing agency was AI, and you owned it?"
- Target audience: Solo founders, small health businesses, people who can't afford a real agency
- USP: Own your agency, not rent it — all outputs belong to you
- Potential SaaS model: License the platform to other health businesses
- The product IS the marketing for itself (dogfooding)`,
    tags: ['notrealsmart', 'agency', 'platform', 'context'],
  },
]

// ---------------------------------------------------------------------------
// Run the seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding brand memories...\n')

  // First, get a user ID to associate memories with
  // We need a user_id for the memories — get the first user
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1)

  const userId = users?.[0]?.id
  if (!userId) {
    console.error('No users found in the database. Create a user first.')
    process.exit(1)
  }

  console.log(`Using user ID: ${userId}\n`)

  for (const memory of BRAND_MEMORIES) {
    // Upsert: check if exists by namespace + key, update if so
    const { data: existing } = await supabase
      .from('agent_memories')
      .select('id')
      .eq('namespace', memory.namespace)
      .eq('key', memory.key)
      .limit(1)

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('agent_memories')
        .update({
          value: memory.value,
          tags: memory.tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)

      if (error) {
        console.error(`  ✗ [${memory.namespace}] ${memory.key}: ${error.message}`)
      } else {
        console.log(`  ↻ [${memory.namespace}] ${memory.key} (updated)`)
      }
    } else {
      const { error } = await supabase
        .from('agent_memories')
        .insert({
          namespace: memory.namespace,
          key: memory.key,
          value: memory.value,
          tags: memory.tags,
        })

      if (error) {
        console.error(`  ✗ [${memory.namespace}] ${memory.key}: ${error.message}`)
      } else {
        console.log(`  ✓ [${memory.namespace}] ${memory.key}`)
      }
    }
  }

  console.log(`\nDone! ${BRAND_MEMORIES.length} brand memories seeded.`)
}

main().catch(console.error)
