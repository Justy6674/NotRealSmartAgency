import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectBrief } from '@/lib/projects/load-brief'

/**
 * The same brief a plugged-in client receives, available to the Director.
 *
 * Both read the one loader, so asking Claude Desktop and asking the Director
 * about the same project cannot produce two different answers — which is what
 * happened when each assembled its own view from whatever it thought to fetch.
 */
export function createProjectBriefTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Get the full picture of a project before working on it: exact brand colours, logo, voice and banned words, whether advertising rules apply, what is at risk, what is out of date, and what to do next. Use this when you need to know the brand rules or where a project stands.',
    inputSchema: z.object({
      project_id: z
        .string()
        .optional()
        .describe('Another project to look at. Leave empty for the current one.'),
    }),
    execute: async ({ project_id }) => {
      try {
        const result = await loadProjectBrief(supabase, project_id ?? brandId, userId)
        if (!result) return { found: false, error: 'That project could not be found.' }
        return { found: true, brief: result.text }
      } catch {
        return { found: false, error: 'The brief could not be built just now.' }
      }
    },
  })
}
