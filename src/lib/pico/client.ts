export type PicoSearchMode = 'clinician' | 'plain' | 'both'

export interface PicoSearchRequest {
  question: string
  mode?: PicoSearchMode
  department_hint?: string[]
  client_name?: string
}

export interface PicoSearchSubmission {
  job_id: string
  poll_url: string
  poll_interval_ms: number
  estimated_seconds: number
}

export interface PicoSearchStatus {
  id: string
  status: 'queued' | 'routing' | 'fan_out' | 'ranking' | 'synthesising' | 'completed' | 'failed'
  envelope?: unknown
  error?: string | null
  [key: string]: unknown
}

export interface PicoSearchClientOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
}

const DEFAULT_PICO_SEARCH_BASE = 'https://www.picosearch.ai'

export function getPicoSearchConfig(
  env: Record<string, string | undefined> = process.env,
): { baseUrl: string; apiKey: string } | null {
  const apiKey = env.PICO_SEARCH_API_KEY?.trim()
  if (!apiKey || !apiKey.startsWith('pks_')) return null
  const rawBase = env.PICO_SEARCH_API_BASE?.trim() || DEFAULT_PICO_SEARCH_BASE
  return { baseUrl: rawBase.replace(/\/$/, ''), apiKey }
}

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as Record<string, unknown>).error
  return typeof error === 'string' && error.trim() ? error : null
}

async function requestPico<T>(
  path: string,
  init: RequestInit,
  options: PicoSearchClientOptions,
): Promise<T> {
  const config = getPicoSearchConfig(options.env)
  if (!config) throw new Error('PICO Search is not configured for this NRS deployment.')

  const response = await (options.fetchImpl ?? fetch)(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
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
    throw new Error(`PICO Search request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  return payload as T
}

/**
 * Starts PICO's asynchronous, source-grounded clinical evidence workflow.
 * This is server-only: the bearer token must never reach a browser.
 */
export function submitPicoSearch(
  input: PicoSearchRequest,
  options: PicoSearchClientOptions = {},
): Promise<PicoSearchSubmission> {
  return requestPico<PicoSearchSubmission>('/api/v1/search', {
    method: 'POST',
    body: JSON.stringify(input),
  }, options)
}

/** Polls an evidence search already owned by the configured PICO tenant. */
export function getPicoSearchResult(
  jobId: string,
  options: PicoSearchClientOptions = {},
): Promise<PicoSearchStatus> {
  return requestPico<PicoSearchStatus>(`/api/v1/search?job_id=${encodeURIComponent(jobId)}`, {
    method: 'GET',
  }, options)
}
