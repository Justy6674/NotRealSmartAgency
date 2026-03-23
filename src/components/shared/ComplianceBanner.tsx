import { Info } from 'lucide-react'

interface ComplianceBannerProps {
  type?: 'footer' | 'ai' | 'document' | 'scanner'
  className?: string
}

const messages = {
  footer: 'This platform provides general business information for Australian healthcare practitioners. Not legal, financial, clinical, or regulatory advice.',
  ai: 'This is general information only — verify with your regulatory advisor.',
  document: 'TEMPLATE — NOT LEGAL ADVICE. Have this document reviewed by a qualified legal professional before use.',
  scanner: 'Potential issues flagged for review. Each finding may warrant review — this is not a definitive legal determination.',
}

export function ComplianceBanner({ type = 'footer', className }: ComplianceBannerProps) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground ${className ?? ''}`}>
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <p>{messages[type]}</p>
    </div>
  )
}
