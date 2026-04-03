import { tool } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runComplianceFilter } from '../compliance-filter'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CampaignEmailSchema = z.object({
  subject_line: z.string().describe('Subject line, under 60 characters'),
  preview_text: z.string().max(100).describe('Inbox preview text, under 100 characters'),
  send_delay: z.string().describe('When to send, e.g. "immediately", "day 2", "day 5"'),
  body_html: z.string().describe('Email body in simple, mobile-friendly single-column HTML'),
  cta_text: z.string().describe('Call-to-action button text'),
  cta_url: z.string().optional().describe('Call-to-action URL (placeholder if unknown)'),
})

const CampaignOutputSchema = z.object({
  campaign_name: z.string().describe('A descriptive name for the campaign'),
  emails: z.array(CampaignEmailSchema),
})

// ─── Campaign Types ──────────────────────────────────────────────────────────

const CAMPAIGN_DESCRIPTIONS: Record<string, string> = {
  welcome_sequence: 'A warm welcome series for new subscribers, introducing the brand, building trust, and guiding them to their first action.',
  nurture_sequence: 'An educational nurture series that builds authority and moves subscribers toward a purchase decision over time.',
  newsletter: 'A recurring newsletter format with valuable content, updates, and a clear call to action.',
  announcement: 'A time-sensitive announcement series building anticipation and driving action for a launch, event, or update.',
  re_engagement: 'A re-engagement series to win back inactive subscribers with compelling reasons to return.',
  promotion: 'A promotional series building urgency around a special offer, discount, or limited-time deal.',
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

function buildCampaignSystemPrompt(
  brandName: string,
  brandDescription: string | null,
  niche: string | null,
  complianceFlags: { ahpra?: boolean; tga?: boolean } | null
): string {
  let prompt = `You are an expert email marketing strategist writing campaigns for an Australian business.

Brand: ${brandName}
${brandDescription ? `Description: ${brandDescription}` : ''}
${niche ? `Industry: ${niche}` : ''}

## Rules — MANDATORY

### Australian Spam Act 2003 Compliance
- Every email MUST include an unsubscribe mechanism. Add this footer to every email body_html:
  <p style="font-size:12px;color:#666;margin-top:32px;">You're receiving this because you subscribed to {{brand_name}} updates.<br><a href="{{unsubscribe_url}}" style="color:#666;">Unsubscribe</a> | {{brand_name}}</p>
- Every email MUST clearly identify the sender (brand name in footer).
- Content must be relevant to what the subscriber signed up for.

### Email Best Practices
- Subject lines MUST be under 60 characters. Be specific and compelling, not clickbait.
- Preview text MUST be under 100 characters and complement (not repeat) the subject line.
- Use personalisation placeholders: {{first_name}}, {{brand_name}}.
- Write in Australian English (colour, behaviour, organisation, etc.).
- HTML must be simple, single-column, mobile-friendly. Use inline styles only.
- Use a clear visual hierarchy: headline, body copy, CTA button.
- Each email should have ONE primary call to action.
- Each email in a sequence MUST build on the previous one — create a narrative arc.
- CTA buttons should use: <a href="{{cta_url}}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">CTA TEXT</a>

### Tone
- Conversational and warm, not corporate or pushy.
- Helpful and educational before promotional.
- Write as if emailing a friend who happens to be a customer.`

  if (complianceFlags?.ahpra || complianceFlags?.tga) {
    prompt += `

### Healthcare Compliance (CRITICAL — $60K–$120K fines per offence)
`
    if (complianceFlags.ahpra) {
      prompt += `- AHPRA: NO testimonials claiming therapeutic outcomes.
- AHPRA: NO misleading or deceptive health claims.
- AHPRA: NO before/after photos implying guaranteed results.
- AHPRA: Include appropriate disclaimers where needed.
`
    }
    if (complianceFlags.tga) {
      prompt += `- TGA: NO promotion of prescription-only medicines to the public.
- TGA: Do not cross from education into therapeutic goods promotion without proper approval.
`
    }
  }

  return prompt
}

// ─── Tool Factory ────────────────────────────────────────────────────────────

export function createWriteEmailCampaignTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Design and save a multi-email campaign or sequence. Generates subject lines, preview text, HTML body, and send timing for each email. Saves each email to the output library for review before sending. Use this for welcome sequences, nurture flows, newsletters, promotions, re-engagement, and announcements.',
    inputSchema: z.object({
      type: z.enum([
        'welcome_sequence',
        'nurture_sequence',
        'newsletter',
        'announcement',
        're_engagement',
        'promotion',
      ]).describe('The type of email campaign to create'),
      emails_count: z
        .number()
        .min(1)
        .max(10)
        .default(3)
        .describe('Number of emails in the sequence (1–10, default 3)'),
      topic: z.string().describe('What the campaign is about — the main message or offer'),
      cta: z
        .string()
        .optional()
        .describe('Primary call to action, e.g. "Book a consultation", "Shop now"'),
    }),
    execute: async ({ type, emails_count, topic, cta }) => {
      // 1. Fetch brand context
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('name, description, niche, website_url, compliance_flags')
        .eq('id', brandId)
        .single()

      if (brandError || !brand) {
        return { success: false, error: 'Could not fetch brand details.' }
      }

      const campaignDescription = CAMPAIGN_DESCRIPTIONS[type] ?? 'A custom email campaign.'
      const systemPrompt = buildCampaignSystemPrompt(
        brand.name,
        brand.description,
        brand.niche,
        brand.compliance_flags
      )

      const userPrompt = `Create a ${type.replace(/_/g, ' ')} with exactly ${emails_count} email(s).

Campaign type: ${campaignDescription}

Topic: ${topic}
${cta ? `Primary CTA: ${cta}` : ''}
${brand.website_url ? `Website: ${brand.website_url}` : ''}

Generate the full campaign now. Remember:
- Each email builds on the previous one (narrative arc)
- Subject lines under 60 chars
- Preview text under 100 chars
- Simple, mobile-friendly HTML with inline styles
- Australian Spam Act footer on every email
- Personalisation placeholders: {{first_name}}, {{brand_name}}`

      // 2. Generate the campaign via LLM
      let campaign: z.infer<typeof CampaignOutputSchema>
      try {
        const { object } = await generateObject({
          model: gateway('anthropic/claude-sonnet-4'),
          system: systemPrompt,
          prompt: userPrompt,
          schema: CampaignOutputSchema,
        })
        campaign = object
      } catch (err) {
        return {
          success: false,
          error: `Failed to generate campaign: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }
      }

      // 3. Run compliance check for health brands
      let complianceWarnings: string[] = []
      if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
        const allContent = campaign.emails.map((e) => `${e.subject_line}\n${e.body_html}`).join('\n\n---\n\n')
        try {
          const result = await runComplianceFilter(allContent, brand.compliance_flags)
          if (!result.isValid) {
            complianceWarnings = [...result.flags, ...result.warnings]
          } else if (result.warnings.length > 0) {
            complianceWarnings = result.warnings
          }
        } catch {
          complianceWarnings = ['Compliance check could not complete — review manually.']
        }
      }

      // 4. Save each email as an output
      const savedIds: string[] = []
      const saveErrors: string[] = []

      for (let i = 0; i < campaign.emails.length; i++) {
        const email = campaign.emails[i]
        const title = `[${campaign.campaign_name}] Email ${i + 1}: ${email.subject_line}`
        const content = `**Subject:** ${email.subject_line}
**Preview:** ${email.preview_text}
**Send:** ${email.send_delay}
**CTA:** ${email.cta_text}${email.cta_url ? ` → ${email.cta_url}` : ''}

---

${email.body_html}`

        const { data, error } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'email_sequence',
            title,
            content,
            metadata: {
              campaign_name: campaign.campaign_name,
              campaign_type: type,
              email_index: i + 1,
              total_emails: campaign.emails.length,
              subject_line: email.subject_line,
              preview_text: email.preview_text,
              send_delay: email.send_delay,
              cta_text: email.cta_text,
              cta_url: email.cta_url ?? null,
              compliance_warnings: complianceWarnings.length > 0 ? complianceWarnings : null,
            },
          })
          .select('id')
          .single()

        if (error) {
          saveErrors.push(`Email ${i + 1}: ${error.message}`)
        } else {
          savedIds.push(data.id)
        }
      }

      // 5. Build formatted preview
      const preview = campaign.emails
        .map(
          (email, i) =>
            `**Email ${i + 1} — ${email.send_delay}**\n` +
            `Subject: ${email.subject_line}\n` +
            `Preview: ${email.preview_text}\n` +
            `CTA: ${email.cta_text}`
        )
        .join('\n\n')

      return {
        success: true,
        campaign_name: campaign.campaign_name,
        campaign_type: type,
        emails_count: campaign.emails.length,
        saved_output_ids: savedIds,
        ...(saveErrors.length > 0 ? { save_errors: saveErrors } : {}),
        ...(complianceWarnings.length > 0 ? { compliance_warnings: complianceWarnings } : {}),
        preview,
        message: `Created "${campaign.campaign_name}" with ${campaign.emails.length} email(s). All saved to your output library for review before sending.`,
      }
    },
  })
}
