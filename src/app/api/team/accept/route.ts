import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST — accept a team invitation
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()

  // Find invite by token
  const { data: invite } = await admin
    .from('team_members')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 })
  }

  // Verify email matches
  if (invite.member_email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({
      error: `This invitation was sent to ${invite.member_email}. Please log in with that email.`,
    }, { status: 403 })
  }

  // Accept
  const { data, error } = await admin
    .from('team_members')
    .update({
      member_id: user.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })
    .eq('id', invite.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // --- Send welcome email with setup guidance ---
  try {
    // Get owner name
    const { data: owner } = await admin
      .from('users')
      .select('full_name')
      .eq('id', invite.owner_id)
      .single()
    const ownerName = owner?.full_name ?? 'Your team'

    // Get brand names
    let brandNames = 'all brands'
    if (invite.brand_ids?.length) {
      const { data: brands } = await admin
        .from('brands')
        .select('name')
        .in('id', invite.brand_ids)
      brandNames = brands?.map((b: { name: string }) => b.name).join(', ') ?? 'all brands'
    }

    // Get API key prefix (created during invite)
    const { data: apiKey } = await admin
      .from('api_keys')
      .select('prefix')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const role = invite.role === 'admin' ? 'Admin' : 'Viewer'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notrealsmart.com.au'
    const mcpUrl = 'https://www.notrealsmart.com.au/api/mcp'

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'NRS Agency <noreply@notrealsmart.com.au>',
      to: user.email!,
      subject: `Welcome to ${ownerName}'s agency on NotRealSmart`,
      html: `
        <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#1a1a1a;">
          <h1 style="font-size:22px;margin:0 0 16px;">You're in! 🎉</h1>
          <p style="font-size:15px;line-height:1.6;color:#444;">
            You've joined <strong>${ownerName}'s</strong> marketing agency as <strong>${role}</strong>.
            You have access to <strong>${brandNames}</strong>.
          </p>

          ${role === 'Admin'
            ? '<p style="font-size:14px;color:#666;">As an Admin, you can chat with the Director, create content, schedule posts, and manage brands.</p>'
            : '<p style="font-size:14px;color:#666;">As a Viewer, you can see all content, calendars, and reports — but you cannot create or publish.</p>'
          }

          <div style="margin:28px 0;padding:24px;background:#f4f4f5;border-radius:12px;">
            <h2 style="font-size:18px;margin:0 0 16px;">4 ways to use your agency</h2>

            <div style="margin:0 0 20px;">
              <h3 style="font-size:14px;margin:0 0 6px;color:#1a1a1a;">1. Web app (easiest)</h3>
              <p style="font-size:13px;color:#666;line-height:1.5;margin:0;">
                Go to <a href="${siteUrl}/agency" style="color:#1a1a1a;font-weight:500;">notrealsmart.com.au</a> and log in. Talk to the Director — it handles everything.
              </p>
              <p style="font-size:11px;margin:4px 0 0;"><a href="${siteUrl}/help/getting-started" style="color:#666;">📖 Getting started guide</a></p>
            </div>

            <div style="margin:0 0 20px;">
              <h3 style="font-size:14px;margin:0 0 6px;color:#1a1a1a;">2. Claude Desktop or Mobile (recommended)</h3>
              <ol style="font-size:13px;color:#666;line-height:1.8;margin:0;padding-left:20px;">
                <li>Open Claude Desktop (or the Claude app on your phone)</li>
                <li>Go to <strong>Settings → Integrations</strong></li>
                <li>Click <strong>"Add custom connector"</strong></li>
                <li>Name: <strong>NotRealSmart</strong></li>
                <li>URL: <strong>${mcpUrl}</strong></li>
                <li>Click Add — log in when prompted</li>
                <li>Done! Your agency tools appear in every conversation</li>
              </ol>
              <p style="font-size:11px;margin:4px 0 0;"><a href="${siteUrl}/help/connecting-devices/claude-desktop" style="color:#666;">📖 Claude Desktop setup guide</a></p>
            </div>

            <div style="margin:0 0 20px;">
              <h3 style="font-size:14px;margin:0 0 6px;color:#1a1a1a;">3. VS Code (Cowork extension)</h3>
              <p style="font-size:13px;color:#666;line-height:1.5;margin:0;">
                Install the Cowork extension in VS Code, then add NotRealSmart as an MCP server.
                ${apiKey ? `Your API key starts with <code style="background:#e4e4e7;padding:2px 6px;border-radius:4px;font-size:12px;">${apiKey.prefix}...</code> — find the full key in your Settings page.` : ''}
              </p>
              <p style="font-size:11px;margin:4px 0 0;"><a href="${siteUrl}/help/connecting-devices/vs-code" style="color:#666;">📖 VS Code setup guide</a></p>
            </div>

            <div style="margin:0 0 20px;">
              <h3 style="font-size:14px;margin:0 0 6px;color:#1a1a1a;">4. Terminal (Claude Code)</h3>
              <p style="font-size:13px;color:#666;line-height:1.5;margin:0;">
                Open Claude Code and say: "Add an MCP server called notrealsmart with URL ${mcpUrl}"
              </p>
              <p style="font-size:11px;margin:4px 0 0;"><a href="${siteUrl}/help/connecting-devices/claude-code-terminal" style="color:#666;">📖 Terminal setup guide</a></p>
            </div>
          </div>

          <div style="margin:24px 0;">
            <a href="${siteUrl}/agency/chat" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
              Go to your agency
            </a>
          </div>

          <div style="padding:12px 16px;background:#f4f4f5;border-radius:8px;border:1px solid #e4e4e7;margin:24px 0;">
            <p style="font-size:13px;color:#444;margin:0;line-height:1.5;">
              <strong>Try saying:</strong><br/>
              "Write a blog about X" · "Post this to Facebook" · "What's scheduled this week?" · "Audit my website" · "Run a competitor scan"
            </p>
          </div>

          <p style="font-size:13px;color:#666;">
            Need help? Visit the <a href="${siteUrl}/help" style="color:#1a1a1a;font-weight:500;">Help Centre</a> or just ask the Director.
          </p>

          <p style="font-size:12px;color:#999;margin-top:32px;">
            NRS Agency by NotRealSmart — notrealsmart.com.au
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[team/accept] Failed to send welcome email:', err)
    // Don't fail the acceptance if email fails
  }

  return NextResponse.json(data)
}
