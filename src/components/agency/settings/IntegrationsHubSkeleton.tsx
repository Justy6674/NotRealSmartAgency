/**
 * Shaped like the answer, not like a spinner.
 *
 * Reaching Zernio and Mixpost takes as long as they take, and a spinner in the
 * middle of the page says only "wait". This says "two publishers are being
 * asked about, and each has brands under it" before either has replied, so the
 * page does not rearrange itself once they do.
 */
function BrandRowSkeleton({ chips }: { chips: number }) {
  return (
    <li className="flex items-start gap-3 p-4">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded bg-muted/60" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-3.5 w-36 animate-pulse rounded bg-muted/60" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: chips }).map((_, i) => (
            <div key={i} className="h-6 w-24 animate-pulse rounded-full bg-muted/40" />
          ))}
        </div>
      </div>
      <div className="h-3 w-20 shrink-0 animate-pulse rounded bg-muted/40" />
    </li>
  )
}

function PanelSkeleton({ rows }: { rows: number[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
        <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-muted/40" />
      </div>
      <ul className="divide-y divide-border">
        {rows.map((chips, i) => (
          <BrandRowSkeleton key={i} chips={chips} />
        ))}
      </ul>
    </section>
  )
}

export function IntegrationsHubSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Checking Zernio and Mixpost for every brand.</span>
      <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-muted/40" />
      <PanelSkeleton rows={[4]} />
      <PanelSkeleton rows={[3, 2, 3]} />
    </div>
  )
}
