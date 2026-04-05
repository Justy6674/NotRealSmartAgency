import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getHeyGenApiKey,
  fetchTemplates,
  fetchTemplate,
  generateFromTemplate,
} from '@/lib/heygen/client'

export function createListHeyGenTemplatesTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List available HeyGen video templates. Returns template IDs, names, and thumbnail URLs. Use this to show the user what pre-built video templates they can use.',
    inputSchema: z.object({}),
    execute: async () => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. To use templates, get an API key from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const templates = await fetchTemplates(apiKey)

        if (!templates.length) {
          return {
            success: true,
            templates: [],
            message: 'No templates found in your HeyGen account. You can create templates at app.heygen.com.',
          }
        }

        return {
          success: true,
          templates,
          count: templates.length,
          message: `Found ${templates.length} template${templates.length === 1 ? '' : 's'}. Use the template ID to get details or generate a video from it.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch HeyGen templates',
        }
      }
    },
  })
}

export function createGetHeyGenTemplateTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get details of a specific HeyGen template, including its variable definitions. Use this to understand what variables need to be filled before generating a video from the template.',
    inputSchema: z.object({
      template_id: z
        .string()
        .describe('The HeyGen template ID to retrieve details for'),
    }),
    execute: async ({ template_id }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Cannot fetch template details without an API key.',
        }
      }

      try {
        const template = await fetchTemplate(apiKey, template_id)

        if (!template) {
          return {
            success: false,
            error: `Template "${template_id}" not found. Check the ID is correct — use list_heygen_templates to see available templates.`,
          }
        }

        return {
          success: true,
          template,
          message: 'Here are the template details. Review the variables section to see what values need to be provided when generating a video.',
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch template details',
        }
      }
    },
  })
}

export function createGenerateFromTemplateTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Generate a video from a HeyGen template with variable substitution. First use get_heygen_template to see what variables the template expects, then provide them here.',
    inputSchema: z.object({
      template_id: z
        .string()
        .describe('The HeyGen template ID to generate from'),
      variables: z
        .record(z.unknown())
        .describe('Key-value pairs for the template variables, as defined in the template details'),
      title: z
        .string()
        .optional()
        .describe('Optional title for the generated video'),
    }),
    execute: async ({ template_id, variables, title }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. To generate videos, get an API key from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const result = await generateFromTemplate(apiKey, template_id, variables, title)

        if (!result) {
          return {
            success: false,
            error: 'HeyGen template generation failed. Check that the template ID and variables are correct.',
          }
        }

        const videoTitle = title ?? `Template video (${template_id})`

        // Save as output so it appears in the output library
        const { data: videoOutput } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'video',
            title: videoTitle,
            content: `Generated from template ${template_id}`,
            metadata: {
              job_id: result.video_id,
              provider: 'heygen',
              type: 'template',
              template_id,
              status: 'processing',
            },
          })
          .select('id')
          .single()

        return {
          success: true,
          video_id: result.video_id,
          output_id: videoOutput?.id,
          title: videoTitle,
          template_id,
          estimated_time: '2-5 minutes',
          message: `I'm generating your video from the template now. It usually takes 2-5 minutes for HeyGen to render it.\n\nTitle: "${videoTitle}"\nTemplate: ${template_id}\n\nI'll save it to your output library once it's ready.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate video from template',
        }
      }
    },
  })
}
