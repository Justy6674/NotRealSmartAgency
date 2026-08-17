/**
 * "What to write next" from the content plan — pillars the Director already
 * knows — minus topics that already have a post. Never invents a topic.
 */

export interface PlanIdea {
  title: string
  source: 'pillar'
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3)
}

function related(a: string, b: string): boolean {
  const left = tokens(a)
  const right = tokens(b)
  if (left.length === 0 || right.length === 0) return false
  let hits = 0
  for (const word of left) {
    if (right.some((other) => other === word || other.startsWith(word) || word.startsWith(other))) {
      hits += 1
    }
  }
  return hits >= 2 || (hits >= 1 && left.some((word) => word.length > 6 && right.some((other) => other.startsWith(word) || word.startsWith(other))))
}

export function ideasFromPlan(input: {
  pillars: string[]
  existingTitles: string[]
}): PlanIdea[] {
  const ideas: PlanIdea[] = []
  for (const pillar of input.pillars) {
    const title = pillar.trim()
    if (!title) continue
    if (input.existingTitles.some((existing) => related(title, existing))) continue
    ideas.push({ title, source: 'pillar' })
  }
  return ideas
}
