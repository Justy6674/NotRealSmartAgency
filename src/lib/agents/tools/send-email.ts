import { tool } from 'ai'
import { z } from 'zod/v3'
import { Resend } from 'resend'

export function createSendEmailTool() {
  return tool({
    description:
      'Send a marketing email or EDM. Use for outreach, newsletters, follow-ups, and campaign emails. The email is sent via Resend and must comply with the Australian Spam Act 2003 (consent required, unsubscribe link included, sender identified).',
    inputSchema: z.object({
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().max(100).describe('Email subject line (50 chars ideal for mobile)'),
      html: z.string().describe('Full HTML email body. Must include unsubscribe link placeholder {{unsubscribe_url}} and sender ABN.'),
      previewText: z.string().max(150).optional().describe('Preview text shown in inbox (90 chars ideal)'),
      replyTo: z.string().email().optional().describe('Reply-to address'),
      bcc: z.string().email().optional().describe('BCC address — always BCC the sender for records'),
    }),
    execute: async ({ to, subject, html, previewText, replyTo, bcc }) => {
      const apiKey = process.env.RESEND_API_KEY
      if (!apiKey) {
        return {
          sent: false,
          error: 'RESEND_API_KEY not configured. Add it to environment variables.',
          draft: { to, subject, html },
        }
      }

      const resend = new Resend(apiKey)

      // Add preview text if provided
      const fullHtml = previewText
        ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>${html}`
        : html

      try {
        const { data, error } = await resend.emails.send({
          from: `NRS Agency <${process.env.RESEND_FROM_EMAIL ?? 'noreply@notrealsmart.com.au'}>`,
          to,
          bcc: bcc ?? process.env.RESEND_FROM_EMAIL ?? 'office@notrealsmart.com.au',
          subject,
          html: fullHtml,
          replyTo: replyTo ?? process.env.RESEND_REPLY_TO,
        })

        if (error) {
          return { sent: false, error: error.message }
        }

        return {
          sent: true,
          emailId: data?.id,
          to,
          subject,
          message: `Email sent to ${to}: "${subject}"`,
        }
      } catch (err) {
        return {
          sent: false,
          error: err instanceof Error ? err.message : 'Failed to send email',
          draft: { to, subject },
        }
      }
    },
  })
}
