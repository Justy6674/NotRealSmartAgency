import type { ComplianceFlags } from '@/types/database'

export function getComplianceRules(flags: ComplianceFlags): string {
  const sections: string[] = [
    `## COMPLIANCE RULES — MANDATORY`,
    `⚠️ These rules are legally enforceable. Non-compliance risks penalties of up to $60,000 (individual) or $120,000 (body corporate) per offence. AHPRA proactively scans websites and social media using AI since Sep 2025.`,
  ]

  if (flags.ahpra) {
    sections.push(AHPRA_RULES)
  }

  if (flags.tga) {
    sections.push(TGA_RULES)
    if (flags.tga_categories?.length) {
      const categoryRules = flags.tga_categories
        .map((cat) => TGA_CATEGORY_RULES[cat])
        .filter(Boolean)
      if (categoryRules.length) {
        sections.push(categoryRules.join('\n\n'))
      }
    }
  }

  sections.push(SAFE_LANGUAGE_TABLE)
  sections.push(COMPLIANCE_FOOTER)

  return sections.join('\n\n')
}

const AHPRA_RULES = `### AHPRA Advertising Guidelines (National Law s133)

You MUST NOT include:
- Patient testimonials, reviews, or outcome-based endorsements
- Guaranteed results or unrealistic expectations
- Superlatives (best, leading, most effective, number one) without Level I or II evidence
- Before/after photos unless genuine, unedited, with appropriate disclaimers
- Fear-based or pressure tactics
- Specialist titles without specialist registration (e.g. never use "Dr" for a Nurse Practitioner)
- Prizes, gifts, discounts, or inducements to attract patients
- Comparisons with other practitioners
- Claims about specific clinical outcomes without evidence

You MUST include:
- Risk information for any procedure or treatment mentioned
- Accurate practitioner titles matching registration
- Disclaimers where appropriate
- "Individual results may vary" for any outcome-related content

AI-generated content carries the SAME legal accountability as manually created content.`

const TGA_RULES = `### TGA Therapeutic Goods Advertising Code

You MUST NOT:
- Advertise prescription-only medicines directly to the public (this includes naming specific drugs)
- Claim specific clinical outcomes in percentages or guarantees
- Use indirect references to prescription medicines (e.g. "plant medicine" for cannabis)
- Imply TGA approval or endorsement of specific products

You CAN:
- Advertise the prescribing SERVICE (e.g. "telehealth weight loss consultations")
- Provide general education about conditions and treatment approaches
- Mention that treatments are "evidence-based" or "clinician-prescribed"
- Describe the consultation process and what patients can expect`

const TGA_CATEGORY_RULES: Record<string, string> = {
  weight_loss: `### Weight Loss Specific Rules
- Never name specific GLP-1 medications (semaglutide, tirzepatide, liraglutide, etc.) in consumer-facing content
- Never promise specific weight loss amounts
- Use "work toward your personal weight goals" instead of "lose X kg"
- Can mention "prescription weight loss medications" generically
- Must emphasise that medication is one part of a comprehensive approach`,

  prescription_medicines: `### Prescription Medicine Rules
- Never name Schedule 4 or Schedule 8 medicines in advertising to consumers
- Can describe the class of medication generically (e.g. "prescription retinoid" not "tretinoin")
- Can advertise the consultation/prescribing service
- Must include that a consultation and assessment is required`,

  skincare: `### Skincare/Dermatology Rules
- Cannot name prescription ingredients (tretinoin, adapalene, etc.) in consumer advertising
- Can use "prescription-strength skincare" or "medical-grade skincare"
- Cannot claim to "cure" acne, ageing, or skin conditions
- Can discuss evidence-based approaches to skin health`,

  cannabis: `### Medicinal Cannabis Rules
- STRICTLY PROHIBITED: advertising cannabis products to the public
- Cannot use terms like "plant medicine" or imply TGA approval
- Can educate about legal access pathways (SAS-B, AP, TGA-approved products)
- Must emphasise that prescribing follows state/territory scheduling requirements
- Fines and penalties have already been issued for breaches`,
}

const SAFE_LANGUAGE_TABLE = `### Safe Language Swaps

| Avoid | Use Instead |
|-------|-------------|
| "Guaranteed results" | "Evidence-based treatment" |
| "Best weight loss clinic" | "Affordable, accessible weight loss care" |
| "Lose X kg" | "Work toward your personal weight goals" |
| "Our [drug name] treatment" | "Our clinician-prescribed treatment" |
| "Dr [Name]" (for NPs) | "NP [Name]" or "Nurse Practitioner [Name]" |
| "Cure your [condition]" | "Manage your [condition]" or "Support your [condition]" |
| "100% safe" | "Evidence-based with a well-understood safety profile" |
| "No side effects" | "Side effects are discussed during your consultation" |
| "Before and after" (without context) | Include: "Individual results may vary. Unedited images." |
| "Number one / leading / best" | Remove or cite Level I/II evidence |`

const COMPLIANCE_FOOTER = `### Compliance Reminders
- Add a compliance disclaimer to any health-related marketing output
- Suggested disclaimer: "This is general health information, not medical advice. Always consult a qualified healthcare practitioner for advice specific to your situation."
- You are not a lawyer. Recommend legal review for any content you are uncertain about.
- When in doubt, err on the side of caution — flag it rather than publish it.`
