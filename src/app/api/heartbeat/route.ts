import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from '@/lib/agents/tools'
import { recordAgentSpend, checkBudget } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import type { Brand, AgentConfig, AgentRegistryEntry, Task } from '@/types/database'

// Fluid Compute — allow up to 5 minutes for processing multiple agents
export const maxDuration = 300

export async function GET(request: Request) {
  // Verify cron secret (Vercel injects this)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorised', { status: 401 })
  }

  const supabase = createAdminClient()
  const startTime = Date.now()
  let totalChecked = 0
  let totalActioned = 0

  try {
    // Monthly budget reset on 1st of month
    const today = new Date()
    if (today.getDate() === 1 && today.getHours() < 1) {
      await supabase
        .from('agent_registry')
        .update({ spent_monthly_cents: 0 })
        .neq('spent_monthly_cents', 0)
    }

    // Find all agents with assigned tasks
    const { data: assignedTasks, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        agent_registry:assigned_agent_id (*)
      `)
      .eq('status', 'assigned')
      .not('assigned_agent_id', 'is', null)

    if (taskError || !assignedTasks) {
      return NextResponse.json({
        status: 'error',
        error: taskError?.message ?? 'No tasks found',
      })
    }

    totalChecked = assignedTasks.length

    for (const taskRow of assignedTasks) {
      const task = taskRow as Task & { agent_registry: AgentRegistryEntry }
      const registry = task.agent_registry

      if (!registry || !registry.is_active || registry.status === 'paused') continue

      // Check budget
      const budget = await checkBudget(supabase, registry.id)
      if (!budget.allowed) {
        await supabase
          .from('agent_registry')
          .update({ status: 'paused' })
          .eq('id', registry.id)
        continue
      }

      // Create heartbeat record
      const { data: heartbeat } = await supabase
        .from('heartbeats')
        .insert({
          user_id: task.user_id,
          agent_id: registry.id,
          triggered_by: 'cron',
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      try {
        // Fetch brand for context
        const { data: brand } = task.brand_id
          ? await supabase.from('brands').select('*').eq('id', task.brand_id).single()
          : { data: null }

        // Fetch agent config
        const { data: agentConfig } = await supabase
          .from('agent_configs')
          .select('*')
          .eq('agent_type', registry.agent_type)
          .single()

        if (!agentConfig) continue

        // Build prompt
        const taskPrompt = [
          task.title,
          task.description,
          task.context ? `Context: ${JSON.stringify(task.context)}` : '',
        ].filter(Boolean).join('\n\n')

        const { prompt: systemPrompt } = await buildSystemPromptWithMemory(
          (brand ?? { slug: 'unknown', name: 'Unknown', niche: '', compliance_flags: { ahpra: false, tga: false, tga_categories: [] } }) as Brand,
          agentConfig as AgentConfig,
          taskPrompt
        )

        // Get tools
        const tools = getToolsForAgent(registry.agent_type, {
          supabase,
          userId: task.user_id,
          brandId: task.brand_id ?? '',
          conversationId: null,
          agentRegistryId: registry.id,
        })

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', task.id)

        // Execute with full Gateway features
        const result = await generateText({
          model: gateway(registry.model || 'anthropic/claude-sonnet-4'),
          system: systemPrompt,
          prompt: taskPrompt,
          tools,
          providerOptions: {
            gateway: {
              models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'],
              user: task.user_id,
              tags: [registry.agent_type, 'heartbeat'],
            },
          },
        })

        const inputTokens = result.usage?.inputTokens ?? 0
        const outputTokens = result.usage?.outputTokens ?? 0
        const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

        // Update task as done
        await supabase
          .from('tasks')
          .update({
            status: 'done',
            result: { text: result.text, toolResults: result.toolResults },
            tokens_used: inputTokens + outputTokens,
            cost_cents: costCents,
            completed_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        // Record spend
        await recordAgentSpend(supabase, registry.id, costCents)

        // Audit
        await logAudit({
          supabase,
          userId: task.user_id,
          agentId: registry.id,
          taskId: task.id,
          action: 'heartbeat_task_completed',
          entityType: 'task',
          entityId: task.id,
          detail: { inputTokens, outputTokens, costCents },
          costCents,
        })

        // Update heartbeat
        if (heartbeat) {
          await supabase
            .from('heartbeats')
            .update({
              status: 'succeeded',
              tasks_actioned: 1,
              tasks_checked: 1,
              duration_ms: Date.now() - startTime,
              finished_at: new Date().toISOString(),
            })
            .eq('id', heartbeat.id)
        }

        totalActioned++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        // Mark task as blocked
        await supabase
          .from('tasks')
          .update({ status: 'blocked' })
          .eq('id', task.id)

        // Update heartbeat as failed
        if (heartbeat) {
          await supabase
            .from('heartbeats')
            .update({
              status: 'failed',
              error: message,
              duration_ms: Date.now() - startTime,
              finished_at: new Date().toISOString(),
            })
            .eq('id', heartbeat.id)
        }

        console.error(`[heartbeat] Task ${task.id} failed:`, message)
      }
    }
  } catch (error) {
    console.error('[heartbeat] Fatal error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ok',
    tasksChecked: totalChecked,
    tasksActioned: totalActioned,
    durationMs: Date.now() - startTime,
  })
}
