interface DigestSection {
  title: string
  items: { headline: string; summary: string; url?: string }[]
}

interface CompetitorSection {
  brandName: string
  brandEmoji: string
  competitors: { name: string; changes: string | null }[]
}

export function buildDailyIntelHtml({
  date,
  aiNews,
  competitorSections,
  whatAmIMissing,
}: {
  date: string
  aiNews: DigestSection | null
  competitorSections: CompetitorSection[]
  whatAmIMissing: string | null
}): string {
  const aiNewsHtml = aiNews && aiNews.items.length > 0 ? `
    <tr><td style="padding:24px 0 12px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0;border-bottom:2px solid #e5e5e5;padding-bottom:8px;">AI AGENT NEWS</h2>
    </td></tr>
    ${aiNews.items.map(item => `
      <tr><td style="padding:6px 0;">
        <p style="margin:0;font-size:14px;"><strong>${item.headline}</strong></p>
        <p style="margin:2px 0 0;font-size:13px;color:#555;">${item.summary}</p>
        ${item.url ? `<a href="${item.url}" style="font-size:12px;color:#0066cc;">Read more →</a>` : ''}
      </td></tr>
    `).join('')}
  ` : ''

  const competitorHtml = competitorSections.length > 0 ? `
    <tr><td style="padding:24px 0 12px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0;border-bottom:2px solid #e5e5e5;padding-bottom:8px;">COMPETITOR WATCH</h2>
    </td></tr>
    ${competitorSections.map(section => `
      <tr><td style="padding:12px 0 4px;">
        <h3 style="font-size:14px;font-weight:600;color:#333;margin:0;">${section.brandEmoji} ${section.brandName}</h3>
      </td></tr>
      ${section.competitors.map(c => `
        <tr><td style="padding:3px 0 3px 16px;font-size:13px;">
          <strong>${c.name}</strong> — ${c.changes ?? '<span style="color:#999;">no changes detected</span>'}
        </td></tr>
      `).join('')}
    `).join('')}
  ` : ''

  const missingHtml = whatAmIMissing ? `
    <tr><td style="padding:24px 0 12px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0;border-bottom:2px solid #e5e5e5;padding-bottom:8px;">WHAT YOU MIGHT BE MISSING</h2>
    </td></tr>
    <tr><td style="padding:6px 0;font-size:13px;color:#555;">
      ${whatAmIMissing.replace(/\n/g, '<br>')}
    </td></tr>
  ` : ''

  return `
    <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:16px;border-bottom:3px solid #1a1a1a;">
          <h1 style="font-size:20px;font-weight:700;margin:0;">Daily Intel</h1>
          <p style="font-size:12px;color:#999;margin:4px 0 0;">${date} — NRS Agency</p>
        </td></tr>
        ${aiNewsHtml}
        ${competitorHtml}
        ${missingHtml}
        <tr><td style="padding-top:24px;border-top:1px solid #e5e5e5;font-size:11px;color:#999;">
          Sent by NotRealSmart Agency &mdash; Black Health Intelligence Pty Ltd, ABN 23 693 026 112
        </td></tr>
      </table>
    </div>
  `
}
