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

### ENGAGEMENT RATE BENCHMARKS BY PLATFORM (2026 Updated)

| Platform | Median | Good | Excellent | Trend |
|----------|--------|------|-----------|-------|
| Instagram | 5.4% (down from 7.3%) | 6–10% | >10% | 26% decline YoY — quality matters more |
| Facebook | 0.05% feed / 0.20% text-only | 0.5–1% | >1% | Text-only posts highest feed engagement |
| X (Twitter) | 3.56% text | 5–8% | >8% | Text outperforms video and links |
| LinkedIn | 6.2% overall / 21.77% carousels | 8–12% | >15% | Highest engagement of any platform |
| TikTok | 4.5% video / 1.92% images | 6–10% | >12% | Video still king, images lagging |
| Threads | 5.55% video / 4.55% images | 6–8% | >10% | Growing platform, high organic reach |
| Pinterest | 5.75% video / 3.15% images | 5–8% | >10% | Video outperforms static images |

### COMMENT REPLY ENGAGEMENT MULTIPLIER

Replying to comments on your own posts gives a measurable engagement lift:

| Platform | Lift from Replying |
|----------|--------------------|
| Threads | +42% |
| LinkedIn | +30% |
| Instagram | +21% |
| Facebook | +9.5% |
| X (Twitter) | +8% |

**Rule: ALWAYS reply to comments. This is the single highest-ROI activity after posting.**

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

### VIDEO FORMAT SPECIFICATIONS BY PLATFORM (2026 Updated)

| Platform | Format | Aspect Ratio | Duration | Max File | Notes |
|----------|--------|-------------|----------|----------|-------|
| Instagram Reels | MP4 | 9:16 | 15–90s | 250MB | Hook in 3s, 80% watch muted — captions mandatory |
| Instagram Feed | MP4 | 4:5 (NOT 1:1) | 3–60s | 250MB | Vertical > square. Grid is now 3:4 vertical. |
| TikTok | MP4 | 9:16 | 15–60s (sweet spot) | 287MB | 3s hook window, 8.2s avg attention span |
| YouTube Shorts | MP4 | 9:16 | 15–60s | 256MB | 73% avg retention, 75%+ = viral threshold |
| YouTube Long | MP4 | 16:9 | 2–10min (sweet spot) | 256GB | 23.7% avg retention, first 60s critical |
| LinkedIn | MP4 | 1:1 or 4:5 | 30–120s | 5GB | 3-min micro-lessons perform best |
| Facebook Reels | MP4 | 9:16 | 15–60s | 4GB | 38.4% of all Facebook time. 4-6 Reels/week = 41% follower growth. |
| Facebook Feed | MP4 | 4:5 or 1:1 | 15–240s | 4GB | Autoplay muted, captions essential |

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

### PLATFORM ALGORITHM INTELLIGENCE

#### TikTok Algorithm
- **Watch time is king.** Completion rate, rewatch rate, and early engagement (first 30-60 min) determine distribution.
- Content is served to small test audiences first, then expanded if engagement clears thresholds.
- Hook in 1-3 seconds is non-negotiable — the algorithm penalises early drop-off.
- Two-character dialogues (roaster + helper) drive high comment counts.
- Comments asking viewers to participate ("drop your X in the comments") are the highest-signal CTA because comment count directly feeds the algorithm.
- Use hashtags #fyp + 2-3 niche-specific tags. Don't spam generic tags.
- Default content to review before publishing — accidental posts destroy trust.

#### Instagram Algorithm (2026)
- **Saves and shares are weighted higher than likes.** Optimise for saves (reference content, checklists, tips).
- Carousels get re-served when users swipe (counts as re-engagement) — 8-12 slides ideal. Carousels drive 109% more engagement per reach than Reels.
- Reels get preferential distribution. Reels = 46% of time on Instagram, 30.81% average reach. But carousel engagement per impression is higher.
- **Hashtags are dead for discovery.** Instagram removed "follow hashtag." Use 3-5 relevant tags max. Write captions as searchable mini-blogs.
- Instagram grid switched from 1:1 to 3:4 vertical (1015x1350). Design everything vertically.
- Scrapbook-style aesthetic is dominant — ripped paper, Polaroid, handwritten fonts. Counters AI-polished look.
- TTS narration with on-screen text performs well for Reels.

#### LinkedIn Algorithm (2026)
- **Dwell time** (how long people read) and **long-form comments** drive distribution. Saves and comments outweigh likes.
- **Carousels are king:** 21.77% engagement (vs 7.35% video, 6.52% images). Upload as multi-page PDF (native carousel removed).
- PDF specs: 1080x1350 (portrait) or 1080x1080, under 3MB, 8-12 slides max.
- **Slide 2 drop-off is steepest.** Use pattern interrupt: change background colour, bold stat, controversial statement.
- Mix content types — never two consecutive posts of the same type.
- Sound like a founder, not a marketing department. Thought leadership generates 2x more engagement than company-centric posts.
- Only ~30% of posts should reference the brand. The rest is pure value.
- **Hashtags no longer work for discovery.** Natural keywords in copy matter more. Minor categorisation signal only.
- Replying to comments gives +30% engagement lift.

#### Facebook Algorithm
- **Group engagement is where organic reach still exists.** Brand page organic reach is near zero.
- Group posts get algorithmic distribution when comments from real accounts trigger expansion.
- Target relevant community groups by niche. Contribute genuinely helpful comments.
- Page posts require paid amplification for any meaningful reach.

#### X / Twitter Algorithm
- **Replies to high-engagement accounts get algorithmic visibility.** Threads get re-served tweet by tweet.
- The algorithm favours accounts that generate genuine conversation (replies, quote tweets) over broadcast-only.
- Punchy replies under 250 characters perform best — opinionated, personality-driven.
- Threads: exactly 7 tweets: hook, 5 value items (each standalone), CTA.
- No em-dashes (AI tell). No hashtags in replies. 7th-grade reading level.
- Only 10-20% of replies should mention the brand. The rest is pure value.
- Pain-signal search (people tweeting about the problem your product solves) is the highest-signal discovery method.

#### YouTube Algorithm
- **Click-through rate on thumbnails + watch time** are the two primary signals.
- Shorts (<60s) get separate algorithmic treatment from long-form.
- First 30 seconds determine whether the algorithm continues serving the video.
- Title and thumbnail are more important than the video content for initial distribution.

### CROSS-PLATFORM GROWTH TACTICS

- **Content capsule model:** Generate once, publish everywhere. A single piece of content (video, thread, post) is packaged as a self-contained capsule. Cross-posting reuses the same media with platform-specific formatting.
- **Repurposing chain:** Video → Reel + Short + TikTok → Caption → Twitter thread → LinkedIn post → Blog section.
- **Anti-AI detection:** Strip em-dashes, en-dashes from all text. Avoid words: "game-changer", "revolutionise", "leverage", "delve", "tapestry", "landscape". Add grain/texture to AI images — audiences detect synthetic skin, impossible lighting, overly symmetrical compositions. "Proof of Human" achieves 22% higher viewer satisfaction.
- **Feedback loop:** Tag published content with IDs, fetch analytics after publishing, run sentiment analysis, generate permanent content guidelines, feed those back into future generation. The system improves with every publish cycle.
- **The "No-Post Penalty":** Accounts posting 10+ times weekly gain ~32 additional followers/week vs silent weeks. The biggest gap is between posting and not posting.
- **Strong Creative Effect:** 85% of global marketing spend goes to unnoticed assets. Strong creative reduces Cost-Per-Result by 20-40%.
- **Meme Marketing:** $6.1B industry. Meme campaigns achieve 60% organic engagement vs 5% for standard graphics. 78% of Gen Z more likely to buy from brands with authentic meme engagement. For health brands: keep memes about the business experience, NEVER about clinical outcomes.
- **Platform defaults:** Video → Instagram + LinkedIn + YouTube. Images → Instagram + LinkedIn. Threads → Twitter. Articles → LinkedIn. Text posts → Twitter + LinkedIn.
- **Mention strategy:** Only ~10-20% of engagement should mention the brand. The rest must be genuinely helpful with zero agenda. When mentioning, rotate angles: never say "check out" or "you should try".

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
      'PLATFORM ALGORITHM INTELLIGENCE',
    ],
    content: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'CONTENT TYPE PERFORMANCE BY PLATFORM',
      'VIDEO SCRIPTING BEST PRACTICES',
      'OPTIMAL POSTING TIMES',
      'PERFORMANCE CATEGORIES',
      'PLATFORM ALGORITHM INTELLIGENCE',
      'CROSS-PLATFORM GROWTH TACTICS',
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
      'PLATFORM ALGORITHM INTELLIGENCE',
      'CROSS-PLATFORM GROWTH TACTICS',
    ],
    overall: [
      'ENGAGEMENT RATE BENCHMARKS BY PLATFORM',
      'PAID MEDIA COST BENCHMARKS',
      'PERFORMANCE CATEGORIES',
      'ROI INTERPRETATION',
      'PROACTIVE TRIGGERS',
      'CROSS-PLATFORM GROWTH TACTICS',
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
