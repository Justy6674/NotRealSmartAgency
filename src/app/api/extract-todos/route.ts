import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { content, brandId } = await request.json()

  if (!content || !brandId) {
    return NextResponse.json({ error: 'Content and brandId required' }, { status: 400 })
  }

  try {
    // Use LLM to extract action items
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4'),
      system: `You extract action items from marketing reports. Return ONLY a JSON array of objects with "title" (short action item, max 80 chars) and "priority" (one of: critical, high, medium, low). No other text. Max 15 items. Focus on actionable, specific tasks a developer or marketer can execute.`,
      prompt: `Extract action items from this report:\n\n${content.slice(0, 4000)}`,
    })

    let tasks: { title: string; priority: string }[] = []
    try {
      // Parse the JSON from the LLM response
      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0])
      }
    } catch {
      return NextResponse.json({ error: 'Could not parse action items' }, { status: 500 })
    }

    if (tasks.length === 0) {
      return NextResponse.json({ tasks: [], count: 0 })
    }

    // Bulk insert tasks
    const taskRows = tasks.map(t => ({
      user_id: user.id,
      brand_id: brandId,
      title: t.title.slice(0, 200),
      priority: ['critical', 'high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      status: 'backlog',
      context: { source: 'report_extraction' },
    }))

    const { error } = await supabase.from('tasks').insert(taskRows)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks, count: tasks.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
