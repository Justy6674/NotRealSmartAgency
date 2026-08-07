/**
 * The Monday email: who visited, and whether the sites are holding up.
 *
 * Written to be read on a phone by two people who are not developers. Biggest
 * mover first, plain sentences, and a number only where it changes what to do.
 * The week-on-week change is the point — 591 visitors means nothing on its own,
 * "591, up from 402" means something.
 *
 * Pure: it formats numbers it is given and reads no clock and no network, so
 * the wording is testable without standing up a week of traffic.
 */

export interface BrandTraffic {
  brand: string
  website: string | null
  /** Null when the site could not be read at all. */
  visitors: number | null
  pageviews: number | null
  /** The same week a week earlier, for the comparison. */
  previousVisitors: number | null
  /** Where the visitors came from, biggest first. */
  topReferrers?: Array<{ label: string; visitors: number }>
  /** Most-viewed pages, biggest first. */
  topPages?: Array<{ label: string; visitors: number }>
  /** Set when there is a reason there are no numbers. */
  note?: string
}

export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((now - before) / before) * 100)
}

/** "up 47%" / "down 12%" / "about the same" / "" when there is nothing to compare. */
export function describeChange(visitors: number | null, previous: number | null): string {
  if (visitors === null || previous === null) return ''
  const change = percentChange(visitors, previous)
  if (change === null) return previous === 0 && visitors > 0 ? 'first traffic recorded' : ''
  if (Math.abs(change) < 5) return 'about the same as last week'
  return change > 0 ? `up ${change}% on last week` : `down ${Math.abs(change)}% on last week`
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-AU')} ${word}${count === 1 ? '' : 's'}`
}

/**
 * Order for reading: the sites with real traffic first, biggest first, then
 * the quiet ones, then anything that could not be measured. A report that
 * opens with a site nobody visits is a report nobody finishes.
 */
export function orderForReading(rows: readonly BrandTraffic[]): BrandTraffic[] {
  return [...rows].sort((a, b) => {
    const aHas = a.visitors !== null
    const bHas = b.visitors !== null
    if (aHas !== bHas) return aHas ? -1 : 1
    return (b.visitors ?? 0) - (a.visitors ?? 0)
  })
}

export function buildWeeklyTrafficText(rows: readonly BrandTraffic[], weekEnding: string): string {
  const ordered = orderForReading(rows)
  const measured = ordered.filter((row) => row.visitors !== null)
  const totalVisitors = measured.reduce((sum, row) => sum + (row.visitors ?? 0), 0)

  const lines: string[] = [
    `Website visitors — week ending ${weekEnding}`,
    '',
  ]

  if (measured.length === 0) {
    lines.push('No visitor numbers could be read this week.')
  } else {
    lines.push(`${plural(totalVisitors, 'visitor')} across ${measured.length} site${measured.length === 1 ? '' : 's'}.`)
    lines.push('')
  }

  for (const row of ordered) {
    if (row.visitors === null) {
      lines.push(`${row.brand} — no numbers${row.note ? ` (${row.note})` : ''}`)
      continue
    }

    const change = describeChange(row.visitors, row.previousVisitors)
    lines.push(
      `${row.brand} — ${plural(row.visitors, 'visitor')}, ${plural(row.pageviews ?? 0, 'page view')}${change ? `, ${change}` : ''}`,
    )

    const referrer = row.topReferrers?.[0]
    if (referrer && referrer.label !== '(direct / none)') {
      lines.push(`   most came from ${referrer.label}`)
    }
    const page = row.topPages?.[0]
    if (page) {
      lines.push(`   most-read page: ${page.label}`)
    }
  }

  return lines.join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The same thing as an email.
 *
 * Deliberately plain HTML with inline styles — every email client mangles
 * anything cleverer, and this has to be readable on a phone at 6am.
 */
export function buildWeeklyTrafficHtml(
  rows: readonly BrandTraffic[],
  weekEnding: string,
  vitalsSummary?: string,
): string {
  const ordered = orderForReading(rows)
  const measured = ordered.filter((row) => row.visitors !== null)
  const totalVisitors = measured.reduce((sum, row) => sum + (row.visitors ?? 0), 0)

  const cards = ordered.map((row) => {
    if (row.visitors === null) {
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#777">
        <strong style="color:#333">${escapeHtml(row.brand)}</strong><br>
        <span style="font-size:13px">no numbers${row.note ? ` — ${escapeHtml(row.note)}` : ''}</span>
      </td></tr>`
    }

    const change = describeChange(row.visitors, row.previousVisitors)
    const up = row.previousVisitors !== null && row.visitors > row.previousVisitors
    const changeColour = !change || change.includes('same') ? '#777' : up ? '#0a7d33' : '#b3261e'

    const detail: string[] = []
    const referrer = row.topReferrers?.[0]
    if (referrer && referrer.label !== '(direct / none)') {
      detail.push(`most came from <strong>${escapeHtml(referrer.label)}</strong>`)
    }
    const page = row.topPages?.[0]
    if (page) detail.push(`most-read: <strong>${escapeHtml(page.label)}</strong>`)

    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      <strong style="color:#111;font-size:16px">${escapeHtml(row.brand)}</strong>
      <div style="font-size:22px;font-weight:600;color:#111;margin:2px 0">
        ${row.visitors.toLocaleString('en-AU')}
        <span style="font-size:13px;font-weight:400;color:#777">visitors · ${(row.pageviews ?? 0).toLocaleString('en-AU')} views</span>
      </div>
      ${change ? `<div style="font-size:13px;color:${changeColour}">${escapeHtml(change)}</div>` : ''}
      ${detail.length > 0 ? `<div style="font-size:13px;color:#555;margin-top:4px">${detail.join(' · ')}</div>` : ''}
    </td></tr>`
  }).join('')

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111">
  <p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin:0">NotRealSmart</p>
  <h1 style="font-size:20px;margin:4px 0 2px">Website visitors</h1>
  <p style="color:#666;margin:0 0 16px;font-size:14px">Week ending ${escapeHtml(weekEnding)}</p>

  ${measured.length > 0
    ? `<p style="font-size:15px;margin:0 0 8px"><strong>${totalVisitors.toLocaleString('en-AU')}</strong> visitors across ${measured.length} site${measured.length === 1 ? '' : 's'}.</p>`
    : '<p style="font-size:15px">No visitor numbers could be read this week.</p>'}

  <table style="width:100%;border-collapse:collapse">${cards}</table>

  ${vitalsSummary ? `<h2 style="font-size:16px;margin:24px 0 6px">Site speed</h2>
  <pre style="font-family:inherit;white-space:pre-wrap;font-size:13px;color:#444;margin:0">${escapeHtml(vitalsSummary)}</pre>` : ''}

  <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
    Sent automatically by NotRealSmart every Monday. Numbers come from Vercel Web Analytics and match the dashboard.
  </p>
</div>`
}
