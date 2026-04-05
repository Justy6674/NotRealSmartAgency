import { tool } from 'ai'
import { z } from 'zod/v3'
import { fetchMixpostTemplates, createMixpostTemplate } from '@/lib/mixpost/client'

export function createListMixpostTemplatesTool() {
  return tool({
    description: 'List reusable post templates saved in Mixpost.',
    inputSchema: z.object({}),
    execute: async () => {
      const templates = await fetchMixpostTemplates()
      if (!templates) return { success: false, error: 'Cannot reach Mixpost.' }
      return { success: true, templates, count: templates.length }
    },
  })
}

export function createCreateMixpostTemplateTool() {
  return tool({
    description: 'Save a post format as a reusable template in Mixpost.',
    inputSchema: z.object({
      name: z.string().describe('Template name'),
      body: z.string().describe('Template text content'),
    }),
    execute: async ({ name, body }) => {
      const template = await createMixpostTemplate(name, [{ body, media: [] }])
      if (!template) return { success: false, error: 'Failed to create template.' }
      return { success: true, template, message: `Template "${name}" saved.` }
    },
  })
}
