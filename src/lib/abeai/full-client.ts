import { getAbeAiConfig } from './regulatory-corpus'

export interface AbeAiRequest {
  path: string
  method: 'GET' | 'POST'
  body?: unknown
  query?: Record<string, string | undefined>
}

export interface AbeAiRequestOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
}

function buildUrl(baseUrl: string, path: string, query?: AbeAiRequest['query']): string {
  const url = new URL(path, `${baseUrl}/`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  return url.toString()
}

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as Record<string, unknown>).error
  return typeof error === 'string' && error.trim() ? error : null
}

/**
 * Calls an Abe AI HTTP endpoint with the organisation-scoped Abe key.
 * The key never crosses to the browser: this helper is server-only because
 * it is reached exclusively from NRS AI SDK tools.
 */
export async function requestAbeAi<T = unknown>(
  request: AbeAiRequest,
  options: AbeAiRequestOptions = {},
): Promise<T> {
  const config = getAbeAiConfig(options.env)
  if (!config) {
    throw new Error('Abe AI is not configured for this NRS deployment.')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(buildUrl(config.baseUrl, request.path, request.query), {
    method: request.method,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
      ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    signal: options.signal,
  })

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const detail = errorMessage(payload) ?? (typeof payload === 'string' ? payload : null)
    throw new Error(`Abe AI request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  return payload as T
}
