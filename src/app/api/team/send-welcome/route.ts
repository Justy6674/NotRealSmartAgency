import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * POST /api/team/send-welcome
 * Body: { memberId: string }
 *
 * Sends a comprehensive branded welcome email with full setup
 * instructions for web, Claude Desktop, Claude Code, and VS Code.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const admin = createAdminClient()

  // Get team member
  const { data: member } = await admin
    .from('team_members')
    .select('*')
    .eq('id', memberId)
    .eq('owner_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

  // Get owner name
  const { data: owner } = await admin
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const ownerName = owner?.full_name ?? 'Your team lead'

  // Get brand names
  let brandNames = 'all brands'
  if (member.brand_ids?.length) {
    const { data: brands } = await admin
      .from('brands')
      .select('name')
      .in('id', member.brand_ids)
    brandNames = brands?.map((b: { name: string }) => b.name).join(', ') ?? 'all brands'
  } else {
    const { data: brands } = await admin
      .from('brands')
      .select('name')
      .eq('user_id', user.id)
    brandNames = brands?.map((b: { name: string }) => b.name).join(', ') ?? 'all brands'
  }

  // Get their API key if one exists
  let apiKeyPrefix = ''
  if (member.member_id) {
    const { data: key } = await admin
      .from('api_keys')
      .select('prefix')
      .eq('user_id', member.member_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (key) apiKeyPrefix = key.prefix
  }

  const role = member.role === 'admin' ? 'Admin' : 'Viewer'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notrealsmart.com.au'
  const mcpUrl = 'https://www.notrealsmart.com.au/api/mcp'
  const helpUrl = `${siteUrl}/help`

  const html = `
<div style="font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:640px;margin:0 auto;padding:32px;color:#1a1a1a;">

  <img src="${siteUrl}/Logo.png" width="160" height="40" style="border-radius:4px;margin-bottom:24px;" />

  <h1 style="font-size:22px;margin:0 0 8px;">Welcome to your AI marketing agency</h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 16px;">
    ${ownerName} has set you up as <strong>${role}</strong> on NotRealSmart Agency.
    You have access to <strong>${brandNames}</strong>.
  </p>

  ${role === 'Admin'
    ? '<p style="font-size:14px;color:#666;margin:0 0 24px;">As an Admin, you can chat with the Director, create content, schedule and publish posts, run audits, and manage brands.</p>'
    : '<p style="font-size:14px;color:#666;margin:0 0 24px;">As a Viewer, you can see all content, calendars, and reports — but you cannot create or publish.</p>'
  }

  <!-- ─── WHAT IS THIS ─── -->
  <div style="padding:20px;background:#f8f8f8;border-radius:10px;margin:0 0 24px;">
    <h2 style="font-size:16px;margin:0 0 8px;">What is NotRealSmart?</h2>
    <p style="font-size:13px;color:#555;line-height:1.6;margin:0;">
      It is your own AI marketing agency. You talk to one person — the Director — and behind the scenes, 14 specialist agents handle content writing, SEO, ads, email campaigns, video, design, competitor analysis, compliance, and more. Just talk normally. No marketing experience needed.
    </p>
  </div>

  <!-- ─── 4 ACCESS METHODS ─── -->
  <h2 style="font-size:18px;margin:0 0 16px;">4 ways to use your agency</h2>

  <!-- Method 1: Web -->
  <div style="padding:20px;background:#f4f4f5;border-radius:10px;margin:0 0 16px;">
    <h3 style="font-size:15px;margin:0 0 6px;color:#1a1a1a;">1. Web app (easiest — start here)</h3>
    <ol style="font-size:13px;color:#555;line-height:1.8;margin:0;padding-left:20px;">
      <li>Go to <a href="${siteUrl}/login" style="color:#1a1a1a;font-weight:600;">${siteUrl.replace('https://', '')}/login</a></li>
      <li>Enter your email and password</li>
      <li>You will see the Director — just talk to it</li>
      <li>Try saying: <em>"What can you help me with?"</em></li>
    </ol>
    <p style="font-size:11px;margin:10px 0 0;"><a href="${helpUrl}/getting-started" style="color:#888;">Read the getting started guide &rarr;</a></p>
  </div>

  <!-- Method 2: Claude Desktop / Mobile -->
  <div style="padding:20px;background:#f4f4f5;border-radius:10px;margin:0 0 16px;">
    <h3 style="font-size:15px;margin:0 0 6px;color:#1a1a1a;">2. Claude Desktop or Mobile (recommended)</h3>
    <p style="font-size:13px;color:#555;margin:0 0 8px;">This lets you use your agency inside Claude — the same AI chat you already use.</p>
    <ol style="font-size:13px;color:#555;line-height:1.8;margin:0;padding-left:20px;">
      <li>Open <strong>Claude</strong> on your computer or phone</li>
      <li>Go to <strong>Settings</strong> (gear icon)</li>
      <li>Tap <strong>Integrations</strong></li>
      <li>Tap <strong>"Add custom connector"</strong></li>
      <li>Name: <strong>NotRealSmart</strong></li>
      <li>URL: <strong style="background:#e8e8e8;padding:2px 8px;border-radius:4px;">${mcpUrl}</strong></li>
      <li>Tap <strong>Add</strong></li>
      <li>Log in with your email and password when prompted</li>
      <li>Done! Your 12 agency tools appear in every Claude conversation</li>
    </ol>
    <p style="font-size:12px;color:#555;margin:10px 0 0;">
      After connecting, start any Claude conversation and say: <em>"Use NotRealSmart to write a social post for Downscale"</em>
    </p>
    <p style="font-size:11px;margin:6px 0 0;"><a href="${helpUrl}/connecting-devices/claude-desktop" style="color:#888;">Read the Claude Desktop guide &rarr;</a></p>
  </div>

  <!-- Method 3: VS Code (Cowork) -->
  <div style="padding:20px;background:#f4f4f5;border-radius:10px;margin:0 0 16px;">
    <h3 style="font-size:15px;margin:0 0 6px;color:#1a1a1a;">3. VS Code (Cowork extension)</h3>
    <ol style="font-size:13px;color:#555;line-height:1.8;margin:0;padding-left:20px;">
      <li>Install the <strong>Cowork</strong> extension in VS Code</li>
      <li>Open the Cowork chat panel</li>
      <li>Say: <em>"Add an MCP server called notrealsmart with URL ${mcpUrl}"</em></li>
      <li>Claude sets it up for you — no files to edit</li>
    </ol>
    ${apiKeyPrefix ? `<p style="font-size:12px;color:#555;margin:10px 0 0;">Your API key starts with <code style="background:#e8e8e8;padding:2px 8px;border-radius:4px;font-size:12px;">${apiKeyPrefix}...</code> — find the full key in your <a href="${siteUrl}/agency/settings" style="color:#1a1a1a;">Settings page</a>.</p>` : ''}
    <p style="font-size:11px;margin:6px 0 0;"><a href="${helpUrl}/connecting-devices/vs-code" style="color:#888;">Read the VS Code guide &rarr;</a></p>
  </div>

  <!-- Method 4: Terminal (Claude Code) -->
  <div style="padding:20px;background:#f4f4f5;border-radius:10px;margin:0 0 16px;">
    <h3 style="font-size:15px;margin:0 0 6px;color:#1a1a1a;">4. Terminal (Claude Code)</h3>
    <p style="font-size:13px;color:#555;margin:0 0 8px;">If you use the terminal:</p>
    <ol style="font-size:13px;color:#555;line-height:1.8;margin:0;padding-left:20px;">
      <li>Open Terminal</li>
      <li>Type <strong style="background:#1a1a1a;color:#e4e4e7;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:12px;">claude</strong> and press Enter</li>
      <li>Say: <em>"Add an MCP server called notrealsmart with URL ${mcpUrl}"</em></li>
      <li>Claude configures it automatically</li>
      <li>Now you can say things like <em>"Use NotRealSmart to check what's scheduled this week"</em></li>
    </ol>
    <p style="font-size:11px;margin:6px 0 0;"><a href="${helpUrl}/connecting-devices/claude-code-terminal" style="color:#888;">Read the terminal guide &rarr;</a></p>
  </div>

  <!-- ─── WHAT'S CONNECTED ─── -->
  <div style="padding:20px;background:#f0f7ff;border:1px solid #d0e0f0;border-radius:10px;margin:0 0 24px;">
    <h3 style="font-size:15px;margin:0 0 8px;color:#1a1a1a;">What your agency can already do</h3>
    <p style="font-size:13px;color:#555;line-height:1.6;margin:0;">
      Your agency has these integrations set up and ready to use:
    </p>
    <ul style="font-size:13px;color:#555;line-height:1.8;margin:8px 0 0;padding-left:20px;">
      <li><strong>Social media publishing</strong> — Facebook, Instagram, LinkedIn, YouTube (auto-publish on schedule)</li>
      <li><strong>Canva</strong> — design graphics, social posts, stories, presentations</li>
      <li><strong>Video planning</strong> — scripts, shot lists, captions, and production briefs</li>
      <li><strong>Transcription</strong> — upload video/audio, get captions for every platform</li>
      <li><strong>AHPRA/TGA compliance</strong> — every output checked against health advertising rules</li>
      <li><strong>65+ shortcuts</strong> — type / in the chat to see them all</li>
    </ul>
  </div>

  <!-- ─── TRY THESE ─── -->
  <div style="padding:20px;background:#f4f4f5;border-radius:10px;margin:0 0 24px;">
    <h3 style="font-size:15px;margin:0 0 8px;color:#1a1a1a;">Try saying these</h3>
    <ul style="font-size:13px;color:#555;line-height:2;margin:0;padding-left:20px;list-style:none;">
      <li>💬 "Write me an Instagram post about our new service"</li>
      <li>💬 "Fill my content calendar for the next 2 weeks"</li>
      <li>💬 "Run a marketing audit on my website"</li>
      <li>💬 "Write a blog about weight loss tips"</li>
      <li>💬 "Design a Facebook cover photo"</li>
      <li>💬 "What's scheduled this week?"</li>
      <li>💬 "Scan this competitor: [paste URL]"</li>
    </ul>
  </div>

  <!-- ─── HELP ─── -->
  <div style="text-align:center;margin:24px 0;">
    <a href="${siteUrl}/agency/chat" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:500;">
      Go to your agency
    </a>
  </div>

  <p style="font-size:14px;color:#666;text-align:center;">
    Need help? Visit the <a href="${helpUrl}" style="color:#1a1a1a;font-weight:600;">Help Centre</a> — it covers everything step by step.
  </p>

  <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0 16px;" />
  <p style="font-size:11px;color:#bbb;text-align:center;">
    NotRealSmart Agency — office@notrealsmart.com.au — notrealsmart.com.au
  </p>
</div>`

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'NotRealSmart Agency <office@notrealsmart.com.au>',
      to: member.member_email,
      subject: `Your NotRealSmart Agency — setup guide`,
      html,
    })
  } catch (err) {
    console.error('[team/send-welcome] Failed to send welcome email:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
