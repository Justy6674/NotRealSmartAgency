type DirectorStep = {
  finishReason?: string
  toolCalls?: readonly unknown[]
}

type DirectorGeneration = {
  text: string
  finishReason?: string
  steps?: readonly DirectorStep[]
}

export type DirectorCompletion =
  | { complete: true; response: string }
  | { complete: false; reason: string }

/**
 * A Director job is only complete once it has a final human response.
 * A tool call in the final step means the model was still gathering facts
 * when its step budget ended; storing its bridge sentence as a finished job
 * gives the user a false success.
 */
export function getDirectorCompletion(result: DirectorGeneration): DirectorCompletion {
  const response = result.text.trim()
  if (!response) {
    return { complete: false, reason: 'The Director ended without a final response.' }
  }

  if (result.finishReason === 'length') {
    return { complete: false, reason: 'The Director response was truncated before it finished.' }
  }

  const finalStep = result.steps?.at(-1)
  if (finalStep?.toolCalls?.length) {
    return {
      complete: false,
      reason: 'The Director reached its tool-step limit while still gathering information.',
    }
  }

  return { complete: true, response }
}
