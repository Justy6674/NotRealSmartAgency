export type SlideTemplate = 'intro' | 'content' | 'quote' | 'stat' | 'cta' | 'image'

export interface SlideDefinition {
  id: string
  template: SlideTemplate
  title: string
  subtitle: string
  body: string
  imageUrl: string
  stat: string
  statLabel: string
}

export interface BrandTheme {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  logoUrl: string | null
  name: string
}

export function createEmptySlide(template: SlideTemplate = 'content'): SlideDefinition {
  return {
    id: crypto.randomUUID(),
    template,
    title: '',
    subtitle: '',
    body: '',
    imageUrl: '',
    stat: '',
    statLabel: '',
  }
}

export const TEMPLATE_OPTIONS: { value: SlideTemplate; label: string; description: string }[] = [
  { value: 'intro', label: 'Intro', description: 'Brand logo + title' },
  { value: 'content', label: 'Content', description: 'Title + body text' },
  { value: 'quote', label: 'Quote', description: 'Large quote text' },
  { value: 'stat', label: 'Statistic', description: 'Big number + label' },
  { value: 'cta', label: 'Call to Action', description: 'CTA + handle' },
  { value: 'image', label: 'Image', description: 'Full image + overlay' },
]
