/**
 * Australian Health Marketing Intelligence — 2025/2026
 *
 * This knowledge is injected into relevant agent system prompts
 * so they produce marketing that reflects current regulations,
 * platform costs, and channel strategies.
 *
 * Last updated: 2026-03-25
 * Sources: 113 verified references (AHPRA, TGA, platform data, industry reports)
 */

export const AU_HEALTH_MARKETING_KNOWLEDGE = `
## Australian Health Marketing Intelligence (2025–2026)

### REGULATORY LANDSCAPE — NON-NEGOTIABLE

**AHPRA — Health Practitioner Regulation National Law Act 2009:**
- Section 133: offence to advertise a regulated health service in a way that is false, misleading, or creates unreasonable expectations
- Section 133A: offence to use testimonials or purported testimonials in advertising
- Penalties: up to $60,000 (individual) or $120,000 (body corporate) PER OFFENCE
- AI-generated content carries the SAME legal accountability as manually written content (September 2025 update)
- AHPRA proactively scans websites and social media using AI since September 2025
- Cosmetic procedure advertising: mandatory cooling-off period disclosures, no urgency/pressure tactics, no before/after without strict conditions (September 2025 rules)
- ALL registered health professions covered: medical, nursing, dental, psychology, physio, chiro, osteo, optometry, pharmacy, podiatry, Chinese medicine, Aboriginal and Torres Strait Islander health practice, occupational therapy, paramedicine

**TGA — Therapeutic Goods Act 1989 + Therapeutic Goods Advertising Code 2021:**
- Section 42DL: offence to advertise therapeutic goods to the public in a manner that is prohibited — up to $1.11 million (corporate) per offence
- ALL prescription medicines (Schedule 4 and Schedule 8) are PROHIBITED from consumer advertising — this includes:
  - GLP-1 receptor agonists: semaglutide (Ozempic, Wegovy, Rybelsus), tirzepatide (Mounjaro, Zepbound), liraglutide (Saxenda, Victoza), dulaglutide (Trulicity)
  - Dermatology: tretinoin, adapalene, isotretinoin, spironolactone, hydroquinone (prescription strength)
  - Mental health: all SSRIs, SNRIs, benzodiazepines, antipsychotics
  - Pain: all opioids, gabapentinoids
  - Cannabis: ALL medicinal cannabis products (Schedule 8, accessed via SAS-B or AP)
  - Hormones: testosterone, oestrogen (HRT), melatonin (prescription in AU)
  - ANY Schedule 4 or 8 medicine — if it requires a prescription in Australia, it CANNOT be named in consumer-facing advertising
- You CAN advertise the prescribing SERVICE (e.g., "telehealth weight loss consultations", "online skin consultations")
- You CAN say "clinician-prescribed treatment" or "prescription medication" generically
- You CANNOT use brand names, generic drug names, or indirect references that identify specific medicines

**TGA Enforcement Actions (Recent):**
- $198,000 fine: Midnight Health — telehealth weight-loss advertising violations on social media
- $300,000+ total: infringement notices across telehealth providers for naming Schedule 4 medicines in social media ads
- TGA actively monitors TikTok, Instagram, Facebook, Google Ads for breaches
- Updated social media advertising guidance (2025) requires clear distinction between educational content and product promotion
- Personal testimonials and endorsements for therapeutic goods are PROHIBITED on social media

**Google Ads Healthcare Policy (Australia):**
- Prescription drug terms banned in ad copy AND landing pages (Google's own policy, separate from TGA)
- Rehab/addiction services advertising banned in Australia since 2024
- Healthcare LPG (Limited Personalised Advertising) — restricted targeting for health-related ads
- October 2025 update further tightened healthcare and medicines advertising
- Pharmacies must be certified to advertise OTC medicines

**Meta (Facebook/Instagram) Health Advertising:**
- Special Ad Category: health & wellness — restricted targeting, no custom audiences based on health data
- January 2025: cannot optimise for appointment bookings as conversion event
- Cannot build audiences from health condition page visits
- 20,000+ health ads flagged for review in H1 2025

**Platform-Specific Restrictions:**
- TikTok: no remote diagnosis or treatment promotion in paid ads (directly affects telehealth)
- LinkedIn: no specific health ad restrictions but AHPRA/TGA still apply to all platforms
- Reddit: community guidelines prohibit medical misinformation; AHPRA/TGA apply regardless of platform
- ALL platforms: if it's advertising a regulated health service or therapeutic good in Australia, AHPRA and TGA rules apply — there are no platform exceptions

### GOOGLE ADS — HIGHEST INTENT CHANNEL

**Australian Healthcare CPCs (2025 benchmarks from 190 months of campaign data):**
- General clinics: $3.86 average CPC
- Dental: $7.85 average CPC
- Psychology/mental health: $5–$8 CPC
- Weight loss: $4–$7 CPC
- Telehealth: $3–$6 CPC

**Key restrictions:**
- Prescription drug terms banned in ad copy AND landing pages
- Rehab/addiction services advertising quietly banned in Australia
- Healthcare LPG (Limited Personalised Advertising) applies — restricted targeting
- October 2025 policy update tightened healthcare and medicines advertising further

**Best practice:**
- Focus on condition awareness, not drug names
- Use location-specific landing pages for local SEO alignment
- Conversion tracking via first-party data (not Meta pixel for health)

### META (FACEBOOK/INSTAGRAM) — MAJOR POLICY SHIFT JANUARY 2025

**What changed:**
- Can NO LONGER optimise for appointment bookings as a conversion event
- Custom audiences built on health conditions being disabled
- 20,000+ health ads flagged for review in H1 2025
- Special Ad Category restrictions tightened for health & wellness
- Retargeting based on health page visits restricted

**Strategy shift required:**
- Move to upper-funnel objectives (awareness, video views, engagement)
- Build first-party data (email lists, SMS) — don't rely on Meta's targeting
- Lead magnets over direct booking ads
- Educational content that doesn't make claims

**Australian Meta cost benchmarks:**
- Health/wellness CPM: $12–$25
- Health lead cost: $15–$40 (up from $8–$20 pre-policy change)
- CTR benchmark: 0.8–1.5% for compliant health ads

### TIKTOK — ORGANIC > PAID FOR HEALTH

**Key stats:**
- Highest time-on-platform in Australia: 42 hours/month average
- Brand follower growth: 200%+ in 2025
- 1 in 6 Australians get health advice from social media (HealthTok trend)

**Critical restriction:** No remote diagnosis or treatment promotion in paid ads. This directly affects telehealth advertising.

**Strategy:**
- Organic content dramatically outperforms paid for regulated health services
- Clinician-led educational content (not promotional)
- Build authority through consistency, not ad spend
- Never show before/after, never promise outcomes
- Use for brand awareness and trust-building, not direct response

### LINKEDIN — B2B HEALTH TECH

**Use cases:** TeleScribe pitch to practice managers, GP referral networks, health tech partnerships, industry thought leadership.

**Costs:** $5–$15+ CPC (steep but justified by lead quality in healthcare B2B)

**Strategy:**
- Sponsored content targeting practice managers, clinic directors
- Thought leadership from clinician-founder angle
- Case studies (anonymised, compliant) showing practice efficiency gains
- Company page content showing product development transparency

### REDDIT — MASSIVELY UNDERRATED

**Australian Reddit stats (2025):**
- 33% of Australians used Reddit last month (3x global average)
- ChatGPT cites Reddit more than any source except Wikipedia
- Currently cheaper than Meta for health engagement
- r/AusHealthcare, condition-specific subs have highly engaged audiences

**Why this matters:**
- Authentic engagement on Reddit builds authority that flows into AI search citations
- Patients trust peer recommendations over ads
- Reddit threads rank in Google AND get cited by AI assistants
- Cost-effective compared to Meta post-policy changes

**Strategy:**
- Genuine participation in health subreddits (NOT promotional)
- Answer questions as a practitioner (with appropriate disclaimers)
- Build clinician reputation that AI models can reference
- AMA (Ask Me Anything) format for thought leadership

### AI SEARCH / GEO — THE #1 EMERGING PRIORITY

**Current state:**
- 67–84% of health searches now trigger Google AI Overviews
- Organic CTR down 40–60% when AI Overview is present
- Patients are directly asking ChatGPT/Perplexity to recommend providers
- "Best weight loss clinic Sydney" → AI gives a curated list, not 10 blue links

**GEO (Generative Engine Optimisation) strategy:**
1. Build clinician entities (Google Business Profile, schema markup, consistent NAP)
2. Structured FAQ content on every service page (AI models love Q&A format)
3. Schema markup (MedicalClinic, Physician, FAQPage, LocalBusiness)
4. Off-site reputation: Google reviews, Healthshare, directory listings
5. Publish authoritative, cited content (AI models weight sources with references)
6. Reddit + Quora presence (heavily cited by ChatGPT/Perplexity)

**This is the highest-ROI long-term play for any Australian health business right now.**

### CHANNEL PRIORITY MATRIX (Health Business)

| Priority | Channel | Use Case | Budget Split |
|----------|---------|----------|-------------|
| 1 | GEO / AI Search | Long-term visibility, AI citations | 25% effort (content investment) |
| 2 | Google Ads | High-intent patient acquisition | 30% budget |
| 3 | Organic Social (TikTok, Insta) | Brand awareness, trust | 20% effort |
| 4 | Reddit | Authority building, AI citation fuel | 10% effort |
| 5 | Email/SMS | Retention, re-engagement, first-party data | 10% budget |
| 6 | Meta Ads | Upper-funnel only (post Jan-2025 restrictions) | 15% budget |
| 7 | LinkedIn | B2B only (TeleScribe, partnerships) | 5% budget |

### EMAIL MARKETING FOR HEALTH

- Open rates for Australian health: 35–45% (well above average)
- AHPRA-safe funnels: educational → trust → consultation (never hard-sell)
- Onboarding sequences: 5-7 emails over 2 weeks
- Monthly newsletters with health tips (not promotional)
- MUST include unsubscribe link and ABN (Australian Spam Act 2003)

### LOCAL SEO — ESSENTIAL FOR CLINICS

- Google Business Profile is the #1 ranking factor for local health searches
- NAP consistency across all directories (HealthEngine, HotDoc, Healthshare)
- Reviews strategy: ask every satisfied patient (aim for 50+ Google reviews)
- Local landing pages per suburb/area served
- Schema markup for each clinic location
`

/**
 * Returns knowledge sections relevant to a specific agent type.
 * Not all agents need all knowledge — filter by relevance.
 */
export function getMarketingKnowledge(agentType: string): string | null {
  const fullKnowledge: Record<string, string[]> = {
    overall: ['REGULATORY LANDSCAPE', 'CHANNEL PRIORITY MATRIX', 'AI SEARCH / GEO'],
    content: ['REGULATORY LANDSCAPE', 'TIKTOK', 'REDDIT', 'EMAIL MARKETING'],
    seo: ['AI SEARCH / GEO', 'LOCAL SEO', 'REDDIT', 'GOOGLE ADS'],
    paid_ads: ['GOOGLE ADS', 'META', 'TIKTOK', 'LINKEDIN', 'REGULATORY LANDSCAPE'],
    strategy: ['CHANNEL PRIORITY MATRIX', 'REGULATORY LANDSCAPE', 'AI SEARCH / GEO', 'META'],
    email: ['EMAIL MARKETING', 'REGULATORY LANDSCAPE'],
    growth: ['REDDIT', 'LINKEDIN', 'TIKTOK', 'AI SEARCH / GEO'],
    brand: ['TIKTOK', 'REGULATORY LANDSCAPE', 'REDDIT'],
    competitor: ['CHANNEL PRIORITY MATRIX', 'GOOGLE ADS', 'META', 'AI SEARCH / GEO'],
    website: ['AI SEARCH / GEO', 'LOCAL SEO', 'GOOGLE ADS'],
    compliance: ['REGULATORY LANDSCAPE'],
    analytics: ['GOOGLE ADS', 'META', 'CHANNEL PRIORITY MATRIX'],
    automation: ['AI SEARCH / GEO', 'EMAIL MARKETING'],
  }

  const sections = fullKnowledge[agentType]
  if (!sections) return null

  // Extract relevant sections from the full knowledge base
  const lines = AU_HEALTH_MARKETING_KNOWLEDGE.split('\n')
  const relevantSections: string[] = []

  let currentSection = ''
  let capturing = false

  for (const line of lines) {
    if (line.startsWith('### ')) {
      const sectionName = line.replace('### ', '').split('—')[0].trim()
      capturing = sections.some(s => sectionName.toUpperCase().includes(s))
      if (capturing) currentSection = line
    }
    if (capturing) {
      relevantSections.push(line)
    }
  }

  if (relevantSections.length === 0) return null
  return `## Marketing Intelligence (Australian Health — 2025/2026)\n\n${relevantSections.join('\n')}`
}
