import Image from 'next/image'
import { AlertTriangle, CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_TEXT } from '@/lib/ui/status-tone'
import { PlatformHealthChip } from './PlatformHealthChip'
import { ConnectViaZernio } from './IntegrationsActions'
import { loadIntegrationsSnapshot, type BrandRoute, type PublisherStatus } from './integrations-data'

/**
 * Which path each brand's posts take, and whether that path currently works.
 *
 * Grouped by publisher rather than laid out as one tile per brand, because the
 * fact worth reading is not "here are your brands" — it is which of the two
 * paths each brand is on. Sitting a brand physically underneath its publisher
 * is the shortest way to say that.
 */

/* One source for these — the same file the chips, the inbox and the ads ledger
   read from. They were three constants here and a Tailwind palette elsewhere. */
const ATTENTION_TEXT = TONE_TEXT.attention
const UNKNOWN_TEXT = TONE_TEXT.unknown
const CONNECTED_TEXT = TONE_TEXT.positive

function brandVerdict(route: BrandRoute): { text: string; tone: string } {
  if (!route.known) return { text: 'Not checked', tone: UNKNOWN_TEXT }
  if (route.platforms.length === 0) return { text: 'No accounts', tone: UNKNOWN_TEXT }
  const needing = route.platforms.filter((p) => p.state === 'attention').length
  if (needing > 0) {
    return { text: `${needing} needs attention`, tone: ATTENTION_TEXT }
  }
  return {
    text: `${route.platforms.length} posting`,
    tone: CONNECTED_TEXT,
  }
}

function BrandRow({ route }: { route: BrandRoute }) {
  const verdict = brandVerdict(route)
  const problems = route.platforms.filter((p) => p.problem)
  const handles = route.platforms.map((p) => p.handle).filter(Boolean) as string[]

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        {route.logoUrl ? (
          <Image
            src={route.logoUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded object-contain"
            unoptimized
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">
            {route.name.slice(0, 2).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{route.name}</p>

          {route.known && route.platforms.length > 0 ? (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {route.platforms.map((platform) => (
                  <PlatformHealthChip
                    key={`${platform.key}-${platform.handle ?? ''}`}
                    label={platform.label}
                    state={platform.state}
                  />
                ))}
              </div>
              {handles.length > 0 && (
                <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{handles.join('  ·  ')}</p>
              )}
            </>
          ) : (
            <p className={cn('mt-1 text-xs', UNKNOWN_TEXT)}>
              {route.known
                ? 'Nothing is connected for this brand, so nothing scheduled for it can go out.'
                : 'The publisher did not answer, so this brand’s accounts are unknown — not confirmed working, and not confirmed broken.'}
            </p>
          )}
        </div>

        <span className={cn('shrink-0 text-xs font-medium', verdict.tone)}>{verdict.text}</span>
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1.5 pl-11">
          {problems.map((platform) => (
            <li
              key={`problem-${platform.key}-${platform.handle ?? ''}`}
              className={cn('flex items-start gap-2 text-xs leading-relaxed', ATTENTION_TEXT)}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{platform.problem}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function PanelHeader({
  name,
  role,
  status,
  count,
}: {
  name: string
  role: string
  status?: PublisherStatus
  count: string
}) {
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-foreground">{name}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{role}</p>
      {status?.problem && (
        <p className={cn('mt-2 flex items-start gap-2 text-xs leading-relaxed', status.reachable === false ? ATTENTION_TEXT : UNKNOWN_TEXT)}>
          {status.reachable === false ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>{status.problem}</span>
        </p>
      )}
    </div>
  )
}

export async function IntegrationsHub({ userId }: { userId: string }) {
  const snapshot = await loadIntegrationsSnapshot(userId)

  const onZernio = snapshot.brands.filter((b) => b.publisher === 'zernio')
  const onMixpost = snapshot.brands.filter((b) => b.publisher === 'mixpost')
  const unrouted = snapshot.brands.filter((b) => b.publisher === 'none')

  const total = snapshot.brands.length
  const needingAttention = snapshot.brands.reduce(
    (n, b) => n + b.platforms.filter((p) => p.state === 'attention').length,
    0,
  )

  return (
    <div className="space-y-6">
      {/* ── What is true right now, in one sentence ───────────────────────── */}
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {onZernio.length === 0 ? (
          <>
            Every one of your {total} brands publishes through Mixpost. No brand records a Zernio profile, so the
            publisher never picks Zernio — regardless of what is signed in at Zernio’s end.
          </>
        ) : (
          <>
            {onZernio.length} of {total} brands publish through Zernio; {onMixpost.length} through Mixpost. A brand
            takes the Zernio path on any platform it has connected there, and Mixpost everywhere else.
          </>
        )}
        {needingAttention > 0 && (
          <>
            {' '}
            <span className={cn('font-medium', ATTENTION_TEXT)}>
              {needingAttention} account{needingAttention === 1 ? '' : 's'} need
              {needingAttention === 1 ? 's' : ''} attention.
            </span>
          </>
        )}
      </p>

      {/* ── Zernio ────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <PanelHeader
          name="Zernio"
          role="Reports per-platform health: whether each account can actually post, and when its access expires. In trial on one brand."
          status={snapshot.zernio}
          count={
            onZernio.length === 0
              ? 'No brands'
              : `${onZernio.length} brand${onZernio.length === 1 ? '' : 's'}`
          }
        />

        {onZernio.length > 0 ? (
          <ul className="divide-y divide-border">
            {onZernio.map((route) => (
              <BrandRow key={route.id} route={route} />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-6">
            <p className="max-w-2xl text-sm text-foreground">
              No brand routes through Zernio yet.
            </p>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Mixpost tells you only whether a connection has lapsed. A brand moved onto Zernio gets the answer this
              page exists for: per platform, whether the account can post today, and the date its access runs out —
              before it runs out, rather than after a week of silence.
            </p>
          </div>
        )}

        {/* Accounts that are genuinely connected and genuinely unused. This is
            the exact shape of the problem the owner has been burned by, so it
            is stated rather than left for him to infer from a zero. */}
        {snapshot.unclaimed.map((profile) => (
          <div
            key={profile.profileId}
            className="border-t border-border bg-[oklch(0.52_0.11_65/0.06)] px-4 py-3.5 dark:bg-[oklch(0.82_0.15_75/0.07)]"
          >
            <p className={cn('flex items-start gap-2 text-xs font-medium', ATTENTION_TEXT)}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Signed in to Zernio, attached to no brand</span>
            </p>
            <p className="mt-1.5 max-w-3xl pl-5 text-xs leading-relaxed text-muted-foreground">
              {profile.platforms.join(', ')}{' '}
              {profile.platforms.length === 1 ? 'is' : 'are'} connected under Zernio profile{' '}
              <span className="font-mono">{profile.profileId}</span>
              {profile.usernames.length > 0 && (
                <>
                  {' '}(<span className="font-mono">{profile.usernames.join(', ')}</span>)
                </>
              )}
              . No brand here records that profile, so nothing publishes to{' '}
              {profile.usernames.length > 0 ? 'those accounts' : 'them'}. Signing a brand in below creates a new,
              separate Zernio profile for it — it does not adopt this one.
            </p>
          </div>
        ))}

        {snapshot.zernio.configured && (
          <div className="px-4 pb-5">
            <ConnectViaZernio
              brands={snapshot.brands.map((b) => ({ id: b.id, name: b.name }))}
              defaultBrandId={onZernio[0]?.id}
            />
          </div>
        )}
      </section>

      {/* ── Mixpost ───────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <PanelHeader
          name="Mixpost"
          role="Self-hosted, and the default path for everything not on Zernio. It reports whether a connection has lapsed and nothing more — no expiry date, no per-platform capability."
          status={snapshot.mixpost}
          count={
            onMixpost.length === 0
              ? 'No brands'
              : `${onMixpost.length} brand${onMixpost.length === 1 ? '' : 's'}`
          }
        />

        {onMixpost.length > 0 ? (
          <ul className="divide-y divide-border">
            {onMixpost.map((route) => (
              <BrandRow key={route.id} route={route} />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-6">
            <p className="max-w-2xl text-sm text-foreground">No brand has social accounts in Mixpost.</p>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Mixpost is where accounts are signed in for every brand not on Zernio. Until one is connected there,
              approved posts have nowhere to go and will sit as drafts.
            </p>
          </div>
        )}
      </section>

      {/* ── Nowhere to publish ────────────────────────────────────────────── */}
      {unrouted.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            name="No publisher"
            role="These brands have no Zernio profile and no social account matched to them in Mixpost. Anything approved for them has nowhere to go, and will wait as a draft rather than fail loudly."
            count={`${unrouted.length} brand${unrouted.length === 1 ? '' : 's'}`}
          />
          <div className="flex flex-wrap gap-1.5 px-4 py-4">
            {unrouted.map((route) => (
              <PlatformHealthChip key={route.id} label={route.name} state="absent" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
