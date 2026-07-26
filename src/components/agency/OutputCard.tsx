'use client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OUTPUT_LABELS } from '@/types/database'
import type { Output } from '@/types/database'

interface OutputCardProps {
  output: Output & { brands?: { name: string; slug: string } }
}

export function OutputCard({ output }: OutputCardProps) {
  const label = OUTPUT_LABELS[output.output_type] ?? output.output_type

  // Safe type casting for metadata since JSONB could be anything
  const metadata = (output.metadata || {}) as Record<string, unknown>
  const videoUrl = metadata.video_url as string | undefined
  const status = metadata.status as string | undefined

  // Compliance metadata
  const compliance = metadata.compliance as { flags?: string[]; warnings?: string[] } | undefined

  return (
    <Card className="p-4 space-y-2 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-1">{output.title}</h3>
        <Badge variant="outline" className="shrink-0 text-xs">
          {label}
        </Badge>
      </div>
      {output.brands && (
        <p className="text-xs text-muted-foreground">{output.brands.name}</p>
      )}

      {compliance && (compliance.flags?.length || compliance.warnings?.length) ? (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-700 dark:text-amber-400">
          <p className="font-semibold">Compliance Flags:</p>
          <ul className="list-disc list-inside ml-4">
            {compliance.flags?.map((f: string, i: number) => <li key={`f-${i}`}>{f}</li>)}
            {compliance.warnings?.map((w: string, i: number) => <li key={`w-${i}`}>{w}</li>)}
          </ul>
        </div>
      ) : null}

      {output.output_type === 'video' && videoUrl ? null : (
        <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
          {output.content}
        </p>
      )}

      {output.output_type === 'video' && (
        <div className="mt-2 space-y-2">
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full rounded-md bg-black" />
          ) : (
            <div className="p-4 bg-muted/50 rounded-md text-center">
              <p className="text-xs">Status: {status || 'processing'}</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-auto pt-2">
        {new Date(output.created_at).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </Card>
  )
}
