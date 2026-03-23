'use client'

import type { Brand } from '@/types/database'

interface QuickActionsProps {
  brand?: Brand | null
  onAction: (message: string) => void
}

interface ActionChip {
  label: string
  message: string
}

export function QuickActions({ brand, onAction }: QuickActionsProps) {
  const chips: ActionChip[] = [
    {
      label: 'Run marketing audit',
      message:
        'Run a comprehensive marketing audit for my brand. Scan our website, check social media presence, and analyse our competitive position.',
    },
    {
      label: 'Write content',
      message:
        'Help me write compelling content for my brand. I need ideas for social media posts, a blog article, and a short bio.',
    },
    {
      label: 'Plan a campaign',
      message:
        'Help me plan a marketing campaign for my brand. Include goals, target audience, channels, timeline, and key messages.',
    },
  ]

  if (brand?.compliance_flags?.ahpra || brand?.compliance_flags?.tga) {
    chips.push({
      label: 'Check compliance',
      message:
        'Review our brand and website content for AHPRA and TGA compliance. Flag any issues and suggest corrections.',
    })
  }

  if (brand?.website_url) {
    chips.push({
      label: 'Scan our website',
      message: `Scan our website at ${brand.website_url} and provide a detailed report on SEO, content quality, conversion optimisation, and compliance.`,
    })
  }

  chips.push({
    label: 'Analyse competitors',
    message:
      'Analyse our top competitors. Look at their positioning, messaging, strengths, weaknesses, and identify gaps we can exploit.',
  })

  return (
    <div className="flex flex-wrap justify-center gap-2" role="list">
      {chips.map((chip) => (
        <button
          key={chip.label}
          role="listitem"
          onClick={() => onAction(chip.message)}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
