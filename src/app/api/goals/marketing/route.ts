import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import {
  SOCIAL_METRICS,
  SOCIAL_PLATFORMS,
  readGoalRow,
  type MarketingGoal,
} from '@/lib/goals/marketing-goals'

export const dynamic = 'force-dynamic'

const GOAL_COLUMNS =
  'id, brand_id, title, description, status, success_criteria, deadline, last_reviewed_at, next_review_at, created_at, parent_id'

const TargetSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  metric: z.enum(SOCIAL_METRICS),
  target: z.number().positive(),
  current: z.number().nonnegative().nullable().optional(),
  by: z.string().nullable().optional(),
})

const SetGoalSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(3).max(180),
  description: z.string().max(2000).nullable().optional(),
  deadline: z.string().nullable().optional(),
  targets: z.array(TargetSchema).max(12).default([]),
})

/**
 * GET /api/goals/marketing?brandId=… — the active goal, and what came before it.
 *
 * Without brandId, returns the active goal for every project, which is what
 * the board needs in one call.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = new URL(request.url).searchParams.get('brandId')

  let query = supabase
    .from('goals')
    .select(GOAL_COLUMNS)
    .eq('user_id', user.id)
    .eq('level', 'objective')
    .order('created_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const goals = (data ?? []).map(readGoalRow)
  const active = goals.filter((g) => g.status === 'active')
  const history = goals.filter((g) => g.status !== 'active')

  return NextResponse.json(
    brandId
      ? { goal: active[0] ?? null, history }
      : {
          // One active goal per project, keyed so the board can look each up.
          goals: active.reduce<Record<string, MarketingGoal>>((acc, g) => {
            if (!acc[g.brandId]) acc[g.brandId] = g
            return acc
          }, {}),
        },
  )
}

/**
 * POST /api/goals/marketing — set this project's goal.
 *
 * A previous goal is marked superseded and kept, not overwritten. The old
 * behaviour updated the row in place, which destroyed the record of what was
 * aimed for and whether it was reached — the history is the only thing that
 * shows whether the goals are getting better.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = SetGoalSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That goal could not be saved as written.', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { brandId, title, description, deadline, targets } = parsed.data

  // Scoped through the caller's own client, so a project that is not theirs
  // simply is not found.
  const { data: project } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .maybeSingle()

  if (!project) return NextResponse.json({ error: 'That project could not be found.' }, { status: 404 })

  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', user.id)
    .eq('brand_id', brandId)
    .eq('level', 'objective')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .maybeSingle()

  const now = new Date().toISOString()

  const { data: inserted, error } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      parent_id: existing?.id ?? null,
      level: 'objective',
      status: 'active',
      title,
      description: description ?? null,
      deadline: deadline || null,
      success_criteria: { outcome: title, social_targets: targets },
      progress: { percent: 0, summary: 'Goal set.', evidence: [] },
      last_reviewed_at: now,
    })
    .select(GOAL_COLUMNS)
    .single()

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? 'The goal could not be saved.' }, { status: 500 })
  }

  // Retire the old one only once the new one is safely stored, so a failure
  // never leaves a project with no active goal at all.
  if (existing) {
    await supabase
      .from('goals')
      .update({ status: 'completed', last_reviewed_at: now })
      .eq('id', existing.id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ goal: readGoalRow(inserted), superseded: existing?.id ?? null }, { status: 201 })
}

const MeasureSchema = z.object({
  goalId: z.string().uuid(),
  targets: z.array(TargetSchema).max(12),
})

/**
 * PATCH /api/goals/marketing — record where the targets stand now.
 *
 * Measuring is not the same as changing the goal, so this does not supersede
 * anything: the aim is unchanged, only the reading of it.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = MeasureSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Those measurements could not be read.' }, { status: 400 })
  }

  const { data: goal } = await supabase
    .from('goals')
    .select(GOAL_COLUMNS)
    .eq('id', parsed.data.goalId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!goal) return NextResponse.json({ error: 'That goal could not be found.' }, { status: 404 })

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('goals')
    .update({
      success_criteria: { ...(goal.success_criteria ?? {}), social_targets: parsed.data.targets },
      last_reviewed_at: now,
    })
    .eq('id', goal.id)
    .eq('user_id', user.id)
    .select(GOAL_COLUMNS)
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Could not record that.' }, { status: 500 })
  }

  return NextResponse.json({ goal: readGoalRow(updated) })
}
