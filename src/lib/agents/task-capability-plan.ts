import type { AgentType } from '@/types/database'
import {
  runParallelAgents,
  type WorkerContext,
  type WorkerResult,
} from './worker'

/**
 * A small, explicit contract for work that must not be answered from the
 * Director's general-purpose conversation alone.  It deliberately maps a
 * user request to evidence and an accountable department before the Director
 * is asked to synthesise an answer.
 */
export type DirectorTaskCapability =
  | 'canva_asset'
  | 'video_evidence'
  | 'website_evidence'
  | 'competitor_research'
  | 'current_research'
  | 'caption_hashtag_analysis'
  | 'product_identity'
  | 'compliance_review'

export interface CapabilityRequirement {
  capability: DirectorTaskCapability
  agentType: AgentType
  /** A specialist may use one of these tools; a prose-only answer is not evidence. */
  requiredAnyToolNames?: readonly string[]
  withWebSearch?: boolean
  summary: string
}

export interface DirectorTaskPlan {
  version: 1
  request: string
  requirements: CapabilityRequirement[]
}

export interface DirectorTaskPlanOptions {
  /** The active brand is required for a product-identity gate, never inferred from prose. */
  brandSlug?: string
  /** AHPRA/TGA work needs cited corpus evidence instead of a prose-only review. */
  regulated?: boolean
}

export interface CapabilityExecution {
  capability: DirectorTaskCapability
  agentType: AgentType
  model: string
  toolNames: string[]
  evidenceSatisfied: boolean
  result: string
  error?: string
}

export interface DirectorTaskPlanExecution {
  plan: DirectorTaskPlan
  capabilities: CapabilityExecution[]
  totalCostCents: number
  totalTokens: number
  durationMs: number
}

const WEBSITE_REQUEST = /\b(?:website|web\s*site|landing\s*page|site\s*(?:audit|scan|review)|cro|elements?\s*map)\b/i
const WEBSITE_ACTION = /\b(?:audit|analyse|analyze|scan|review|crawl|map|improve|conversion|seo)\b/i
const COMPETITOR_REQUEST = /\b(?:competitor|competition|rival|market intelligence|competitive)\b/i
const CURRENT_RESEARCH_REQUEST = /\b(?:current|latest|recent|today|202[5-9]|google|geo|search\s*(?:result|trend|landscape)|ai\s*(?:trend|landscape|news))\b/i
// Captions alone are social-copy work. Video evidence is required only when
// the owner actually supplies or refers to video/media/transcript material.
const VIDEO_REQUEST = /\b(?:video|reel|clip|footage|subtitles?|transcri(?:be|ption)|uploaded\s+media)\b/i
const VIDEO_EVIDENCE_REQUEST = /\b(?:analyse|analyze|review|repurpose|caption|subtitle|transcri(?:be|ption)|uploaded|media)\b/i
const CANVA_REQUEST = /\b(?:canva|graphic|creative|visual|image)\b/i
const CANVA_ACTION = /\b(?:create|generate|design|make|build)\b/i
const CAPTION_REQUEST = /\b(?:caption|captions|hashtags?|hook|social copy|post copy)\b/i
const COMPLIANCE_REQUEST = /\b(?:ahpra|tga|compliance|regulat(?:ion|ory)|health claim|therapeutic claim)\b/i
const PRODUCT_LANGUAGE = /\b(?:product|fragrance|perfume|scent|cologne|bottle|notes?)\b/i

function hasAny(text: string, ...patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function addRequirement(
  requirements: CapabilityRequirement[],
  requirement: CapabilityRequirement,
) {
  if (!requirements.some((candidate) => candidate.capability === requirement.capability)) {
    requirements.push(requirement)
  }
}

/**
 * Pure, deterministic routing. It deliberately does not attempt to classify
 * every chat message: ordinary conversation remains cheap and fast. The
 * recognised work below has a concrete evidence or specialist requirement.
 */
export function planDirectorTask(
  request: string,
  options: DirectorTaskPlanOptions = {},
): DirectorTaskPlan {
  const requirements: CapabilityRequirement[] = []
  const scentSell = options.brandSlug?.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'scentsell'

  if (hasAny(request, WEBSITE_REQUEST) && hasAny(request, WEBSITE_ACTION)) {
    addRequirement(requirements, {
      capability: 'website_evidence',
      agentType: 'website',
      requiredAnyToolNames: ['scan_website', 'browse_page'],
      summary: 'Capture website evidence before making website, SEO, CRO, or elements-map claims.',
    })
  }

  if (COMPETITOR_REQUEST.test(request)) {
    addRequirement(requirements, {
      capability: 'competitor_research',
      agentType: 'competitor',
      withWebSearch: true,
      requiredAnyToolNames: ['web_search', 'deep_competitor_scan', 'scan_website', 'browse_page'],
      summary: 'Use current competitor evidence instead of a generic comparison.',
    })
  }

  if (CURRENT_RESEARCH_REQUEST.test(request) && hasAny(request, /\b(?:research|analyse|analyze|review|find|check|trend|landscape|google|geo|seo|ai)\b/i)) {
    addRequirement(requirements, {
      capability: 'current_research',
      agentType: 'seo',
      withWebSearch: true,
      requiredAnyToolNames: ['web_search'],
      summary: 'Use dated web evidence for current AI, Google, GEO, and search claims.',
    })
  }

  if (hasAny(request, VIDEO_REQUEST) && hasAny(request, VIDEO_EVIDENCE_REQUEST)) {
    addRequirement(requirements, {
      capability: 'video_evidence',
      agentType: 'video',
      requiredAnyToolNames: ['query_media', 'process_media'],
      summary: 'Read the actual media/transcript evidence before recommending a video treatment.',
    })
  }

  if (hasAny(request, CANVA_REQUEST) && hasAny(request, CANVA_ACTION)) {
    addRequirement(requirements, {
      capability: 'canva_asset',
      agentType: 'brand',
      // `design_graphic` only opens a blank editable Canva canvas. It must not
      // make a request look complete when no actual asset or structured design
      // was produced.
      requiredAnyToolNames: ['generate_image', 'generate_design_structured'],
      summary: 'Use the Brand specialist and a real asset/design action for Canva or image work.',
    })
  }

  if (CAPTION_REQUEST.test(request)) {
    addRequirement(requirements, {
      capability: 'caption_hashtag_analysis',
      agentType: 'content',
      summary: 'Have Content & Copy create and assess the caption and hashtag treatment.',
    })
  }

  // ScentSell is the one brand where a plausible-but-wrong product name has
  // already reached customer-facing copy. Product identity is a required
  // source receipt before a caption can make named fragrance claims.
  if (scentSell && CAPTION_REQUEST.test(request) && PRODUCT_LANGUAGE.test(request)) {
    addRequirement(requirements, {
      capability: 'product_identity',
      agentType: 'content',
      requiredAnyToolNames: ['verify_product'],
      summary: 'Verify every named fragrance or product with the catalogue before making a ScentSell product claim. Unresolved names must stay unnamed.',
    })
  }

  if (COMPLIANCE_REQUEST.test(request)) {
    addRequirement(requirements, {
      capability: 'compliance_review',
      agentType: 'compliance',
      ...(options.regulated ? { requiredAnyToolNames: ['use_abe_ai'] } : {}),
      summary: 'Use the regulatory specialist before making compliance conclusions.',
    })
  }

  return { version: 1, request, requirements }
}

function toExecution(requirement: CapabilityRequirement, worker: WorkerResult): CapabilityExecution {
  const expected = requirement.requiredAnyToolNames ?? []
  const evidenceSatisfied = !expected.length || worker.toolNames.some((toolName) => expected.includes(toolName))

  return {
    capability: requirement.capability,
    agentType: requirement.agentType,
    model: worker.model,
    toolNames: worker.toolNames,
    evidenceSatisfied,
    result: worker.result,
    ...(worker.error ? { error: worker.error } : {}),
  }
}

/** Execute all necessary specialists before the Director synthesises a response. */
export async function executeDirectorTaskPlan(
  plan: DirectorTaskPlan,
  ctx: WorkerContext,
): Promise<DirectorTaskPlanExecution> {
  if (plan.requirements.length === 0) {
    return { plan, capabilities: [], totalCostCents: 0, totalTokens: 0, durationMs: 0 }
  }

  const execution = await runParallelAgents(
    plan.requirements.map((requirement) => ({
      agentType: requirement.agentType,
      task: plan.request,
      options: {
        taskCapability: requirement.capability,
        withWebSearch: requirement.withWebSearch,
        requiredAnyToolNames: requirement.requiredAnyToolNames,
        contextOverride: `## REQUIRED CAPABILITY\n${requirement.summary}\n\nReturn evidence and conclusions for the Director. Do not claim a tool or source was used unless it ran in this turn.`,
      },
    })),
    ctx,
  )

  // Two capabilities can legitimately use the same department. Keying this
  // map by department silently assigned the last Content result to both the
  // caption and ScentSell identity requirements.
  const byCapability = new Map(
    execution.results
      .concat(execution.errors)
      .filter((result) => Boolean(result.taskCapability))
      .map((result) => [result.taskCapability, result]),
  )
  const capabilities = plan.requirements.map((requirement) => {
    const worker = byCapability.get(requirement.capability)
    return worker
      ? toExecution(requirement, worker)
      : {
          capability: requirement.capability,
          agentType: requirement.agentType,
          model: 'none',
          toolNames: [],
          evidenceSatisfied: false,
          result: '',
          error: 'The required specialist did not return a result.',
        }
  })

  return {
    plan,
    capabilities,
    totalCostCents: execution.totalCostCents,
    totalTokens: execution.totalTokens,
    durationMs: execution.totalDurationMs,
  }
}

/** Give the Director bounded, attributable source material instead of a vague delegation instruction. */
export function buildDirectorCapabilityContext(execution: DirectorTaskPlanExecution): string | null {
  if (!execution.capabilities.length) return null

  const sections = execution.capabilities.map((capability) => {
    const status = capability.error
      ? `FAILED: ${capability.error}`
      : capability.evidenceSatisfied
        ? 'COMPLETED WITH REQUIRED EVIDENCE'
        : 'COMPLETED WITHOUT THE REQUIRED EVIDENCE'
    const tools = capability.toolNames.length ? capability.toolNames.join(', ') : 'none'
    const result = capability.result.trim() || 'No specialist output was returned.'
    return `### ${capability.capability} — ${status}\nDepartment: ${capability.agentType}\nModel: ${capability.model}\nTools actually used: ${tools}\n\n${result}`
  })

  return [
    '## REQUIRED SPECIALIST WORK — ALREADY EXECUTED',
    'Use the evidence below in your answer. Do not claim an evidence-backed conclusion for any capability marked failed or without required evidence; say what could not be verified instead.',
    ...sections,
  ].join('\n\n')
}
