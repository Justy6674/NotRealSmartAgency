'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, Copy, Download, Loader2 } from 'lucide-react'
import { DepartmentTabs, departmentPanelId } from '@/components/agency/shell/DepartmentTabs'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import type { BlogTab } from '@/lib/blogging/handover'
import type { HealthChecklistItem } from '@/lib/blogging/health-checklist'

interface BlogPostCard {
  id: string
  title: string
  content: string
  status: BlogTab
  created_at: string
  target_keyword: string | null
  word_count: number
  images: { url: string; alt: string }[]
  checklist: HealthChecklistItem[]
  review_passed: boolean
}

interface BloggingPayload {
  brand: { name: string; website_host: string | null; healthcare: boolean }
  summary: string
  counts: Record<BlogTab, number>
  posts: BlogPostCard[]
  ideas: { title: string; source: 'pillar' }[]
}

const TAB_FROM_SLUG: Record<string, BlogTab> = {
  ideas: 'idea',
  posts: 'everything',
  compliance: 'ready',
}

const TAB_LABEL: Record<BlogTab, string> = {
  everything: 'Everything',
  ready: 'Ready to copy across',
  needs_change: 'Needs a change',
  writing: 'Being written',
  idea: 'Ideas',
  on_site: 'On your site',
}

const STATUS_LABEL: Record<BlogTab, string> = {
  everything: '',
  ready: 'Ready to copy across',
  needs_change: 'Needs a change',
  writing: 'Keep writing',
  idea: 'Start writing',
  on_site: 'On your site',
}

function tabFromPath(pathname: string): BlogTab {
  const slug = pathname.split('/').filter(Boolean).at(-1)
  if (!slug || slug === 'blogging') return 'everything'
  return TAB_FROM_SLUG[slug] ?? 'everything'
}

function formatWritten(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

async function downloadAll(images: { url: string; alt: string }[], title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  for (const [index, image] of images.entries()) {
    try {
      const response = await fetch(image.url)
      if (!response.ok) continue
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `${slug}-${index + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch {
      window.open(image.url, '_blank', 'noopener')
    }
  }
}

export function BloggingDepartment() {
  const pathname = usePathname() ?? '/agency/blogging'
  const { activeBrandId } = useAgencyStore()
  const [tab, setTab] = useState<BlogTab>(() => tabFromPath(pathname))
  const [payload, setPayload] = useState<BloggingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hiddenIdeas, setHiddenIdeas] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setLoading(false)
      setPayload(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/blogging?brandId=${activeBrandId}`)
      if (!response.ok) throw new Error('Could not load posts')
      const data = (await response.json()) as BloggingPayload
      setPayload(data)
      const firstReady = data.posts.find((post) => post.status === 'ready')
      setExpandedId((current) => current ?? firstReady?.id ?? data.posts[0]?.id ?? null)
    } catch {
      setError('Could not load the blog posts for this business.')
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setTab(tabFromPath(pathname))
  }, [pathname])

  const visiblePosts = useMemo(() => {
    const posts = payload?.posts ?? []
    if (tab === 'everything') return posts
    return posts.filter((post) => post.status === tab)
  }, [payload, tab])

  const ideas = useMemo(
    () => (payload?.ideas ?? []).filter((idea) => !hiddenIdeas.includes(idea.title)),
    [payload, hiddenIdeas],
  )

  const counts = payload?.counts
  const healthcare = Boolean(payload?.brand.healthcare)

  const tabs = (['everything', 'ready', 'needs_change', 'writing', 'idea', 'on_site'] as const).map(
    (id) => ({
      id,
      label: TAB_LABEL[id],
      count: counts ? counts[id] : undefined,
      care: id === 'needs_change' && healthcare,
    }),
  )

  async function markOnSite(id: string) {
    setBusyId(id)
    try {
      const response = await fetch(`/api/blogging/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'on_site' }),
      })
      if (!response.ok) throw new Error('failed')
      await load()
    } catch {
      setError('Could not mark that post as on your site. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (!activeBrandId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Pick a business to see its blog posts.
      </div>
    )
  }

  const host = payload?.brand.website_host
  const writePrompt =
    'Write a long blog post for this business from the content plan. Save it so it shows up in Blogging, ready to copy across. Do not publish it to the website — it is their blog.'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight">Blogging</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {loading ? 'Loading posts…' : payload?.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => sendToDirector(writePrompt)}
            className="shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white"
            style={{ background: 'var(--brand-deep, var(--foreground))' }}
          >
            Write a long post
          </button>
        </div>
        <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          Your blog is yours
          {host ? (
            <>
              . It lives on <span className="font-medium text-foreground">{host}</span>, not here
            </>
          ) : null}
          . We write, check and prepare the images — then you paste the finished post onto your own
          site and tell us it is up.
        </p>
      </header>

      <div className="shrink-0 px-6">
        <DepartmentTabs
          group="blogging"
          tabs={tabs}
          value={tab}
          onValueChange={(id) => setTab(id as BlogTab)}
          label="Blog post status"
        />
      </div>

      <div
        id={departmentPanelId('blogging', tab)}
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
      >
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : null}

        {!loading && visiblePosts.length === 0 && tab !== 'idea' ? (
          <p className="py-8 text-sm text-muted-foreground">
            {payload?.posts.length
              ? 'Nothing in this tab.'
              : 'No posts yet. The Director already knows this business — pick a topic below and it will write the first draft.'}
          </p>
        ) : null}

        <ul className="space-y-3">
          {visiblePosts.map((post) => {
            const open = expandedId === post.id
            return (
              <li
                key={post.id}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : post.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-[15px] font-semibold tracking-tight">{post.title}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {post.target_keyword ? `${post.target_keyword} · ` : ''}
                      {post.word_count.toLocaleString('en-AU')} words
                      {post.images.length > 0 ? ` · ${post.images.length} images ready` : ''}
                      {post.created_at ? ` · ${formatWritten(post.created_at)}` : ''}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={
                      post.status === 'ready'
                        ? {
                            background: 'var(--brand-wash, var(--muted))',
                            color: 'var(--brand-deep, var(--foreground))',
                          }
                        : post.status === 'needs_change'
                          ? { background: 'var(--care-wash, var(--destructive)/0.1)', color: 'var(--care, var(--destructive))' }
                          : undefined
                    }
                  >
                    {STATUS_LABEL[post.status]}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          1. Copy the text
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          Paste it into your own site. We do not publish it for you.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyText(post.content)
                            if (ok) {
                              setCopiedId(post.id)
                              window.setTimeout(() => setCopiedId((current) => (current === post.id ? null : current)), 2000)
                            }
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedId === post.id ? 'Copied' : 'Copy the text'}
                        </button>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          2. Save the images
                        </p>
                        {post.images.length === 0 ? (
                          <p className="mt-1 text-[12px] text-muted-foreground">No images on this draft yet.</p>
                        ) : (
                          <>
                            <div className="mt-2 flex gap-1.5">
                              {post.images.map((image) => (
                                <span
                                  key={image.url}
                                  className="h-9 w-9 overflow-hidden rounded-md border border-border bg-muted"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={image.url} alt={image.alt || ''} className="h-full w-full object-cover" />
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => void downloadAll(post.images, post.title)}
                              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium"
                              style={{ color: 'var(--brand-deep, var(--foreground))' }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download all {post.images.length === 1 ? 'one' : `${post.images.length}`}
                            </button>
                          </>
                        )}
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          3. Tell us it is up
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          After you paste it onto {host ?? 'your site'}, tick below. We never push it live for you.
                        </p>
                      </div>
                    </div>

                    {healthcare && post.checklist.length > 0 ? (
                      <div
                        className="rounded-lg border px-3 py-3"
                        style={{
                          borderColor: post.review_passed
                            ? 'var(--brand, var(--border))'
                            : 'var(--care, var(--destructive))',
                          background: post.review_passed
                            ? 'var(--brand-wash, var(--muted))'
                            : 'var(--care-wash, transparent)',
                        }}
                      >
                        <p className="text-[13px] font-semibold">
                          {post.review_passed
                            ? 'Checked before you publish — health rules passed.'
                            : 'Checked before you publish'}
                        </p>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {post.checklist.map((item) => (
                            <li key={item.id} className="flex items-center gap-2 text-[12px]">
                              <Check
                                className="h-3.5 w-3.5 shrink-0"
                                style={{
                                  color: item.passed
                                    ? 'var(--brand-deep, var(--foreground))'
                                    : 'var(--muted-foreground)',
                                }}
                              />
                              {item.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {post.status !== 'on_site' ? (
                      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={busyId === post.id}
                          onChange={() => void markOnSite(post.id)}
                        />
                        I&apos;ve put this on my site.
                      </label>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">Marked as on your site.</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        {(tab === 'everything' || tab === 'idea') && ideas.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-[15px] font-semibold tracking-tight">What to write next</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              From this business&apos;s content plan. The Director writes the draft — you review it here.
            </p>
            <ul className="mt-3 space-y-2">
              {ideas.map((idea) => (
                <li
                  key={idea.title}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="text-[14px] font-medium">{idea.title}</span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        sendToDirector(
                          `Write a blog post about "${idea.title}" for this business from the content plan. Save it so it appears in Blogging, ready to copy across. Do not publish it to the website.`,
                        )
                      }
                      className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white"
                      style={{ background: 'var(--brand-deep, var(--foreground))' }}
                    >
                      Start writing
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenIdeas((current) => [...current, idea.title])
                        sendToDirector(
                          `Don't write about "${idea.title}" for this business. Remember that.`,
                        )
                      }}
                      className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted-foreground"
                    >
                      Not for us
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
