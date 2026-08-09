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
      if (typeof toolName !== 'string' || output?.success !== true) continue

      successfulToolNames.push(toolName)
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
