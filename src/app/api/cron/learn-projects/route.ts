export const maxDuration = 300 // Fluid Compute — 5 minutes

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAgentWorker } from '@/lib/agents/worker'
import { planLearningRun } from '@/lib/proforma/learning-plan'
import { loadProjectBrief } from '@/lib/projects/load-brief'
import type { Brand } from '@/types/database'

/**
 * GET /api/cron/learn-projects
 *
 * The nightly learning run. Each project's 21 strategic sections were seeded
 * once from the brand record and never touched again — 105 of 252 empty, 6
 * ever reviewed — so a red label was shown where work should have been done.
 * This does a small amount of that work every night instead.
 *
 * Bounded on purpose. Every section is a model call, and there are eleven
 * projects: an unbounded version spends real money on every run. What it
 * chooses and how much it leaves is decided in `planLearningRun` and reported
 * in the response, so a partial run never looks like a complete one.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  const { data: projects } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (!projects || projects.length === 0) {
    return NextResponse.json({ message: 'No active projects.' })
  }

  const [{ data: sections }, { data: scans }] = await Promise.all([
    supabase
      .from('brand_proforma_sections')
      .select('brand_id, section_key, section_title, section_data, review_cadence, last_reviewed_at'),
    supabase
      .from('project_scans')
      .select('brand_id, created_at')
      .eq('scan_type', 'website')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // Most recent read per project, so a site is not re-read every night.
  const lastScan = new Map<string, string>()
  for (const scan of scans ?? []) {
    if (!lastScan.has(scan.brand_id)) lastScan.set(scan.brand_id, scan.created_at)
  }

  const plan = planLearningRun({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      website_url: p.website_url,
      last_scanned_at: lastScan.get(p.id) ?? null,
    })),
    sections: sections ?? [],
    now,
  })

  const projectById = new Map(projects.map((p) => [p.id, p as Brand]))
  const written: string[] = []
  const failed: string[] = []

  // Run together rather than one after another. Sequentially, four sections at
  // up to ninety seconds each is three hundred and sixty — past the five
  // minutes this function is given, so the last one was killed mid-run and
  // reported as returning nothing. In parallel the run takes about as long as
  // its slowest section.
  const outcomes = await Promise.allSettled(plan.sections.map(async (job) => {
    const project = projectById.get(job.brandId)
    if (!project) return

    {
      // The department writes against the same brief a plugged-in client
      // receives, so a section is written knowing the brand rules and what is
      // already at risk — not from the project name alone.
      const brief = await loadProjectBrief(supabase, job.brandId, project.user_id)

      const result = await runAgentWorker(
        job.department,
        [
          `Write the "${job.sectionTitle}" section of the marketing plan for ${project.name}.`,
          job.empty
            ? 'It has never been filled in, so this is the first version.'
            : 'It is out of date. Bring it current, keeping anything still true.',
          '',
          'Here is everything currently known about this project:',
          '',
          brief?.text ?? '(no brief available)',
          '',
          'Return the section itself — specific to this project, in Australian English, no preamble and no headings above the content. Where you do not know something, say what would need to be found out rather than inventing it.',
        ].join('\n'),
        {
          supabase,
          userId: project.user_id,
          brandId: job.brandId,
          brand: project,
          conversationId: null,
        },
        { maxSteps: 2, timeoutMs: 90_000 },
      )

      const content = result.error ? null : result.result?.trim()
      if (!content) {
        failed.push(`${project.name}/${job.sectionKey}: ${result.error ?? 'nothing returned'}`)
        return
      }

      const { error } = await supabase
        .from('brand_proforma_sections')
        .update({
          section_data: { summary: content, written_by: job.department, source: 'nightly_learning' },
          rag_status: 'green',
          last_reviewed_at: now.toISOString(),
        })
        .eq('brand_id', job.brandId)
        .eq('section_key', job.sectionKey)

      if (error) {
        failed.push(`${project.name}/${job.sectionKey}: ${error.message}`)
        return
      }

      written.push(`${project.name}/${job.sectionKey}`)
    }
  }))

  for (const [i, outcome] of outcomes.entries()) {
    if (outcome.status === 'rejected') {
      const job = plan.sections[i]
      failed.push(
        `${job.projectName}/${job.sectionKey}: ${
          outcome.reason instanceof Error ? outcome.reason.message : 'unknown error'
        }`,
      )
    }
  }

  return NextResponse.json({
    written,
    failed,
    // Reported rather than hidden: a run that did four of two hundred is not
    // a run that finished the work.
    sections_deferred: plan.sectionsDeferred,
    scans_planned: plan.scans.map((s) => s.projectName),
    scans_deferred: plan.scansDeferred,
  })
}
