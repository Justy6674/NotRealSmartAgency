import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

const SCENT_SELL_SLUG = 'scent-sell'
const CONTRACT_VERSION = '2026-07-25'

const snapshotDataSchema = z.object({
  marketplace: z.object({
    activeListings: z.number().int().nonnegative(),
    pendingReviewListings: z.number().int().nonnegative(),
    newListings7d: z.number().int().nonnegative(),
    activeSwapListings: z.number().int().nonnegative(),
  }),
  community: z.object({
    newProfiles7d: z.number().int().nonnegative(),
    activeCabinetItems: z.number().int().nonnegative(),
    wears30d: z.number().int().nonnegative(),
  }),
  product: z.object({
    catalogueEntries: z.number().int().nonnegative(),
    swapEnabled: z.boolean(),
    boostPayOnSaleEnabled: z.boolean(),
  }),
})

const responseBaseSchema = z.object({
  project: z.literal(SCENT_SELL_SLUG),
  contractVersion: z.literal(CONTRACT_VERSION),
  generatedAt: z.string().datetime(),
  dataClassification: z.literal('aggregate_marketing_only'),
  access: z.object({ readOnly: z.literal(true), writesPermitted: z.literal(false) }),
  freshness: z.object({ observedAt: z.string().datetime(), maxAgeSeconds: z.number().int().positive() }),
})

const scentSellMarketingResponseSchema = z.discriminatedUnion('operation', [
  responseBaseSchema.extend({ operation: z.literal('get_marketing_snapshot'), data: snapshotDataSchema }),
  responseBaseSchema.extend({
    operation: z.literal('get_funnel_summary'),
    data: z.object({
      windowDays: z.literal(30),
      signals: z.object({
        newProfiles: z.number().int().nonnegative(),
        newListings: z.number().int().nonnegative(),
        ordersByStatus: z.record(z.string(), z.number().int().nonnegative()),
      }),
      unavailable: z.array(z.string()),
    }),
  }),
  responseBaseSchema.extend({
    operation: z.literal('list_approved_marketing_assets'),
    data: z.object({
      assets: z.array(z.object({ id: z.string(), title: z.string(), kind: z.literal('public_page'), url: z.string().url() })),
    }),
  }),
  responseBaseSchema.extend({
    operation: z.literal('get_verified_product_facts'),
    data: z.object({
      facts: z.array(z.object({ id: z.string(), statement: z.string(), source: z.enum(['approved_product_fact', 'live_feature_flag', 'aggregate_snapshot']) })),
    }),
  }),
  responseBaseSchema.extend({
    operation: z.literal('list_optimisation_opportunities'),
    data: z.object({
      signals: z.array(z.object({
        id: z.string(),
        observation: z.string(),
        marketingImpact: z.string(),
        evidence: z.record(z.string(), z.union([z.number().int().nonnegative(), z.boolean()])),
        proposalOnly: z.literal(true),
      })),
    }),
  }),
])

const operationSchema = z.enum([
  'get_marketing_snapshot',
  'get_funnel_summary',
  'list_approved_marketing_assets',
  'get_verified_product_facts',
  'list_optimisation_opportunities',
])

export function isScentSellBackendBrand(slug: string): boolean {
  return slug === SCENT_SELL_SLUG
}

export function parseScentSellMarketingResponse(payload: unknown) {
  return scentSellMarketingResponseSchema.parse(payload)
}

export function createInspectProjectMarketingBackendTool(
  supabase: SupabaseClient,
  brandId: string,
) {
  return tool({
    description: 'Read approved, aggregate marketing evidence from the selected project backend. Scent Sell only at present. Use for a backend marketing review or to form optimisation proposals. This tool is permanently read-only: it never receives customer records, messages, payment or payout data, credentials, or a write capability. Treat every signal as a proposal input, not permission to change the product.',
    inputSchema: z.object({
      operation: operationSchema.describe('The approved evidence set to retrieve from the selected project backend'),
    }),
    execute: async ({ operation }) => {
      const { data: brand, error } = await supabase
        .from('brands')
        .select('slug')
        .eq('id', brandId)
        .maybeSingle()

      if (error || !brand || !isScentSellBackendBrand(brand.slug)) {
        return { error: 'No approved backend marketing connector is available for this project.' }
      }

      const endpoint = process.env.SCENT_SELL_MARKETING_CONNECTOR_URL
      const token = process.env.SCENT_SELL_MARKETING_CONNECTOR_TOKEN
      if (!endpoint || !token) {
        return { error: 'The approved Scent Sell backend marketing connector is not configured yet.' }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8_000)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operation }),
        })
        if (!response.ok) return { error: 'The Scent Sell backend marketing connector is unavailable.' }
        return parseScentSellMarketingResponse(await response.json())
      } catch {
        return { error: 'The Scent Sell backend marketing connector is unavailable.' }
      } finally {
        clearTimeout(timeout)
      }
    },
  })
}
