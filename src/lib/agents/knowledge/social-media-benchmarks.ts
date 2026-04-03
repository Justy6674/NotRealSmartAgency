/**
 * Social Media Intelligence — Platform benchmarks, engagement metrics,
 * ROI calculations, and video format specifications.
 *
 * Sourced from industry data (2024–2026), adapted for Australian health/SaaS brands.
 * Injected into agent prompts via getSocialMediaKnowledge(agentType).
 */

const SOCIAL_MEDIA_KNOWLEDGE = `## Social Media Intelligence & Platform Benchmarks

### ENGAGEMENT METRICS — FORMULAS

| Metric | Formula | What It Tells You |
|--------|---------|-------------------|
| Engagement Rate | (Likes + Comments + Shares + Saves) / Reach × 100 | Audience interaction level |
| Click-Through Rate (CTR) | Clicks / Impressions × 100 | Content click appeal |
| Reach Rate | Reach / Followers × 100 | Content distribution effectiveness |
| Virality Rate | Shares / Impressions × 100 | Share-worthiness |
| Save Rate | Saves / Reach × 100 | Content value / intent signal |
| Cost Per Engagement (CPE) | Total Spend / Total Engagements | Paid efficiency |
| Cost Per Click (CPC) | Total Spend / Total Clicks | Traffic acquisition cost |
| Cost Per Thousand (CPM) | (Spend / Impressions) × 1000 | Awareness cost |
| Return on Ad Spend (ROAS) | Revenue / Ad Spend | Campaign profitability |

### ENGAGEMENT VALUE ESTIMATES

| Action | Estimated Value | Why |
|--------|----------------|-----|
| Like | $0.50 | Brand awareness signal |
| Comment | $2.00 | Active engagement / conversation |
| Share | $5.00 | Amplification / earned reach |
| Save | $3.00 | High intent signal / future reference |
| Click | $1.50 | Traffic / conversion pathway |

### ENGAGEMENT RATE BENCHMARKS BY PLATFORM

| Platform | Average | Good | Excellent |
|----------|---------|------|-----------|
| Instagram | 1.22% | 3–6% | >6% |
| Facebook | 0.07% | 0.5–1% | >1% |
| X (Twitter) | 0.05% | 0.1–0.5% | >0.5% |
| LinkedIn | 2.0% | 3–5% | >5% |
| TikTok | 5.96% | 8–15% | >15% |

### CTR BENCHMARKS BY PLATFORM

| Platform | Organic Avg | Paid Avg | Good Paid |
|----------|-------------|----------|-----------|
| Instagram | 0.22% | 0.4% | >1% |
| Facebook | 0.15% | 0.90% | >2.5% |
| LinkedIn | 0.44% | 0.8% | >2% |
| TikTok | 0.30% | 0.5% | >1% |

### PAID MEDIA COST BENCHMARKS (AUD)

| Platform | Avg CPC | Good CPC | Avg CPM | Health CPM |
|----------|---------|----------|---------|------------|
| Facebook | $1.30 | <$0.70 | $14 | $18–$30 |
| Instagram | $1.60 | <$0.90 | $16 | $20–$35 |
| LinkedIn | $7.00 | <$4.00 | $35 | $40–$60 |
| TikTok | $1.30 | <$0.70 | $12 | $15–$25 |
| Google (Search) | $3.86 | <$2.50 | — | — |

### PERFORMANCE CATEGORIES

| Rating | Engagement Rate | Action Required |
|--------|----------------|----------------|
| Excellent | >6% | Scale budget, replicate format |
| Good | 3–6% | Optimise, expand reach |
| Average | 1–3% | Test improvements, A/B creative |
| Poor | <1% | Analyse and pivot — content isn't resonating |

### ROI INTERPRETATION

| ROI % | Rating | Recommendation |
|-------|--------|----------------|
| >500% | Excellent | Scale budget significantly |
| 200–500% | Good | Increase budget moderately |
| 100–200% | Acceptable | Optimise before scaling |
| 0–100% | Break-even | Review targeting and creative |
| <0% | Negative | Pause and restructure |

### VIDEO FORMAT SPECIFICATIONS BY PLATFORM

| Platform | Format | Aspect Ratio | Duration | Max File | Notes |
|----------|--------|-------------|----------|----------|-------|
| Instagram Reels | MP4 | 9:16 | 15–90s | 250MB | Hook in first 3s, captions mandatory |
| Instagram Feed | MP4 | 1:1 or 4:5 | 3–60s | 250MB | Thumbnail matters, first 3s autoplay |
| TikTok | MP4 | 9:16 | 15–60s (sweet spot) | 287MB | Native feel > polished, trending audio |
| YouTube Shorts | MP4 | 9:16 | 15–60s | 256MB | First frame = thumbnail, loop-friendly |
| YouTube Long | MP4 | 16:9 | 2–10min (sweet spot) | 256GB | Chapters, retention hooks every 30s |
| LinkedIn | MP4 | 1:1 or 16:9 | 30–120s | 5GB | Professional tone, captions, thought leadership |
| Facebook Reels | MP4 | 9:16 | 15–60s | 4GB | Similar to Instagram Reels |
| Facebook Feed | MP4 | 16:9 or 1:1 | 15–240s | 4GB | Autoplay without sound, captions essential |

### VIDEO ENGAGEMENT BENCHMARKS

| Platform | Avg View Rate | Good View Rate | Avg Completion | Good Completion |
|----------|--------------|----------------|----------------|-----------------|
| Instagram Reels | 15% | >30% | 25% | >50% |
| TikTok | 20% | >40% | 30% | >60% |
| YouTube Shorts | 12% | >25% | 20% | >45% |
| LinkedIn Video | 8% | >20% | 15% | >35% |

### VIDEO SCRIPTING BEST PRACTICES

1. **Hook (0–3 seconds)**: Question, bold claim, or visual interrupt. 65% of viewers drop off if no hook.
2. **Problem (3–8 seconds)**: State the pain point. Use "you" language, not "we".
3. **Solution (8–20 seconds)**: Your product/service as the answer. Show, don't tell.
4. **Proof (20–35 seconds)**: Social proof, stats, or demonstrations. For AHPRA brands: evidence-based, no testimonials.
5. **CTA (last 5 seconds)**: One clear action. "Book a consult", "Try free", "Learn more".

### CONTENT TYPE PERFORMANCE BY PLATFORM

| Content Type | Instagram | TikTok | LinkedIn | YouTube |
|-------------|-----------|--------|----------|---------|
| Talking head | ★★★ | ★★★★★ | ★★★★★ | ★★★★ |
| Screen recording | ★★ | ★★★ | ★★★★ | ★★★★★ |
| Text overlay + B-roll | ★★★★ | ★★★★ | ★★★ | ★★★ |
| Animated explainer | ★★★ | ★★★ | ★★★★ | ★★★★★ |
| Before/After | ★★★★★ | ★★★★★ | ★★ | ★★★★ |
| User-generated | ★★★★★ | ★★★★★ | ★★ | ★★★ |

**AHPRA WARNING**: Before/After and User-generated (testimonial) content is PROHIBITED for AHPRA-regulated brands. Use "Journey" framing instead — show the service experience, not clinical outcomes.

### OPTIMAL POSTING TIMES (AEST)

| Platform | Best Days | Best Times | Worst Times |
|----------|-----------|------------|-------------|
| Instagram | Tue, Wed, Thu | 7–9am, 12–1pm, 7–9pm | 3–5am |
| TikTok | Tue, Thu, Fri | 10am–12pm, 7–9pm | 1–4am |
| LinkedIn | Tue, Wed, Thu | 7–8am, 12pm, 5–6pm | Weekends |
| YouTube | Thu, Fri, Sat | 2–4pm (publish), 6–9pm (peak views) | Mon morning |
| Facebook | Wed, Thu, Fri | 9–11am, 1–3pm | Late night |

### PROACTIVE TRIGGERS

- **Engagement rate below platform average** → Content isn't resonating. Analyse top performers for patterns.
- **High impressions, low engagement** → Reach without resonance. Content quality or targeting issue.
- **Follower growth stalled** → Content distribution or frequency problem. Audit posting patterns.
- **Video completion rate <20%** → Hook is weak or content too long. Shorten and front-load value.
- **CPC rising month-over-month** → Ad fatigue. Refresh creative, test new audiences.
- **Competitor outperforming significantly** → Content gap. Analyse their successful posts and formats.`

/**
 * Returns social media knowledge sections relevant to a specific agent type.
 */
export function getSocialMediaKnowledge(agentType: string): string | null {
  const agentSections: Record<string, string[]> = {
    video: [
      'VIDEO FORMAT SPECIFICATIONS BY PLATFORM',
      'VIDEO ENGAGEMENT BENCHMARKS',
      'VIDEO SCRIPTING BEST PRACTICES',
      'CONTENT TYPE PERFORMANCE BY PLATFORM',
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'OPTIMAL POSTING TIMES',
    ],
    content: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'CONTENT TYPE PERFORMANCE BY PLATFORM',
      'VIDEO SCRIPTING BEST PRACTICES',
      'OPTIMAL POSTING TIMES',
      'PERFORMANCE CATEGORIES',
    ],
    analytics: [
      'ENGAGEMENT METRICS — FORMULAS',
      'ENGAGEMENT VALUE ESTIMATES',
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'CTR BENCHMARKS BY PLATFORM',
      'PAID MEDIA COST BENCHMARKS',
      'ROI INTERPRETATION',
      'VIDEO ENGAGEMENT BENCHMARKS',
    ],
    paid_ads: [
      'PAID MEDIA COST BENCHMARKS',
      'CTR BENCHMARKS BY PLATFORM',
      'ROI INTERPRETATION',
      'PERFORMANCE CATEGORIES',
      'VIDEO ENGAGEMENT BENCHMARKS',
    ],
    growth: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'ENGAGEMENT VALUE ESTIMATES',
      'CONTENT TYPE PERFORMANCE BY PLATFORM',
      'PROACTIVE TRIGGERS',
    ],
    overall: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'PAID MEDIA COST BENCHMARKS',
      'PERFORMANCE CATEGORIES',
      'ROI INTERPRETATION',
      'PROACTIVE TRIGGERS',
    ],
    strategy: [
      'PAID MEDIA COST BENCHMARKS',
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'ROI INTERPRETATION',
      'PERFORMANCE CATEGORIES',
    ],
    competitor: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'PAID MEDIA COST BENCHMARKS',
      'CTR BENCHMARKS BY PLATFORM',
    ],
  }

  const sections = agentSections[agentType]
  if (!sections) return null

  // Extract relevant sections from the knowledge base
  const lines = SOCIAL_MEDIA_KNOWLEDGE.split('\n')
  const relevantSections: string[] = []
  let capturing = false

  for (const line of lines) {
    if (line.startsWith('### ')) {
      const sectionName = line.replace('### ', '').split('—')[0].trim()
      capturing = sections.some(s => sectionName.toUpperCase().includes(s.toUpperCase()))
    }
    if (capturing) {
      relevantSections.push(line)
    }
  }

  if (relevantSections.length === 0) return null
  return `## Social Media & Video Intelligence\n\n${relevantSections.join('\n')}`
}
