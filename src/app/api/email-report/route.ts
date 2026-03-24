import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { content, subject, to, note } = await request.json()

  if (!content) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  const recipientEmail = to || user.email
  if (!recipientEmail) {
    return NextResponse.json({ error: 'No email address available' }, { status: 400 })
  }

  // Convert markdown-ish content to basic HTML
  const htmlContent = content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')

  const noteHtml = note ? `<div style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:20px;"><strong>Note:</strong> ${note}</div>` : ''

  const html = `
    <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <div style="border-bottom:2px solid #e5e5e5;padding-bottom:12px;margin-bottom:20px;">
        <h1 style="font-size:18px;margin:0;">NRS Agency Report</h1>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">${subject || 'Report from NotRealSmart Agency'}</p>
      </div>
      ${noteHtml}
      <div style="font-size:14px;line-height:1.7;">
        ${htmlContent}
      </div>
      <div style="border-top:1px solid #e5e5e5;margin-top:24px;padding-top:12px;font-size:11px;color:#999;">
        Sent by NotRealSmart Agency &mdash; Black Health Intelligence Pty Ltd, ABN 23 693 026 112
      </div>
    </div>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'NRS Agency <noreply@notrealsmart.com.au>',
      to: recipientEmail,
      subject: subject || 'NRS Agency Report',
      html,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sent: true, emailId: data?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
