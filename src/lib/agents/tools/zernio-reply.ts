/**
 * Replying to a real person — and the one regulatory review every reply shares.
 *
 * ── Why this file holds more than a tool ───────────────────────────────
 * Four surfaces now send words to a live audience outside the post composer:
 * the Director's reply tool below, and the Engagement desk's comment, mention
 * and review routes. Each of those is publishing in every sense AHPRA and the
 * TGA care about — a Google review reply from a weight-loss clinic is
 * advertising, not correspondence. Writing the same gate call four times is
 * exactly how the third one ends up missing it, which is the fault
 * `publish-gate.ts` itself was created to close on the posting side.
 *
 * So the review, the brand lookup and the account-ownership check live here
 * once and every reply path imports them.
 *
 * ── What this file used to do ──────────────────────────────────────────
 * It built a Zernio URL by hand, sent the model's text straight to a live
 * conversation with no review of any kind, and then recorded the reply into
 * `outputs` with an `agent_id` column that does not exist and a `content_type`
 * column that does not exist either — so the insert failed every time, was
 * never checked, and `/api/inbox` has been joining against zero rows ever
 * since. All three are fixed below.
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkPublishAllowed, type PublishGateResult } from '@/lib/agents/publish-gate'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { sendZernioMessage } from '@/lib/zernio/engagement'
import { approvedByPublishGate, type ZernioOutboundApproval } from '@/lib/zernio/types'
import type { BrandDNAConstraints, ComplianceFlags } from '@/types/database'

/* ── The brand behind a reply ──────────────────────────────────────────── */

export interface OutboundBrandContext {
  brandId: string
  brandName: string
  brandSlug: string | null
  complianceFlags: ComplianceFlags | null
  brandDNA: BrandDNAConstraints | null
  /** The brand's publisher profile, or null when it has never been linked. */
  profileId: string | null
}

export type OutboundBrandAccess =
  | { access: 'denied' }
  | { access: 'granted'; brand: OutboundBrandContext }

/**
 * Who is allowed to speak for this brand, and under which rules.
 *
 * Membership is decided by `zernioProfileForBrand`, the same rule the Desk and
 * the chat route use — not a private copy. The second read exists because the
 * regulatory review needs the compliance flags and brand DNA, and refusing to
 * review because a column was not selected would be a silent downgrade.
 */
export async function loadOutboundBrandContext(
  supabase: SupabaseClient,
  actorUserId: string,
  brandId: string,
): Promise<OutboundBrandAccess> {
  const access = await zernioProfileForBrand(supabase, actorUserId, brandId)
  if (access.access === 'denied') return { access: 'denied' }

  const { data } = await supabase
    .from('brands')
    .select('slug, compliance_flags, brand_dna_constraints')
    .eq('id', brandId)
    .maybeSingle()

  return {
    access: 'granted',
    brand: {
      brandId,
      brandName: access.brand.brandName,
      brandSlug: typeof data?.slug === 'string' ? data.slug : null,
      complianceFlags: (data?.compliance_flags ?? null) as ComplianceFlags | null,
      brandDNA: (data?.brand_dna_constraints ?? null) as BrandDNAConstraints | null,
      profileId: access.brand.profileId,
    },
  }
}

/**
 * Whether an account id actually belongs to this brand.
 *
 * Tenant isolation is ours, not the publisher's: upstream validates an account
 * id against the whole team, so a customer's brand could otherwise reply from
 * another customer's account by passing its id. The list is filtered in our own
 * code inside `fetchZernioAccounts`, which is what makes this check meaningful.
 */
export async function brandOwnsAccount(
  profileId: string | null,
  accountId: string,
): Promise<boolean> {
  if (!profileId || !accountId) return false
  const own = await fetchZernioAccounts(profileId)
  return own.some((account) => account.id === accountId)
}

/* ── The review every outbound reply passes ────────────────────────────── */

export type OutboundReview =
  | { allowed: true; approval: ZernioOutboundApproval; warnings: string[] }
  | { allowed: false; reason: string; warnings: string[] }

/**
 * Review words before they leave, and hand back the proof that they were.
 *
 * `check` is injectable for one reason only: so the test can drive a refusal
 * without a model call and prove the send never happens. Production callers
 * pass nothing and get the shared gate.
 */
export async function reviewOutboundWords(params: {
  content: string
  brand: Pick<OutboundBrandContext, 'brandName' | 'brandSlug' | 'complianceFlags' | 'brandDNA'>
  /** What is being answered, in the owner's words — appears in a block message. */
  label: string
  check?: (input: {
    content: string
    complianceFlags: ComplianceFlags | null | undefined
    brandSlug?: string | null
    brandDNA?: BrandDNAConstraints | null
    label?: string
  }) => Promise<PublishGateResult>
}): Promise<OutboundReview> {
  const words = params.content.trim()
  if (!words) {
    return { allowed: false, reason: 'There was nothing to send.', warnings: [] }
  }

  const check = params.check ?? checkPublishAllowed
  const gate = await check({
    content: words,
    complianceFlags: params.brand.complianceFlags,
    brandSlug: params.brand.brandSlug,
    brandDNA: params.brand.brandDNA,
    label: `${params.brand.brandName} → ${params.label}`,
  })

  if (!gate.allowed) {
    return {
      allowed: false,
      reason: gate.reason ?? 'The review stopped this reply, so nothing was sent.',
      warnings: gate.warnings,
    }
  }

  // approvedByPublishGate throws on a blocked verdict. Reaching it with an
  // allowed one is the only honest way to produce an approval, and the
  // engagement wrappers cannot be called without it.
  return {
    allowed: true,
    approval: approvedByPublishGate(gate, `${params.brand.brandName} → ${params.label}`),
    warnings: gate.warnings,
  }
}

/**
 * Keep our own record that we sent this.
 *
 * The desk cannot otherwise tell a reply this app sent from one the owner typed
 * into the Instagram app on his phone, and claiming the Director handled
 * something it did not is worse than saying nothing. The content already passed
 * the publishing review above, which is stricter than the save review, so this
 * writes without a second check.
 */
export async function recordOutboundReply(
  supabase: SupabaseClient,
  params: {
    userId: string
    brandId: string
    content: string
    title: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from('outputs').insert({
    user_id: params.userId,
    brand_id: params.brandId,
    // `output_type` is an enum and has no reply member. 'other' with a typed
    // metadata block is the honest fit; inventing an enum value in application
    // code is what made the previous insert fail silently.
    output_type: 'other',
    title: params.title,
    content: params.content,
    metadata: { kind: 'social_reply', ...params.metadata },
    is_approved: true,
  })
  if (error) console.error('[zernio_reply] record', error.message)
}

/* ── The Director's tool ───────────────────────────────────────────────── */

export function getZernioReplyTool(
  supabase: SupabaseClient,
  userId: string,
  brandId?: string,
) {
  return tool({
    description:
      'Send a reply in an existing social message conversation. Use only with a conversation id and account id taken from the messages desk. The reply is checked against the brand’s advertising rules before it leaves, and is refused if it breaches them.',
    inputSchema: z.object({
      accountId: z.string().describe('The connected account the conversation belongs to'),
      conversationId: z.string().describe('The conversation to reply in'),
      text: z.string().describe('The exact words to send to the customer'),
    }),
    execute: async ({ accountId, conversationId, text }) => {
      try {
        if (!brandId) {
          return {
            success: false,
            error:
              'Choose a business first — replies are checked against that business’s advertising rules.',
          }
        }

        const access = await loadOutboundBrandContext(supabase, userId, brandId)
        if (access.access === 'denied') {
          return { success: false, error: 'That business could not be opened under this sign-in.' }
        }

        if (!access.brand.profileId) {
          return {
            success: false,
            error: 'This business has no connected messaging accounts, so nothing could be sent.',
          }
        }

        if (!(await brandOwnsAccount(access.brand.profileId, accountId))) {
          return {
            success: false,
            error: 'That account does not belong to this business, so nothing was sent.',
          }
        }

        const review = await reviewOutboundWords({
          content: text,
          brand: access.brand,
          label: 'a direct message reply',
        })
        if (!review.allowed) {
          return { success: false, blocked: true, error: review.reason }
        }

        await sendZernioMessage({
          conversationId,
          accountId,
          message: text.trim(),
          approval: review.approval,
        })

        await recordOutboundReply(supabase, {
          userId,
          brandId,
          content: text.trim(),
          title: 'Message reply',
          metadata: { zernio_conversation_id: conversationId, zernio_account_id: accountId },
        })

        return { success: true, message: 'The reply has been sent.' }
      } catch (error) {
        return {
          success: false,
          error: userSafeError(
            'zernio_reply',
            error,
            'The reply could not be sent just now. Nothing was sent — try again in a moment.',
          ),
        }
      }
    },
  })
}
