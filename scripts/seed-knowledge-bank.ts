/**
 * Seed script: Inject deep domain knowledge from Claude skills into agent_memories.
 * This creates a comprehensive knowledge bank that agents can reference.
 *
 * Usage: npx tsx scripts/seed-knowledge-bank.ts
 *
 * Sources: np-endorsement-australian, pharmacology-australian-comprehensive,
 *          clinical-documentation-australian, australian-healthcare-coding,
 *          accounting-comprehensive, ai-clinical-scribe-australian
 *
 * Idempotent — upserts by namespace + key.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface KnowledgeEntry {
  namespace: string
  key: string
  value: string
  tags: string[]
}

const KNOWLEDGE: KnowledgeEntry[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLIANCE KNOWLEDGE (All agents need this)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'compliance-ahpra-s133',
    value: `AHPRA Section 133 — Health Practitioner Advertising Rules:

PROHIBITED in ALL marketing for AHPRA-regulated brands:
• Patient testimonials, reviews, or case studies with patient identifiers
• Guaranteed outcomes ("you will lose X kg", "guaranteed results")
• Superlatives without Level I/II evidence ("best", "leading", "most effective")
• Before/after photos without: informed consent, unedited, disclaimers
• Fear-based messaging or pressure tactics
• "Dr" for non-medical practitioners (NPs are NOT doctors)
• Discounts, prizes, or inducements to attract patients
• Comparisons with other practitioners
• Celebrity/public figure endorsements

REQUIRED:
• Accurate practitioner titles matching AHPRA registration
• Risk information for any treatment mentioned
• "Individual results may vary" for outcome-related content
• Health information disclaimers
• Date of content creation/update

AI ACCOUNTABILITY (Sep 2025):
• AHPRA scans websites + social media using AI
• AI-generated content has SAME legal liability as manual
• Practitioner accountable for ALL content including AI-generated
• Recommend: "Content reviewed by [Name], [Registration Type]"

PENALTIES: $60K individual, $120K body corporate per offence`,
    tags: ['compliance', 'ahpra', 's133', 'advertising', 'all-brands'],
  },

  {
    namespace: 'nrs-agency',
    key: 'compliance-tga-advertising',
    value: `TGA Therapeutic Goods Advertising Code — Rules for ALL Agents:

SCHEDULE 4 (Prescription Only) — NEVER name these to consumers:
• Weight loss: semaglutide, tirzepatide, liraglutide, Ozempic, Wegovy, Mounjaro, Saxenda
• Skincare: tretinoin, adapalene, isotretinoin
• All S4 and S8 medications

SAFE LANGUAGE for marketing:
• "Prescription weight loss medications" (not drug names)
• "Clinician-prescribed treatment plans" (not specific drugs)
• "Evidence-based weight management" (not "guaranteed results")
• "Prescription-strength skincare" (not "tretinoin")
• "Medical-grade skincare" (not ingredient names)
• "Weekly injection therapy" (not "semaglutide injection")
• "Medications that work with your body's natural signals"

LANGUAGE SWAP TABLE:
• "Guaranteed results" → "Evidence-based treatment"
• "Lose X kg" → "Work toward your personal weight goals"
• "Best clinic" → "Affordable, accessible care"
• "Our [drug] treatment" → "Our clinician-prescribed treatment"
• "Dr [Name]" for NPs → "NP [Name]" or "Nurse Practitioner [Name]"
• "Cure" → "Manage" or "Support"
• "No side effects" → "Side effects discussed during consultation"`,
    tags: ['compliance', 'tga', 'advertising', 'language', 'all-brands'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEIGHT MANAGEMENT KNOWLEDGE (Downscale Weight Loss)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-glp1-medications',
    value: `GLP-1 Receptor Agonist Knowledge (INTERNAL — never share drug names with consumers):

SEMAGLUTIDE (Ozempic/Wegovy/Rybelsus):
• Mechanism: GLP-1 receptor agonist, weekly SC injection
• Half-life: ~1 week
• Ozempic PBS: T2DM, HbA1c >7%, BMI >35, with metformin (Authority Required)
• Wegovy PBS: BMI ≥30 or ≥27 with comorbidity (Authority Required Streamlined)
• Dose escalation: 0.25mg → 0.5mg → 1mg → 1.7mg → 2.4mg over 16+ weeks
• Weight loss: ~15-17% body weight in trials
• Common SE: nausea (>10%), vomiting, diarrhoea, constipation
• Serious: pancreatitis, gallbladder disease, thyroid C-cell concerns
• Pregnancy Category D — stop ≥2 months before conception

TIRZEPATIDE (Mounjaro/Zepbound):
• Mechanism: Dual GLP-1 + GIP receptor agonist (first in class)
• Weight loss: ~20-26% body weight (greater than semaglutide)
• Mounjaro PBS: T2DM (Authority Required)
• Zepbound: Obesity indication, PBS listing under review
• Dose: 2.5mg → 5mg → 7.5mg → 10mg → 12.5mg → 15mg weekly

KEY INTERACTIONS:
• + Insulin: reduce dose 20-50%
• + Sulfonylurea: reduce dose 50%
• + Oral contraceptive: delayed absorption during escalation

OBESITY ALGORITHM (AU):
1. Lifestyle intervention (3-6 months)
2. First-line: GLP-1 RA (semaglutide 2.4mg preferred)
3. Second-line: naltrexone-bupropion or orlistat (private)
4. Bariatric surgery if BMI ≥40 or ≥35 with comorbidity`,
    tags: ['pharmacology', 'glp1', 'weight-management', 'internal'],
  },

  {
    namespace: 'nrs-agency',
    key: 'knowledge-weight-management-market',
    value: `AU Weight Management Market Intelligence:

MARKET SIZE:
• AU obesity prevalence: ~31% of adults (8.5M people)
• Telehealth market: ~$4.2B (2025), growing 15% YoY
• ~89% used telehealth during COVID, ~45% continue
• GLP-1 market AU: estimated $500M+ (2025), explosive growth

COMPETITOR LANDSCAPE:
• Juniper: $99/mo subscription, GP-led, pharmacy partnership
• Eucalyptus/Pilot: $149/mo, digital-first, large marketing budget
• Rosemary Health: Similar model, growing
• Found (US model entering AU): App-based
• Calibrate (US): Comprehensive programme
• Traditional GPs: Opportunistic prescribing, no structured programme

DOWNSCALE DIFFERENTIATORS:
• $45 consults (vs $99-199 competitors) — most affordable
• NP-led (lower overhead, same prescribing rights)
• 7 Pillars holistic approach (not just medication)
• Podcast for education/trust-building
• Halaxy practice management integration

TARGET AUDIENCE:
• Women 30-55, regional Australia priority
• Time-poor, tried diets before, frustrated with yo-yo
• Looking for medical oversight, not another diet
• Price-sensitive (hence $45 positioning)
• Telehealth-comfortable (post-COVID)

MARKETING CHANNELS (priority order):
1. Google Ads — high-intent search ("weight loss telehealth Australia")
2. Instagram — carousel education, community building
3. TikTok — myth-busting, educational hooks
4. Blog/SEO — content clusters for organic traffic
5. Referral programme — $10 service credit per referral`,
    tags: ['weight-management', 'market-intelligence', 'downscale', 'competitors'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDICARE & BILLING KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-medicare-telehealth',
    value: `Medicare Telehealth Items (for agents creating content about services):

GP TELEHEALTH:
• 91800: <20 min | 91801: ≥20 min | 91802: ≥40 min | 91809: phone ≥20 min
• Audio-visual preferred; phone when video not possible
• Existing patient relationship required

NP TELEHEALTH: Item 92055 (within NP scope of practice)

SPECIALIST TELEHEALTH:
• 92024: Initial referred consultation
• 92025: Subsequent consultation

CHRONIC DISEASE MANAGEMENT:
• Item 721 (GPMP): Structured plan for chronic conditions, once per 12 months
• Item 723 (TCA): Team care arrangement, min 3 providers, once per 12 months
• Item 732: GPMP/TCA review, once per 3 months minimum
• Allied health under TCA: Max 5 sessions/year across ALL disciplines combined
  - 10954: Dietitian | 10953: Exercise physiologist | 10964: Psychologist

MENTAL HEALTH (Better Access):
• Item 2700/2715: Mental Health Treatment Plan (1 per 12 months)
• Up to 10 individual psychological therapy sessions per calendar year
• PHQ-9 and K10 screening tools standard

12-MONTH RULE (telehealth):
• Patients must have in-person visit within 12 months
• 9 exemptions: regional/remote (MMM 4-7), homeless, aged care, <12 months old,
  pregnancy, mental health plan, Aboriginal/TSI, palliative, disaster areas

MARKETING IMPLICATIONS:
• Can mention "Medicare rebates available" or "bulk billing available"
• Cannot guarantee specific rebate amounts (depends on billing method)
• Must not imply all services are bulk-billed unless they are`,
    tags: ['medicare', 'telehealth', 'billing', 'mbs', 'all-brands'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLINICAL DOCUMENTATION KNOWLEDGE (TeleScribe)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-clinical-documentation',
    value: `Clinical Documentation Standards (for TeleScribe marketing):

SOAP NOTE STRUCTURE:
S: PC, HPC (SOCRATES), PMHx, DHx, Allergies, FHx, SHx, ROS
O: Vitals, General appearance, Examination, Investigations
A: Primary Dx (ICD-10-AM), Secondary Dx, Differentials, Problem list
P: Investigations, Medications, Non-pharm, Referrals, Follow-up, Safety netting

KEY DOCUMENT TYPES:
• Consultation notes (SOAP or POMR format)
• Referral letters (GP-to-specialist)
• Discharge summaries
• Care plans (GPMP Item 721, TCA Item 723)
• Mental Health Treatment Plans (Item 2700)
• Prescriptions (PBS with authority numbers)

RACGP DOCUMENTATION STANDARDS:
• Legible, dated, timed, author identified
• Patient identified on every page (name, DOB, MRN)
• Factual, objective, contemporaneous
• Retained minimum 7 years (or age 25 for minors)

TELEHEALTH-SPECIFIC:
• Document modality (video/phone), platform, patient location
• Informed consent for telehealth
• Identity verification method
• Physical examination limitations noted
• In-person follow-up if needed

TELESCRIBE MARKETING ANGLES:
• "Save 1-2 hours/day on documentation"
• "35+ clinician roles supported"
• "Australian English medical vocabulary"
• "SOAP-formatted notes in real time"
• "BYO phone — use your existing number"
• NOT a medical device (documentation tool, no TGA regulation)`,
    tags: ['clinical-documentation', 'telescribe', 'soap', 'racgp'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NP ENDORSEMENT KNOWLEDGE (EndorseMe)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-np-endorsement',
    value: `NP Endorsement Knowledge (for EndorseMe marketing):

CORE REQUIREMENTS:
1. Clean, unrestricted RN registration
2. 5,000 hours advanced practice in past 6 years
3. NMBA-approved Master's (Pathway 1) or equivalent (Pathway 2)
4. Competence against 4 NP Standards for Practice (24 sub-criteria)
5. Professional Indemnity Insurance

4 NP STANDARDS (2021):
1. Assesses Using Diagnostic Capability (6 sub-criteria)
2. Plans Care and Engages Others (6 sub-criteria)
3. Prescribes and Implements Therapeutic Interventions (6 sub-criteria)
4. Supports Health Systems (6 sub-criteria)

PORTFOLIO (7 Appendices):
1. Education docs | 2. Signed CV | 3. Min 2 letters of support (within 3 months)
4. Statements of service | 5. CPD evidence (30 hrs/yr) | 6. Case exemplars (min 2)
7. Competency mapping (Pathway 2 only)

5,000 HOURS CRITICAL RULES:
• Within 6 years before application date
• Master's practicum does NOT count
• Advanced practice level only (not standard RN)
• Can span multiple employers
• Each employer needs Statement of Service

POST-ENDORSEMENT:
• Annual renewal by 31 May
• 450 hours clinical practice in 5 years (recency)
• 30 hours CPD/year (20 general + 10 NP-specific)
• PII maintained continuously
• Random audit: 4 weeks to provide docs

PROCESSING: 4-12 months (highly variable)

ENDORSEME MARKETING (AHPRA-compliant):
• "Track your 5,000 hours with confidence"
• "Portfolio-ready evidence from day one"
• "Map every activity to NMBA Standards"
• "Never miss a CPD hour or deadline"
• Cannot guarantee endorsement outcomes
• Must comply with practitioner advertising rules`,
    tags: ['np-endorsement', 'ahpra', 'nmba', 'endorseme'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SKINCARE/DERMATOLOGY KNOWLEDGE (DownscaleDerm)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-skincare-dermatology',
    value: `Prescription Skincare Knowledge (for DownscaleDerm marketing):

TRETINOIN (internal knowledge — NEVER name in consumer content):
• Schedule 4 (Prescription Only)
• Retinoid — vitamin A derivative
• Indications: acne, photoageing, melasma
• Available as cream/gel 0.01%, 0.025%, 0.05%, 0.1%
• Compounding: custom concentrations via compounding pharmacy
• Side effects: dryness, peeling, sun sensitivity, initial purging
• Pregnancy Category X — STRICTLY contraindicated
• Must use sunscreen SPF 50+ daily

COMPETITOR LANDSCAPE:
• Software (AU): $49/consultation, prescription skincare
• Dermatica (UK model): Customised formula, subscription
• Curology (US): Subscription, custom formula
• Skin+Me (UK): Similar to Dermatica
• Traditional dermatologists: $200-400 consult, long wait times

DOWNSCALEDERM DIFFERENTIATORS:
• $79 initial / $49 follow-up (affordable)
• Compounded tretinoin (custom strength — not available from competitors)
• NP-led (lower overhead)
• Telehealth-first (no waiting rooms)
• Part of Downscale ecosystem (cross-sell with weight loss)

SAFE MARKETING LANGUAGE:
• "Prescription-strength skincare"
• "Medical-grade skincare tailored to your skin"
• "Clinician-prescribed, pharmacy-compounded"
• "Evidence-based approach to skin health"
• "Custom-strength formulations"
• NEVER: tretinoin, adapalene, retinoid names, "cure acne", "anti-ageing cream"

TARGET AUDIENCE:
• Women 25-45
• Interested in anti-ageing, acne management
• Tried OTC products without results
• Looking for prescription-strength without the dermatologist cost
• Telehealth-comfortable`,
    tags: ['skincare', 'dermatology', 'downscalederm', 'tga'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRAGRANCE INDUSTRY KNOWLEDGE (ScentSwap)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-fragrance-industry',
    value: `Fragrance Industry Deep Knowledge (for ScentSwap marketing):

MARKET OVERVIEW:
• Global fragrance market: ~$50B (2025), growing ~5% YoY
• AU fragrance market: ~$1.5B, premium segment growing fastest
• Niche fragrance segment: 15-20% YoY growth globally
• "Fragrance graveyard" problem: avg collector owns 20-50 bottles, actively wears 5-10
• Decant market booming: 5-10mL samples for $15-40 (try before full bottle)
• Gender-fluid fragrances: fastest-growing category, "unisex" now mainstream

FRAGRANCE FAMILIES (Agents must know for content):
• Floral: Rose, jasmine, tuberose, lily — classic feminine (Chanel No. 5, Miss Dior)
• Oriental/Amber: Vanilla, amber, incense, oud — warm, rich (Tom Ford Tobacco Vanille)
• Woody: Sandalwood, cedar, vetiver, patchouli — earthy (Terre d'Hermès)
• Fresh: Citrus, aquatic, green — clean, light (Acqua di Gio, Light Blue)
• Fougère: Lavender, coumarin, oakmoss — barbershop classic (Dior Sauvage base)
• Chypre: Bergamot, oakmoss, labdanum — sophisticated (Mitsouko)
• Gourmand: Chocolate, caramel, coffee, praline — sweet, edible (Angel by Mugler)
• Leather: Suede, birch tar, castoreum — rugged (Tuscan Leather)
• Oud: Middle Eastern influence, animalic, woody — luxury niche (Oud Wood, Baccarat Rouge)

NOTE STRUCTURE (content writers need this):
• Top notes (0-30 min): First impression — citrus, herbs, light fruits. Volatilise first.
• Heart/Middle notes (30 min - 4h): Character — floral, spice, fruit. The "personality."
• Base notes (4h+): Foundation — woods, amber, musk, vanilla. Longevity and depth.
• Sillage: How far the fragrance projects from the wearer (trail)
• Longevity: How long it lasts on skin (2-4h = poor, 6-8h = good, 10h+ = beast mode)
• Projection: How strongly it radiates around the wearer

PRICING TIERS:
• Drugstore/Mass: $20-60 (Nautica, Jovan, celebrity fragrances)
• Designer: $80-250 (Dior, Chanel, YSL, Versace, Prada)
• Premium Designer: $200-400 (Tom Ford, Armani Privé, Guerlain L'Art & La Matière)
• Niche: $200-600+ (MFK, Byredo, Le Labo, Creed, Parfums de Marly)
• Ultra-niche: $400-1500+ (Roja, Xerjoff, Amouage Attars, Clive Christian)
• Bespoke: $2000+ (custom-made, appointment only)

AU-SPECIFIC FRAGRANCE MARKET:
• Chemist Warehouse: largest volume seller (designer discounts)
• Myer/David Jones: premium counter experience
• Sephora AU: growing niche selection
• Lore Perfumery (Melbourne): indie niche specialist
• Peony Melbourne: curated niche boutique
• City Perfume: online discounter
• AU import costs: fragrances $20-50 more than US/EU due to GST + shipping
• Fragrance swap culture: strong in AU due to high retail prices

NICHE vs DESIGNER (for content):
• Designer: Mass-produced, wide distribution, heavy advertising, recognisable names
  - Pros: Accessible, well-tested formulas, easy to blind buy
  - Cons: Reformulations, common/overused, synthetic shortcuts
• Niche: Small-batch, specialty retailers, ingredient-focused, artistic vision
  - Pros: Unique, higher quality ingredients, conversation starters
  - Cons: Expensive, hard to sample, variable quality
• ScentSwap levels the playing field — try niche without the full-bottle commitment

BARTER ECONOMICS (ScentSwap core):
• AI fairness engine considers: retail price, rarity, fill level, condition, market demand
• Fair trade value ≠ retail price (a 90% full Tom Ford > a sealed Nautica)
• Rarity multiplier: discontinued fragrances, limited editions, regional exclusives
• Condition grading: sealed > 95%+ > 75-95% > 50-75% (below 50% = sample only)
• No cash changes hands — pure barter eliminates pricing disputes
• Community trust: ratings, verified swaps, dispute resolution

COMMUNITY PLATFORMS & MARKETING:
• Fragrantica: 100K+ fragrances, reviews, forums, note breakdowns — essential reference
• Basenotes: Older, serious collectors, in-depth reviews, SOTD (Scent of the Day) threads
• Reddit r/fragrance: 500K+ members, SOTD threads, recommendation requests, reviews
• Reddit r/fragranceswap: Active trading (ScentSwap's direct competition but unstructured)
• Facebook: "Fragrance Swap Australia", "Niche Fragrance Enthusiasts AU"
• TikTok #perfumetok: 8B+ views, unboxing, collection tours, "blind buy or not" format
• YouTube: Jeremy Fragrance (6M), Demi Rawling (AU), Chaos Fragrances, Curly Scents
• Instagram: flat-lays, #SOTD, collection grids, #FragComm

CONTENT STRATEGY FOR SCENTSWAP:
• Educational: "Fragrance families explained", "How to read fragrance notes"
• Community: "Collection of the week", swap success stories, "What's in your graveyard?"
• Seasonal: "Best summer fragrances AU", "Winter warmers", "Date night picks"
• Trending: React to new releases, reformulation drama, TikTok viral fragrances
• Comparison: "Dupe vs original", "Is [niche] worth the price?", "Clone battles"
• Platform-specific: TikTok = short discovery, Instagram = visual, Reddit = discussion, YouTube = reviews

TARGET AUDIENCE:
• Primary: Fragrance enthusiasts with "graveyards" (25-45, 60% F / 40% M)
• Secondary: Budget-conscious wanting to try niche (18-30, students/young professionals)
• Tertiary: Gift buyers looking for unique options
• Pain points: High prices, can't sample before buying, wasted bottles, FOMO on niche
• Motivation: Discovery, variety, community, sustainability (reduce waste)

NOT regulated (lifestyle/consumer product, no TGA/AHPRA concerns).
GST applies to any future monetisation (10% on AU transactions).`,
    tags: ['fragrance', 'scentswap', 'barter', 'community', 'niche', 'perfume'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING/BUSINESS KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-au-business-finance',
    value: `Australian Business & Finance Knowledge:

BAS/GST:
• GST rate: 10% on taxable supplies
• BAS lodged quarterly (or monthly for >$20M turnover)
• Health services are GST-free (telehealth consults, prescribing services)
• SaaS subscriptions are taxable (TeleScribe, TeleCheck, EndorseMe)
• Physical goods (fragrance) are taxable
• ABN required for all business activities

HEALTH SERVICE GST EXEMPTIONS:
• Medical, dental, nursing, and allied health services: GST-free
• Prescriptions: GST-free
• Health insurance: GST-free (input-taxed)
• SaaS tools for clinicians: NOT exempt (taxable at 10%)

PRICING STRATEGY (Health Telehealth):
• Bulk billing: Medicare rebate = full payment (patient pays $0)
• Gap billing: Medicare rebate + patient gap
• Private billing: Patient pays full fee, claims rebate
• Subscription model: Monthly fee for ongoing management
• Downscale model: $45 per consult (low gap after Medicare)

XERO INTEGRATION:
• Invoice management for consult fees
• Bank reconciliation for Medicare rebates
• BAS preparation and lodgement
• Expense tracking for business costs

KEY FINANCIAL METRICS FOR HEALTH STARTUPS:
• CAC (Customer Acquisition Cost): Target <$50 for telehealth
• LTV (Lifetime Value): Avg 6-12 months of consults
• Churn rate: Target <5% monthly for subscription models
• Gross margin: 60-80% for telehealth services
• Break-even: Typically 200-500 active patients per NP`,
    tags: ['finance', 'gst', 'bas', 'pricing', 'xero'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CLINICAL SCRIBE KNOWLEDGE (TeleScribe)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-ai-clinical-scribe',
    value: `AI Clinical Scribe Technology (for TeleScribe marketing):

TELESCRIBE 4-LAYER ASR PIPELINE:
1. Vonage — BYO phone integration (practitioners use existing number)
2. Whisper — OpenAI speech-to-text (medical vocabulary tuned)
3. Medical NLP — Entity extraction (conditions, medications, dosages)
4. SOAP formatting — Structured clinical note generation

COMPETITOR LANDSCAPE:
• Heidi Health (AU): $99/mo, browser-based, popular
• Lyrebird Health (AU): Growing, similar features
• Nabla (US/EU): Ambient scribe, enterprise focus
• Suki AI (US): Voice-first, EHR integration
• Dragon Medical (Nuance): Legacy dictation, expensive

TELESCRIBE DIFFERENTIATORS:
• $69/mo (most affordable AU scribe)
• BYO phone (Vonage integration — no app or browser needed)
• 35+ clinician roles (GP, NP, psychiatrist, physio, etc.)
• Australian English medical vocabulary
• SOAP-formatted output
• NOT a medical device (documentation tool)

KEY SELLING POINTS FOR MARKETING:
• "Save 1-2 hours/day on documentation"
• "Use your own phone — no new hardware"
• "35+ clinical roles, one subscription"
• "Australian English, Australian medical vocabulary"
• "SOAP notes in real time during your consult"
• "$69/mo — less than the cost of 1 missed consult"

TARGET AUDIENCE:
• Time-poor GPs doing 30+ consults/day
• NPs in telehealth (documentation burden is high)
• Allied health practitioners
• Practice managers looking to improve clinician efficiency
• Rural/regional practitioners with limited admin support

MARKETING CHANNELS:
• LinkedIn (clinician thought leadership)
• Medical conferences (RACGP, ACNP)
• Direct email to practice managers
• GP newsletters and publications
• Partnerships with PMS providers (Halaxy, Best Practice, Medical Director)`,
    tags: ['telescribe', 'scribe', 'asr', 'documentation', 'technology'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING & BUSINESS FINANCE (from accounting-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-au-accounting-deep',
    value: `Deep Australian Accounting Knowledge:

BAS/GST COMPLIANCE:
• GST rate: 10% on taxable supplies
• Health services: GST-FREE (telehealth consults, prescribing, allied health)
• SaaS subscriptions: TAXABLE (TeleScribe $69/mo, TeleCheck $14.95/mo, EndorseMe)
• Fragrance products: TAXABLE (ScentSwap barter platform)
• BAS quarterly: due 28th of month after quarter end
• BAS monthly: due 21st of following month (turnover ≥$20M)
• GST calculation: inclusive to amount = ÷11, exclusive to inclusive = ×1.1

PAYROLL (FY2025-26):
• Super guarantee: 12.0% of OTE (ordinary time earnings)
• Tax-free threshold: $18,200
• Tax brackets: $0-18,200 (0%), 18,201-45,000 (16%), 45,001-135,000 (30%), 135,001-190,000 (37%), 190,001+ (45%)
• STP Phase 2 reporting mandatory
• Super due dates: quarterly (28th after quarter end)

HEALTH BUSINESS FINANCIAL METRICS:
• Revenue per practitioner: benchmark against peers
• Consult margin target: 60%+ for telehealth
• CAC target: <$50 for telehealth
• LTV:CAC ratio: should be >3:1
• Cash runway: maintain ≥2 months
• Payback period: <12 months

KEY ATO DEADLINES:
• BAS quarterly: 28th after quarter
• PAYG summary (STP): 14 July
• Company tax return: 28 Feb (tax agent: 15 May)
• Super guarantee: 28th after quarter
• FBT return: 21 May
• Company tax rate: 25% (base rate entity <$50M turnover)

XERO INTEGRATION:
• Custom connection via client_credentials grant
• Key endpoints: Trial Balance, P&L, Balance Sheet, Invoices, Contacts
• Clearing account pattern for Halaxy payment reconciliation
• Batch operations: 100 invoices/batch, 25 voids/batch, 1.5s delay`,
    tags: ['accounting', 'gst', 'bas', 'payroll', 'xero', 'ato'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI CLINICAL SCRIBE DEEP KNOWLEDGE (from ai-clinical-scribe-australian skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-ai-scribe-deep',
    value: `AI Clinical Scribe Deep Knowledge (for TeleScribe marketing):

ARCHITECTURE (Telescribe 4-layer pipeline):
1. Audio capture: 16kHz mono, WebM/Opus, 30s segments
2. Whisper ASR: OpenAI API, medical vocabulary, hallucination filtering
3. Medical NLP: Entity extraction (conditions, medications, dosages)
4. SOAP generation: Claude Sonnet, 14-subsection AU SOAP format

TGA CLASSIFICATION:
• Documentation aid = NOT a medical device (no ARTG registration)
• MUST NOT generate diagnoses or treatment recommendations
• MUST NOT provide clinical decision support beyond what clinician stated
• Mark ambiguous content with [unclear] markers
• "Draft documentation only" disclaimer on all outputs
• TGA enforcement actions announced for 2025-2026

PRIVACY REQUIREMENTS:
• Audio NEVER persisted to disk (in-memory only, discarded after transcription)
• Cross-border disclosure (APP 8): Whisper API = US, Claude API = US
• Patient consent REQUIRED in 5/8 jurisdictions (criminal offence without it)
• All-party consent states: NSW, ACT, SA, TAS, WA
• One-party consent states: QLD, VIC, NT

RACGP/AVANT GUIDANCE:
• AI scribes reduce admin burden but cannot replace clinical judgement
• Notes are DRAFTS — clinician must review before finalisation
• 57% increase in AI scribe usage (Avant Feb 2025)
• Consent must be obtained EVERY consultation
• Practitioner ultimately responsible for all AI-generated content
• Records should be labelled as AI-involved

AU COMPETITOR LANDSCAPE:
• Lyrebird Health: 4,500+ GPs, EMR integration, on-device processing
• Heidi Health: 50,000+ clinicians, $6.6M investment, workflow automation
• mAIscribe: MBS billing optimisation (15-20% billing uplift reported)
• Coviu Assist: Built into Coviu telehealth platform

TELESCRIBE DIFFERENTIATORS:
• $69/mo (most affordable AU scribe)
• BYO phone via Vonage (no app/browser needed)
• 35+ clinician roles
• Telehealth-first (MBS compliance blocks in notes)
• Australian data sovereignty (Supabase AU region)
• NOT a medical device (documentation aid classification)`,
    tags: ['telescribe', 'scribe', 'asr', 'tga', 'privacy', 'racgp'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TELECHECK KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // VONAGE/COMMUNICATIONS KNOWLEDGE (from vonage-sdk-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIN ANALYSIS / DERMATOLOGY (from facial-scanner-dermatology skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-skin-analysis-deep',
    value: `Skin Analysis & Dermatology Deep Knowledge (for DownscaleDerm):

FITZPATRICK SKIN TYPES:
• Type I: Very fair, always burns, never tans (Celtic ancestry)
• Type II: Fair, burns easily, tans minimally (Northern European)
• Type III: Medium, sometimes burns, tans gradually (Southern European)
• Type IV: Olive, rarely burns, tans easily (Mediterranean, Asian)
• Type V: Brown, very rarely burns, tans very easily (Middle Eastern, South Asian)
• Type VI: Dark brown/black, never burns (African ancestry)
Marketing: NEVER assume skin type. Always personalised assessment by clinician.

KEY SKIN CONCERNS (for marketing content):
• Acne: Hormonal, cystic, comedonal — "evidence-based acne management"
• Ageing: Fine lines, wrinkles, loss of elasticity — "age management" not "anti-ageing"
• Pigmentation: Melasma, sun spots, post-inflammatory — "skin tone evenness"
• Rosacea: Redness, sensitivity, flushing — "redness management"
• Texture: Roughness, enlarged pores, uneven surface — "skin texture improvement"
• Sun damage: Photodamage, solar keratoses — "sun damage assessment"

SKIN QUALITY METRICS (from scanner):
7 analysis channels: redness, oiliness, texture, pores, pigmentation, blemishes, wrinkles
All use classical CV (no ML classification) — TGA-safe as progress tracker
CRITICAL: Pigmentation measures UNEVENNESS not absolute darkness (bias-corrected)

TGA COMPLIANCE FOR SKIN TOOLS:
• Progress tracker = NOT a medical device
• SAFE: "Your redness score decreased from 45 to 32"
• UNSAFE: "53% probability of rosacea" (diagnosis = medical device)
• NEVER classify diseases, name conditions, or suggest diagnoses
• Can track numeric metrics over time
• Can compare before/after with objective measurements

DOWNSCALEDERM MARKETING ANGLES:
• "See your skin improve with prescription-strength care"
• "Track your progress with clinical skin analysis"
• "Custom-compounded formulations for your skin type"
• "Evidence-based skincare — not guesswork"
• "Fitzpatrick skin typing for personalised treatment"
• NEVER name ingredients (tretinoin, adapalene) in consumer content
• NEVER promise to "cure" any skin condition
• Can show progress metrics (texture improved X%, redness decreased X%)

SKIN ANALYSIS IN CONSULTS:
• 9 facial zones: forehead, left/right cheek, nose, chin, under-eyes, crow's feet, nasolabial, jawline
• Multi-angle capture: frontal + right 30° + left 30°
• Quality gates: face detection, lighting, sharpness, landmark coverage
• Goal-weighted scoring: patients select tracking goals (e.g. texture, tone evenness)`,
    tags: ['skincare', 'dermatology', 'downscalederm', 'fitzpatrick', 'skin-analysis'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VONAGE/COMMUNICATIONS KNOWLEDGE (from vonage-sdk-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-vonage-communications',
    value: `Vonage Communications Knowledge (for TeleScribe + clinic automation):

TELESCRIBE BYO PHONE ARCHITECTURE:
• Vonage Voice API with NCCO (call control JSON)
• Client SDK loaded via CDN in browser (WebRTC)
• Answer webhook returns NCCO → connects calls
• Event webhook tracks call status/duration/cost
• JWT auth for client sessions (RS256, 4hr TTL)
• AU region: apac-australia (routes through Sydney)
• Current number: 61370466777 (AU landline, linked to TeleScribe app)

VOICE CAPABILITIES:
• Inbound/outbound PSTN calls via browser
• WebSocket audio streaming (16kHz PCM → Whisper ASR)
• Call recording with transcription
• TTS in en-AU (text-to-speech for IVR)
• DTMF input collection
• Conference/conversation rooms
• Advanced machine detection (voicemail)

MESSAGING CAPABILITIES:
• SMS: appointment reminders, booking confirmations
• WhatsApp: patient follow-up, prescription ready notifications
• Verify2: 2FA for patient portal login
• Multi-channel fallback: SMS → WhatsApp → Voice

TELEHEALTH AUTOMATION WORKFLOWS:
1. Appointment reminder: SMS 24h before + SMS 1h before
2. Post-consult follow-up: WhatsApp 2h after with summary link
3. Prescription ready: SMS notification with pharmacy details
4. Booking confirmation: SMS immediately after online booking
5. No-show follow-up: SMS 30min after missed appointment
6. Patient portal login: Verify2 (SMS code → WhatsApp fallback)

MARKETING ANGLES FOR TELESCRIBE:
• "BYO phone — use your existing number"
• "No app to install — works in your browser"
• "Automatic appointment reminders via SMS"
• "Secure patient communications"
• "Australian phone number, Australian servers"

PRICING CONTEXT:
• AU SMS: ~$0.07/message
• AU voice: ~$0.05/min (inbound), ~$0.12/min (outbound)
• WhatsApp: ~$0.05-0.10/message
• Balance management via Vonage API`,
    tags: ['vonage', 'communications', 'telescribe', 'sms', 'voice'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TELECHECK KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // AU HEALTHCARE INTEGRATIONS (from australian-healthcare-integrations skill)
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDICAL TERMINOLOGY (from medical-terminology-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // PATHOLOGY KNOWLEDGE (from pathology-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH JOURNALING & WELLNESS APPS (for Downscale Diary)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-health-journaling',
    value: `Health Journaling & Wellness App Knowledge (for Downscale Diary marketing):

EVIDENCE BASE FOR HEALTH JOURNALING:
• Self-monitoring is the #1 predictor of successful weight management (Burke et al., 2011)
• CBT-based journaling reduces emotional eating by 40-60% (meta-analysis)
• Food logging increases weight loss by 2x compared to no logging (Kaiser Permanente study)
• Mood-food connection tracking helps identify emotional eating triggers
• "Implementation intention" journaling (if-then plans) improves adherence by 30%
• Gratitude journaling improves sleep quality and reduces stress hormones

WHY CONVERSATIONAL UI BEATS FORMS:
• 78% abandon rate for traditional health trackers within 2 weeks
• Natural language reduces cognitive load — "Had a salad for lunch" vs picking from 1000 items
• Chat feels personal and low-pressure vs clinical data entry
• AI can ask follow-up questions: "How did that make you feel?" "Did you take your meds?"
• Emoji reactions for mood are faster than Likert scales
• Voice notes for people who hate typing

HEALTH APP MARKET (AU):
• AU digital health market: ~$5B (2025), wellness apps growing 20% YoY
• 65% of Australians have used a health app
• Average health app retention: 25% at 30 days, 10% at 90 days
• Key to retention: reduce friction, provide value quickly, build habit loops
• Notification strategy: gentle nudges, not nagging (opt-in, customisable timing)

COMPETITOR ANALYSIS:
• Noom ($70/mo): Behaviour change programme + coaching, journal is secondary, expensive
• MyFitnessPal (free/$80/yr): Calorie database, barcode scanning, feels clinical and tedious
• Day One ($36/yr): Beautiful UI, generic journal, no health features, no AI
• Reflectly ($60/yr): AI mood journal, nice design, no health/food tracking
• Bearable (free/$40/yr): Comprehensive symptom/mood tracker, form-heavy, overwhelming
• Cara (free): Gut health focused, niche, FODMAP diary
• Finch ($50/yr): Gamified self-care, virtual pet, Gen Z focused
• Daylio (free/$30/yr): Mood + activity tracker, icon-based, no AI

DIFFERENTIATORS FOR DOWNSCALE DIARY:
1. Conversational AI (none of the above have true chat-based logging)
2. Integrated with Downscale Weight Loss (clinician can see journal summaries)
3. Covers food + mood + medication + sleep + exercise in ONE chat
4. AI pattern recognition ("You snack more on days you skip breakfast")
5. Australian-focused (AU food database, AU English, metric units)
6. Free for Downscale patients (primary acquisition = cross-sell)

RETENTION STRATEGIES:
• Streak tracking (7-day, 30-day milestones)
• Weekly AI insights email ("Your week in review")
• Clinician sharing (accountability without surveillance)
• Progress photos with comparison slider
• Goal-linked prompts ("You're 3kg from your first milestone!")
• Morning/evening prompt customisation
• Widget for quick logging without opening app

PRIVACY & COMPLIANCE:
• NOT a medical device (personal wellness tool) — no TGA regulation
• Privacy Act 1988 applies — health information = sensitive information
• Data minimisation: only collect what's needed
• Encryption at rest and in transit
• No selling data to third parties
• Patient can export or delete all data
• If sharing with clinician: explicit opt-in consent required
• OAIC NDB scheme applies if data breach occurs

MARKETING SAFE LANGUAGE:
• "Track your journey" (not "monitor your health")
• "Discover patterns in your habits" (not "diagnose your eating disorder")
• "Share insights with your clinician" (not "replace your clinician")
• "Personal wellness companion" (not "health monitoring device")
• "AI-powered insights" (not "AI diagnosis" or "AI medical advice")`,
    tags: ['journaling', 'wellness', 'downscale-diary', 'conversational-ai', 'retention'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATHOLOGY KNOWLEDGE (from pathology-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-pathology-blood-tests',
    value: `Pathology & Blood Tests for Health Marketing:

WEIGHT MANAGEMENT BASELINE PANEL (what clinicians order):
• FBC (Full Blood Count) — checks red cells, white cells, platelets
  Patient-friendly: "A blood test to check your overall blood health"
• UEC (Urea, Electrolytes, Creatinine) — kidney function
  Patient-friendly: "A test to check how well your kidneys are working"
• LFTs (Liver Function Tests) — liver health, NAFLD screening
  Patient-friendly: "A test to check your liver health"
• HbA1c — long-term blood sugar control (3-month average)
  Patient-friendly: "A test that shows your average blood sugar over 3 months"
  Normal: <6.0% (42 mmol/mol) | Diabetes: ≥6.5% (48 mmol/mol)
• Fasting glucose — current blood sugar
  Patient-friendly: "A morning blood sugar test taken before eating"
  Normal: 3.5-5.5 mmol/L | Diabetes: ≥7.0 mmol/L
• Lipid profile — cholesterol and triglycerides
  Patient-friendly: "A test to check your cholesterol levels and heart health"
  Target LDL: <3.5 mmol/L (general), <1.8 mmol/L (high risk)
• TFTs (Thyroid Function Tests) — thyroid health
  Patient-friendly: "A test to check your thyroid is working normally"
  Note: TSH often mildly elevated in obesity — usually normalises with weight loss
• Iron studies — iron levels and stores
  Patient-friendly: "A test to check your iron levels and energy"
  Ferritin often elevated in obesity (inflammation) — doesn't mean iron overload
• Vitamin D — bone health and immune function
  Patient-friendly: "A test to check your vitamin D levels"

GLP-1 RA MONITORING:
• 3-monthly: weight, BMI, waist, HbA1c (if diabetic), fasting glucose, BP
• 6-monthly: FBC, UEC, LFTs, lipids
• Annual: full baseline repeat + vitamin B12 (if on metformin)
• Alert tests: lipase/amylase if abdominal pain (pancreatitis), LFTs if persistent nausea

NAFLD SCREENING (important for obesity marketing):
• FIB-4 score = (Age × AST) / (Platelets × √ALT)
• <1.3: low risk | 1.3-2.67: indeterminate | >2.67: specialist referral
• Patient-friendly: "A calculation from your blood test results that checks liver scarring risk"

MARKETING RULES FOR PATHOLOGY:
• CAN say: "We'll run a comprehensive blood test panel as part of your assessment"
• CAN say: "Regular monitoring is included in your treatment plan"
• CAN say: "Your clinician will review your results and adjust your plan"
• CANNOT: interpret specific results in marketing content
• CANNOT: promise specific test outcomes
• CANNOT: provide reference ranges as medical advice
• ALWAYS: "Discuss your results with your treating clinician"

AUSTRALIAN CONVENTIONS:
• SI units always: mmol/L (not mg/dL), g/L, umol/L
• HbA1c: report both % and mmol/mol
• Date: DD/MM/YYYY
• Australian English: haemoglobin, haematocrit, oestradiol, faeces`,
    tags: ['pathology', 'blood-tests', 'monitoring', 'weight-management', 'all-brands'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDICAL TERMINOLOGY (from medical-terminology-comprehensive skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-medical-terminology',
    value: `Medical Terminology for Marketing Agents:

JARGON → PATIENT-FRIENDLY TRANSLATIONS:
• Obesity → "weight management" or "healthy weight goals"
• Comorbidity → "related health condition"
• Pharmacotherapy → "prescription medication"
• BMI → "body mass index" (explain: weight relative to height)
• HbA1c → "long-term blood sugar levels" or "diabetes control marker"
• Telehealth → "video or phone consultation with your clinician"
• Bulk billing → "no out-of-pocket cost (Medicare covers the full fee)"
• Gap payment → "the difference between the clinic fee and Medicare rebate"
• PBS → "government-subsidised medication"
• Subcutaneous injection → "a small injection just under the skin"
• Dose escalation → "gradually increasing your medication dose"
• Side effects → "possible effects of medication" (never "no side effects")
• Evidence-based → "supported by clinical research"

COMMON CLINICAL ABBREVIATIONS (for content writers):
• GP: General Practitioner | NP: Nurse Practitioner
• ED: Emergency Department | OPD: Outpatient Department
• T2DM: Type 2 Diabetes | HTN: Hypertension (high blood pressure)
• BMI: Body Mass Index | BP: Blood Pressure | HR: Heart Rate
• OSA: Obstructive Sleep Apnoea | PCOS: Polycystic Ovary Syndrome
• GORD: Gastro-Oesophageal Reflux | NAFLD: Fatty Liver Disease
• FBC: Full Blood Count | LFTs: Liver Function Tests
• TFTs: Thyroid Function Tests | UEC: Kidney Function Tests
• PHQ-9: Depression screening (0-27 score)
• K10: Psychological distress (10-50 score)

BODY SYSTEMS (for educational content):
• Cardiovascular: heart + blood vessels (HTN, cholesterol, heart disease)
• Endocrine: hormones (diabetes, thyroid, PCOS, weight regulation)
• Gastrointestinal: digestive system (GORD, NAFLD, IBS)
• Musculoskeletal: bones + joints + muscles (OA, back pain)
• Respiratory: lungs + breathing (OSA, asthma, COPD)
• Integumentary: skin (acne, ageing, pigmentation, eczema)
• Nervous: brain + nerves (depression, anxiety, migraines)
• Renal: kidneys (CKD, kidney stones)

OBESITY-RELATED CONDITIONS (for content about comprehensive approach):
• Insulin resistance → "your body doesn't respond as well to insulin"
• Metabolic syndrome → "a cluster of conditions that increase health risks"
• Satiety → "feeling of fullness after eating"
• GLP-1 → "a natural hormone that helps regulate appetite" (NEVER name drugs)
• Incretin effect → "gut hormones that help control blood sugar and appetite"
• Steatosis → "fat buildup in the liver"

AUSTRALIAN ENGLISH CLINICAL CONVENTIONS:
• Haemoglobin (not hemoglobin), oestrogen (not estrogen)
• Oedema (not edema), anaemia (not anemia)
• Diarrhoea (not diarrhea), paediatric (not pediatric)
• Appendicectomy (not appendectomy)
• Adrenaline (not epinephrine), frusemide (not furosemide)
• Salbutamol (not albuterol), paracetamol (not acetaminophen)
• Temperature in °C, weight in kg, height in cm
• Date: DD/MM/YYYY (not MM/DD/YYYY)`,
    tags: ['medical-terminology', 'patient-language', 'abbreviations', 'all-brands'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AU HEALTHCARE INTEGRATIONS (from australian-healthcare-integrations skill)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-au-health-integrations',
    value: `Australian Healthcare Integration Landscape (for marketing all health brands):

KEY SYSTEMS HEALTH PLATFORMS INTEGRATE WITH:
• Medicare claiming: Claiming.com.au (REST API) or Tyro Health (SDK)
• ePrescribing: Parchment (iFrame/API) — handles eRx + MIMS + RTPM
• Health Identifiers: IHI (patient), HPI-I (provider), HPI-O (organisation)
• My Health Record: ADHA B2B Gateway — Shared Health Summaries, Event Summaries
• Private health: Tyro Health HealthPoint (99%+ AU PHI funds)
• Drug database: MIMS FastTrack API
• Practice management: Halaxy (OAuth2 + FHIR API), Best Practice, Medical Director

MEDICARE CLAIMING OPTIONS:
1. Claiming.com.au — REST API, handles PRODA compliance, most PMS vendors use this
2. Tyro Health — SDK-based, also does private health + DVA + workers comp
3. Direct (Services Australia) — own NOI, conformance testing, PRODA integration

EPRESCRIBING:
• Parchment is the recommended integration partner
• Handles eRx Script Exchange + MIMS drug database + RTPM monitoring
• iFrame embed (~2 weeks integration) or full Enterprise API
• All prescriptions delivered via Active Script List (ASL)

HALAXY (Justin's current PMS):
• OAuth2 client_credentials authentication (50-minute token cache)
• FHIR API for invoices, payments, Braintree card payments, Medicare payments
• Used for booking management + clearing account reconciliation
• Dashboard at /admin/halaxy

MARKETING IMPLICATIONS:
• Can mention: "Integrated with Medicare", "ePrescribing enabled", "Halaxy compatible"
• Can mention: "PBS-subsidised treatments available for eligible patients"
• Cannot guarantee specific rebate amounts or billing outcomes
• Telehealth compliance (12-month rule + 9 exemptions) is TeleCheck's value prop

IMPLEMENTATION ORDER FOR NEW HEALTH PLATFORMS:
1. Core PMS (patients, appointments, notes, invoices)
2. Medicare billing (Claiming.com.au or Tyro Health)
3. ePrescribing (Parchment)
4. Health identifiers (IHI/HPI-I via ADHA)
5. Pathology/radiology requesting (PDF forms → FHIR eRequesting)
6. My Health Record (conformance assessment required)`,
    tags: ['integrations', 'medicare', 'eprescribing', 'halaxy', 'health-tech'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TELECHECK KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    namespace: 'nrs-agency',
    key: 'knowledge-telecheck-medicare-compliance',
    value: `TeleCheck Medicare Compliance Knowledge:

THE 12-MONTH RULE:
Medicare telehealth requires patients to have had an in-person visit with the
same practice within the past 12 months. Failure = ineligible for Medicare rebate.

9 EXEMPTION CATEGORIES:
1. Regional/remote (MMM 4-7 areas)
2. Homeless or at risk of homelessness
3. Residential aged care
4. Under 12 months old
5. Pregnancy-related services
6. Mental Health Treatment Plan services
7. Aboriginal and Torres Strait Islander peoples
8. Palliative/end-of-life care
9. Disaster-declared areas (temporary)

COMPLIANCE RISKS:
• PSR (Professional Services Review) investigates inappropriate claiming
• Triggers: statistical outlier, complaints, referrals
• Consequences: repayment, counselling, disqualification
• Common issues: claiming telehealth without 12-month visit, excessive Level C/D

TELECHECK VALUE PROPOSITION:
• Only automated Medicare telehealth compliance checker in AU
• Checks each consultation against 12-month rule + exemptions
• Flags at-risk claims before they're submitted
• Practice-wide compliance dashboard
• Audit trail for PSR defence

PRICING:
• $14.95/month individual clinician
• $299/month clinic-wide (unlimited clinicians)

TARGET AUDIENCE:
• Telehealth-heavy practices (post-COVID expansion)
• Practice managers worried about Medicare audits
• Solo GPs doing telehealth from home
• Corporate telehealth providers (scalability)

COMPETITORS: None direct — most practices use manual checking or nothing`,
    tags: ['telecheck', 'medicare', 'compliance', '12-month-rule'],
  },
]

// ---------------------------------------------------------------------------
// Run the seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding knowledge bank into agent_memories...\n')

  let created = 0
  let updated = 0
  let errors = 0

  for (const entry of KNOWLEDGE) {
    const { data: existing } = await supabase
      .from('agent_memories')
      .select('id')
      .eq('namespace', entry.namespace)
      .eq('key', entry.key)
      .limit(1)

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('agent_memories')
        .update({
          value: entry.value,
          tags: entry.tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)

      if (error) {
        console.error(`  ✗ [${entry.namespace}] ${entry.key}: ${error.message}`)
        errors++
      } else {
        console.log(`  ↻ [${entry.namespace}] ${entry.key} (updated)`)
        updated++
      }
    } else {
      const { error } = await supabase
        .from('agent_memories')
        .insert({
          namespace: entry.namespace,
          key: entry.key,
          value: entry.value,
          tags: entry.tags,
        })

      if (error) {
        console.error(`  ✗ [${entry.namespace}] ${entry.key}: ${error.message}`)
        errors++
      } else {
        console.log(`  ✓ [${entry.namespace}] ${entry.key}`)
        created++
      }
    }
  }

  console.log(`\nDone! ${created} created, ${updated} updated, ${errors} errors.`)
  console.log(`Total knowledge entries: ${KNOWLEDGE.length}`)
}

main().catch(console.error)
