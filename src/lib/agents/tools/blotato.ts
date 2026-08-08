import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getBlotatoApiKey,
  blotatoListAccounts,
  blotatoCreatePost,
  blotatoCreateSource,
  blotatoGetSourceStatus,
  blotatoListTemplates,
  blotatoCreateVisual,
  blotatoGetVisualStatus,
  blotatoGetPostStatus,
} from '@/lib/blotato/client'

/**
 * Blotato tools for the Director and agents.
 *
 * Blotato provides AI content creation, visual generation, and content
 * extraction/repurposing. Used alongside Mixpost — Director chooses which
 * is best for each task:
 *
 * - Blotato: AI creation, visual generation, content repurposing, templates
 * - Mixpost: Scheduling, analytics, self-hosted publishing, performance data
 *
 * API key stored in user_integrations (provider: 'blotato').
 * Returns helpful error if not configured.
 */

const NOT_CONFIGURED = {
  success: false,
  error: 'Blotato is not configured for this account. The user can add their Blotato API key in Settings > Integrations. Blotato provides AI content creation, visual generation, and content repurposing. For publishing and analytics, use Mixpost instead.',
}

// ── List Connected Blotato Accounts ──────────────────────────────────────────

export function createBlotatoListAccountsTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'List social media accounts connected to Blotato. Use this to see what platforms the user can publish to via Blotato. For Mixpost-connected accounts, use manage_posts or query_social_analytics instead.',
    inputSchema: z.object({
      platform: z
        .string()
        .optional()
        .describe('Filter by platform: twitter, instagram, facebook, tiktok, linkedin, pinterest, bluesky, threads, youtube'),
    }),
    execute: async ({ platform }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const accounts = await blotatoListAccounts(apiKey, platform)
        return { success: true, data: accounts }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}

// ── Create & Publish Post via Blotato ────────────────────────────────────────

export function createBlotatoPublishTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Publish or schedule a post via Blotato to any connected platform. Supports Twitter, Instagram, Facebook, TikTok, LinkedIn, Pinterest, Bluesky, Threads, YouTube. Use this when Blotato is the preferred publisher (e.g., for AI-generated visuals or repurposed content). For Mixpost publishing, use publish_to_social instead.',
    inputSchema: z.object({
      accounts: z.array(z.string()).describe('Blotato account IDs to post to'),
      text: z.string().describe('Post caption/text'),
      mediaUrls: z.array(z.string()).optional().describe('Media URLs to attach'),
      scheduledAt: z.string().optional().describe('ISO 8601 datetime to schedule. Omit for immediate publish.'),
    }),
    execute: async ({ accounts, text, mediaUrls, scheduledAt }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const result = await blotatoCreatePost(apiKey, { accounts, text, mediaUrls, scheduledAt })
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: userSafeError('blotato-publish', e, 'Blotato could not publish that. Nothing went out.') }
      }
    },
  })
}

// ── Extract Content from URL/Text (Repurposing) ─────────────────────────────

export function createBlotatoExtractContentTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Extract and repurpose content from a URL (blog post, video, article, tweet) or raw text using Blotato AI. Returns platform-ready content that can be published. Great for turning one piece of content into multiple social posts. This is unique to Blotato — Mixpost cannot do this.',
    inputSchema: z.object({
      url: z.string().optional().describe('URL to extract content from (blog, video, article)'),
      text: z.string().optional().describe('Raw text to repurpose (if no URL)'),
    }),
    execute: async ({ url, text }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      if (!url && !text) return { success: false, error: 'Provide either a URL or text to extract from.' }
      try {
        const source = await blotatoCreateSource(apiKey, { url, text })
        // Blotato polls internally for up to 20 seconds
        // If still processing, return the sourceId for manual status check
        return { success: true, data: source, note: 'If status is "processing", use blotato_source_status to check completion.' }
      } catch (e) {
        return { success: false, error: userSafeError('blotato-extract', e, 'Blotato could not read that link.') }
      }
    },
  })
}

// ── Check Source Extraction Status ───────────────────────────────────────────

export function createBlotatoSourceStatusTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description: 'Check the status of a Blotato content extraction job.',
    inputSchema: z.object({
      sourceId: z.string().describe('Source ID from blotato_extract_content'),
    }),
    execute: async ({ sourceId }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const status = await blotatoGetSourceStatus(apiKey, sourceId)
        return { success: true, data: status }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}

// ── Generate Visuals (Images, Carousels, Videos) ─────────────────────────────

export function createBlotatoListTemplatesTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Browse available Blotato visual templates for creating images, carousels, and videos. Search by keyword to find relevant templates. This is unique to Blotato — Mixpost cannot generate visuals.',
    inputSchema: z.object({
      query: z.string().optional().describe('Search query to filter templates (e.g., "carousel", "product showcase", "testimonial")'),
    }),
    execute: async ({ query }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const templates = await blotatoListTemplates(apiKey, query)
        return { success: true, data: templates }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}

export function createBlotatoCreateVisualTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Generate an image, carousel, or video using a Blotato template and a natural language prompt. First use blotato_list_templates to find a template, then create the visual. The generated visual can be published directly or saved to the media library.',
    inputSchema: z.object({
      templateId: z.string().describe('Template ID from blotato_list_templates'),
      prompt: z.string().describe('Natural language description of the visual to generate'),
    }),
    execute: async ({ templateId, prompt }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const visual = await blotatoCreateVisual(apiKey, { templateId, prompt })
        return { success: true, data: visual, note: 'If status is not "completed", use blotato_visual_status to check progress.' }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}

export function createBlotatoVisualStatusTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description: 'Check the status of a Blotato visual generation job.',
    inputSchema: z.object({
      visualId: z.string().describe('Visual ID from blotato_create_visual'),
    }),
    execute: async ({ visualId }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const status = await blotatoGetVisualStatus(apiKey, visualId)
        return { success: true, data: status }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}

// ── Check Post Status ────────────────────────────────────────────────────────

export function createBlotatoPostStatusTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description: 'Check the publishing status of a post submitted via Blotato.',
    inputSchema: z.object({
      postSubmissionId: z.string().describe('Post submission ID from blotato_publish'),
    }),
    execute: async ({ postSubmissionId }) => {
      const apiKey = await getBlotatoApiKey(supabase, userId)
      if (!apiKey) return NOT_CONFIGURED
      try {
        const status = await blotatoGetPostStatus(apiKey, postSubmissionId)
        return { success: true, data: status }
      } catch (e) {
        return { success: false, error: userSafeError('blotato', e, 'Blotato could not be reached. Nothing was sent.') }
      }
    },
  })
}
