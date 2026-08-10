export interface CanvaDesignReceipt {
  designId: string
  editUrl: string
}

export interface CanvaMediaReceipt {
  designId: string
  mediaItemId: string
  fileUrl: string
  fileName: string
}

export interface CarouselProposalReceipt {
  outputId: string
}

export interface WorkerToolEvidence {
  /** Every tool call across every AI SDK step, in execution order. */
  toolNames: string[]
  /** Tools whose own result explicitly reported success. */
  successfulToolNames: string[]
  /** A Canva Autofill job only counts once it returned a concrete editable design. */
  completedCanvaDesigns: CanvaDesignReceipt[]
  /** A design is not a deliverable until its exported file is saved by NRS. */
  importedCanvaMedia: CanvaMediaReceipt[]
  /** The review record, created only from saved slide receipts. */
  carouselProposal: CarouselProposalReceipt | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

/**
 * Did this tool actually run, or did it report a failure?
 *
 * The previous rule accepted only an OBJECT output carrying `success`,
 * `updated`, `created` or `requested` — the shapes durable-write tools return.
 * Every read tool in this codebase returns markdown prose or a plain data
 * object with no such flag, so none of them could ever be counted:
 *
 *   query_media     5 string returns, no success flag  → never counted
 *   query_outputs   3 string returns, no success flag  → never counted
 *   verify_product  6 object returns, no success flag  → never counted
 *   scan_website    1 object return,  no success flag  → never counted
 *
 * Those are precisely the tools the evidence contract names. So
 * `product_identity`, which requires `verify_product`, could not be satisfied
 * by any execution — and the Director, told its evidence was unsatisfied,
 * reported to the owner that "the verification check failed" and withheld a
 * fragrance name it had in fact resolved correctly. The check had not failed.
 * It could not succeed.
 *
 * The rule now is the honest one: a tool ran unless it said otherwise. An
 * explicit failure flag or an `error` field means no; blank output means no;
 * anything else is a tool that executed and returned something.
 *
 * Known limit, stated rather than hidden: a read tool that catches its own
 * fault and returns `userSafeError`'s prose is indistinguishable here from one
 * that succeeded, because both are a non-empty string. Tools whose failure
 * must be visible to the contract return `{ error }` instead — see
 * query_media. Extend that shape rather than pattern-matching English here.
 */
export function toolRunSucceeded(output: unknown): boolean {
  if (typeof output === 'string') return output.trim().length > 0
  if (output === null || output === undefined) return false
  if (typeof output !== 'object') return true

  const value = output as Record<string, unknown>
  if (value.success === false || value.ok === false) return false
  if (value.error !== undefined && value.error !== null) return false
  if (Array.isArray(output)) return output.length > 0
  return Object.keys(value).length > 0
}

/**
 * AI SDK's `result.toolCalls` contains only the last step. Evidence must read
 * every `result.steps` entry and inspect tool results, not merely the model's
 * final answer or a tool name that might have failed.
 */
export function collectWorkerToolEvidence(steps: readonly unknown[] | undefined): WorkerToolEvidence {
  const toolNames: string[] = []
  const successfulToolNames: string[] = []
  const completedCanvaDesigns: CanvaDesignReceipt[] = []
  const importedCanvaMedia: CanvaMediaReceipt[] = []
  let carouselProposal: CarouselProposalReceipt | null = null

  for (const step of steps ?? []) {
    const stepRecord = record(step)
    if (!stepRecord) continue

    const calls = Array.isArray(stepRecord.toolCalls) ? stepRecord.toolCalls : []
    for (const call of calls) {
      const toolName = record(call)?.toolName
      if (typeof toolName === 'string') toolNames.push(toolName)
    }

    const results = Array.isArray(stepRecord.toolResults) ? stepRecord.toolResults : []
    for (const result of results) {
      const resultRecord = record(result)
      if (!resultRecord || resultRecord.type !== 'tool-result') continue
      const toolName = resultRecord.toolName
      const output = record(resultRecord.output)
      if (typeof toolName !== 'string' || !toolRunSucceeded(resultRecord.output)) continue

      successfulToolNames.push(toolName)

      // Canva receipts are concrete identifiers, so they are read only from a
      // structured output. A prose result can prove a tool RAN — it can never
      // prove a design exists, and that distinction is the whole point of the
      // Canva minimums.
      if (!output) continue

      if (toolName === 'generate_design_structured') {
        const designId = output.design_id
        const editUrl = output.edit_url
        if (typeof designId === 'string' && designId && typeof editUrl === 'string' && editUrl) {
          completedCanvaDesigns.push({ designId, editUrl })
        }
      }
      if (toolName === 'import_canva_design_to_media') {
        const designId = output.design_id
        const mediaItemId = output.media_item_id
        const fileUrl = output.file_url
        const fileName = output.file_name
        if (
          typeof designId === 'string' && designId
          && typeof mediaItemId === 'string' && mediaItemId
          && typeof fileUrl === 'string' && fileUrl
          && typeof fileName === 'string' && fileName
        ) {
          importedCanvaMedia.push({ designId, mediaItemId, fileUrl, fileName })
        }
      }
      if (toolName === 'create_carousel_proposal' && typeof output.output_id === 'string' && output.output_id) {
        carouselProposal = { outputId: output.output_id }
      }
    }
  }

  return { toolNames, successfulToolNames, completedCanvaDesigns, importedCanvaMedia, carouselProposal }
}
