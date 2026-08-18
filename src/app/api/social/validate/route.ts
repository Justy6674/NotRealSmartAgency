import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { publisherTransportOf } from '@/lib/publishers/transport'
import {
  validateZernioPost,
  validateZernioPostLength,
  type ZernioValidationTarget,
} from '@/lib/zernio/validate'
import { fetchTikTokCreatorInfo, type ZernioTikTokCreatorInfo } from '@/lib/zernio/accounts'
import { isZernioPlatform } from '@/lib/zernio/types'
import type { ZernioLengthReport, ZernioValidation } from '@/lib/zernio/types'

export const dynamic = 'force-dynamic'

/**
 * Pre-flight for the composer — a dry run of the exact rules publishing applies.
 *
 * ── Why this route exists at all ──────────────────────────────────────────
 * The composer used to answer three questions out of its own head, and each
 * answer could disagree with what actually happens at send time:
 *
 *   1. "How long may this be?" — from a hand-kept table in the browser. Two
 *      copies of a limit drift, and the copy that matters is the one the send
 *      enforces. `validatePostLength` is that copy, and it knows things the
 *      table never did (X Premium at 25,000; a media caption on Telegram
 *      capped at 1,024 rather than 4,096).
 *   2. "Will this be accepted?" — from local guesswork. `validatePost` honours
 *      per-target `customContent`, so it can be asked the real question: will
 *      THIS account, with THESE words, be accepted.
 *   3. "Which delivery route is this business on?" — the composer decided with
 *      "does the business have a profile id", while the publisher decides with
 *      `publisherTransportOf`, which first honours the explicit override the
 *      accounts page exposes. A business whose owner had chosen the backup
 *      connection was shown every main-connection-only field as a live input
 *      and watched them dropped in silence. One function now answers for both.
 *
 * All three are read-only and free. Nothing here writes, schedules or sends.
 *
 * `publisherTransportOf` runs HERE rather than in the browser on purpose: the
 * module it lives in reaches for the publishing SDKs, which must never be
 * built into a page bundle with a credential in it.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so this post could not be checked. Sign in and try again.'

const NOT_YOURS =
  'That business could not be opened under this sign-in, so nothing was checked.'

interface ValidateBody {
  brandId?: unknown
  content?: unknown
  targets?: unknown
  tiktokAccountId?: unknown
}

interface RequestTarget {
  platform: string
  accountId?: string
  customContent?: string
}

function readTargets(raw: unknown): RequestTarget[] {
  if (!Array.isArray(raw)) return []
  const out: RequestTarget[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    if (typeof rec.platform !== 'string' || rec.platform.trim() === '') continue
    out.push({
      platform: rec.platform,
      ...(typeof rec.accountId === 'string' && rec.accountId.trim() !== ''
        ? { accountId: rec.accountId }
        : {}),
      ...(typeof rec.customContent === 'string' && rec.customContent.trim() !== ''
        ? { customContent: rec.customContent }
        : {}),
    })
  }
  return out
}

export interface SocialValidateResponse {
  /** The SAME answer the publisher will reach — never re-derived in the browser. */
  transport: 'zernio' | 'mixpost'
  /** Character ceilings keyed by the publisher's own target names. */
  length: ZernioLengthReport | null
  /** Per-target accept/refuse, honouring each account's own words. */
  validation: ZernioValidation | null
  /** What THIS TikTok account may be told, or null when it was not asked. */
  tiktok: ZernioTikTokCreatorInfo | null
  /**
   * True when the checks could not be run — so the composer can say "not
   * checked" instead of drawing a green tick it has not earned.
   */
  checked: boolean
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as ValidateBody
    const brandId = typeof body.brandId === 'string' ? body.brandId : ''
    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — the rules that apply depend on it.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    const transport = publisherTransportOf(access.brand.socialUrls)
    const content = typeof body.content === 'string' ? body.content : ''
    const targets = readTargets(body.targets)

    const answer: SocialValidateResponse = {
      transport,
      length: null,
      validation: null,
      tiktok: null,
      checked: false,
    }

    // The backup connection is not the one these endpoints describe, and a
    // ceiling quoted from the wrong publisher is the drift this route exists
    // to stop. Say the route, check nothing, let the composer fall back to its
    // own conservative table and label it honestly.
    if (transport !== 'zernio' || !process.env.ZERNIO_API_KEY) {
      return NextResponse.json(answer)
    }

    // Length is asked of the plain string, with no target list — that is the
    // shape the endpoint takes, and it returns every network at once.
    if (content.trim() !== '') {
      answer.length = await validateZernioPostLength(content).catch(() => null)
    }

    const zernioTargets: ZernioValidationTarget[] = targets.flatMap((target) =>
      isZernioPlatform(target.platform)
        ? [{
            platform: target.platform,
            ...(target.accountId ? { accountId: target.accountId } : {}),
            ...(target.customContent ? { customContent: target.customContent } : {}),
          }]
        : [],
    )

    if (zernioTargets.length > 0) {
      answer.validation = await validateZernioPost({
        content,
        platforms: zernioTargets,
      }).catch(() => null)
    }

    // TikTok refuses a privacy level the creator is not allowed to pick, and it
    // only says so at publish time. Asked here, the switches the account cannot
    // use are greyed before anyone touches them.
    const tiktokAccountId =
      typeof body.tiktokAccountId === 'string' && body.tiktokAccountId.trim() !== ''
        ? body.tiktokAccountId
        : null
    if (tiktokAccountId && access.brand.profileId) {
      answer.tiktok = await fetchTikTokCreatorInfo({
        accountId: tiktokAccountId,
        profileId: access.brand.profileId,
      }).catch(() => null)
    }

    answer.checked = answer.length !== null || answer.validation !== null
    return NextResponse.json(answer)
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/social/validate POST',
          err,
          'This post could not be checked just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}
