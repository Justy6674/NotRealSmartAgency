import type { VitalsResult } from './pagespeed'
import { gradeLcp, gradeInp, gradeCls } from './pagespeed'

/**
 * The weekly note that lands in Telegram.
 *
 * Written to be read on a phone by someone who is not a developer: worst site
 * first, plain sentences, and a number only where it changes what to do. A
 * table of twenty-one metrics is not a report, it is homework.
 */

const MARK: Record<string, string> = { good: '🟢', 'needs-work': '🟠', poor: '🔴', 'no-data': '⚪' }

const RANK: Record<string, number> = { poor: 0, 'needs-work': 1, 'no-data': 2, good: 3 }

function describe(result: VitalsResult): string {
  if (result.error) return `${MARK['no-data']} ${result.brand} — couldn't measure (${result.error.slice(0, 60)})`

  const lines: string[] = []
  if (!result.field) {
    // Not a fault. A quiet site simply has too few Chrome users to qualify.
    lines.push(`${MARK['no-data']} ${result.brand} — not enough real visitors yet for Google to grade it`)
    if (result.lab) lines.push(`   lab score ${result.lab.performance}/100`)
  } else {
    const { lcp, inp, cls } = result.field
    lines.push(`${MARK[result.verdict]} ${result.brand}`)
    if (lcp !== null) lines.push(`   loads in ${(lcp / 1000).toFixed(1)}s ${MARK[gradeLcp(lcp)]}`)
    if (inp !== null) lines.push(`   responds in ${inp}ms ${MARK[gradeInp(inp)]}`)
    if (cls !== null) lines.push(`   layout shift ${cls.toFixed(2)} ${MARK[gradeCls(cls)]}`)
  }

  if (result.verdict !== 'good' && result.opportunities.length > 0) {
    const top = result.opportunities[0]
    lines.push(`   biggest win: ${top.title} (~${(top.savingsMs / 1000).toFixed(1)}s)`)
  }
  return lines.join('\n')
}

export function buildWeeklyReport(results: VitalsResult[]): string {
  const mobile = results.filter((r) => r.strategy === 'mobile')
  const failing = mobile.filter((r) => r.verdict === 'poor' || r.verdict === 'needs-work')
  const passing = mobile.filter((r) => r.verdict === 'good')

  const header =
    failing.length === 0
      ? passing.length > 0
        ? `Site speed — all ${passing.length} graded sites are passing Google's Core Web Vitals.`
        : 'Site speed — no site has enough real visitors yet for Google to grade it.'
      : `Site speed — ${failing.length} of ${mobile.length} sites need attention.`

  const ordered = [...mobile].sort((a, b) => (RANK[a.verdict] ?? 9) - (RANK[b.verdict] ?? 9))

  return [
    header,
    '',
    'On mobile, from real Chrome users over the last 28 days:',
    '',
    ...ordered.map(describe),
    '',
    failing.length > 0
      ? 'Reply here and I will take the worst one and tell you exactly what to change.'
      : 'Nothing needs doing this week.',
  ].join('\n')
}
