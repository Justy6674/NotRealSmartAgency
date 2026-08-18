/**
 * Failure handling for every Zernio call in this codebase.
 *
 * Depended on by: `client.ts`, `posts.ts`, `validate.ts`, `queue.ts`,
 * `media.ts`, `accounts.ts`, `engagement.ts`, `insights.ts`, and any route or
 * script that still has to reach the publisher with a raw `fetch`.
 *
 * ── The fault this file exists for ──────────────────────────────────────
 *
 * A wrong path under `https://zernio.com/api/v1/` does NOT return 404. It
 * returns **HTTP 200 with an HTML page** — the publisher's own web shell.
 * Measured on 2026-08-18 against `/v1/validate/post` (the real path is
 * `/v1/tools/validate/post`) and `/v1/analytics/best-time-to-post` (really
 * `/v1/analytics/best-time`).
 *
 * Every hand-rolled call site in NRS guarded with `if (!res.ok) throw`. On a
 * wrong path that guard **cannot fire**. What happens instead is either a JSON
 * parse error thrown far from its cause, or — worse — a shape that reads as
 * empty-but-successful, so a brand with 210 published posts shows an empty
 * screen and nothing anywhere says a word.
 *
 * So the check is on the CONTENT TYPE, not the status code. HTML back from a
 * JSON endpoint means the path is wrong. It never means "no data".
 */

import { messageOf } from '@/lib/errors/user-safe'

/**
 * What a person is told when the publisher cannot be reached.
 *
 * Owner-facing copy names no vendor, no protocol and no status code. "Zernio",
 * "API" and "OAuth" are words the owner has never had to learn and must not
 * start here.
 */
export const OWNER_PUBLISHER_UNREACHABLE =
  'Could not reach the service that posts to your accounts. Nothing was sent.'

export const OWNER_PUBLISHER_NOT_CONFIGURED =
  'Posting to your accounts is not set up on this site yet.'

export class ZernioError extends Error {
  readonly operation: string
  readonly status?: number

  constructor(operation: string, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ZernioError'
    this.operation = operation
    if (options?.status !== undefined) this.status = options.status
  }

  /** Safe to read aloud. The detail stays in the logs where it belongs. */
  get ownerMessage(): string {
    return OWNER_PUBLISHER_UNREACHABLE
  }
}

/**
 * A JSON endpoint answered with a web page. The path is wrong.
 *
 * Kept as its own class so a caller can tell "we asked the wrong question"
 * apart from "the answer was no" — the first is our bug and should page a
 * developer, the second is ordinary.
 */
export class ZernioHtmlResponseError extends ZernioError {
  constructor(operation: string, status: number, contentType: string) {
    super(
      operation,
      `${operation}: the publisher returned ${contentType || 'no content type'} with HTTP ${status}. ` +
        'A JSON endpoint answering with a web page means the request path is wrong — ' +
        'a wrong path under zernio.com/api/v1 answers 200 with the site shell, never 404.',
      { status },
    )
    this.name = 'ZernioHtmlResponseError'
  }
}

/** Missing key is a deployment fact, not a failure of the call. */
export class ZernioNotConfiguredError extends ZernioError {
  constructor(operation: string) {
    super(operation, `${operation}: ZERNIO_API_KEY is not set on this deployment.`)
    this.name = 'ZernioNotConfiguredError'
  }

  override get ownerMessage(): string {
    return OWNER_PUBLISHER_NOT_CONFIGURED
  }
}

function contentTypeOf(res: { headers?: { get(name: string): string | null } }): string {
  return (res.headers?.get('content-type') ?? '').toLowerCase()
}

function looksLikeJson(contentType: string): boolean {
  return contentType.includes('application/json') || contentType.includes('+json')
}

/**
 * The guard `if (!res.ok) throw` cannot be.
 *
 * Call it on EVERY raw `fetch` to zernio.com before touching the body. The
 * content type is checked first and independently of the status, because the
 * failure mode that matters arrives as a perfectly successful 200.
 */
export function assertZernioJson(
  res: Response,
  operation = 'zernio request',
): void {
  const contentType = contentTypeOf(res)

  if (!looksLikeJson(contentType)) {
    throw new ZernioHtmlResponseError(operation, res.status, contentType)
  }

  if (!res.ok) {
    throw new ZernioError(operation, `${operation}: HTTP ${res.status}`, { status: res.status })
  }
}

/** Assert, then parse. The two belong together often enough to say once. */
export async function zernioJson<T>(res: Response, operation: string): Promise<T> {
  assertZernioJson(res, operation)
  return (await res.json()) as T
}

/**
 * Read `error` before `data`, which is the SDK's contract and easy to forget.
 *
 * Every `@zernio/node` call resolves to `{ data, error, response }` and does
 * NOT throw on an API error by default. Destructuring `{ data }` alone turns a
 * 401 into `undefined` and then into "no accounts", which is the same lie the
 * HTML trap tells in a different shape.
 */
export function unwrapZernio<T>(
  operation: string,
  result: { data?: T; error?: unknown; response?: Response } | null | undefined,
): T {
  if (!result) {
    throw new ZernioError(operation, `${operation}: the publisher returned nothing at all.`)
  }

  const response = result.response
  if (response) {
    const contentType = contentTypeOf(response)
    // The SDK builds its own paths, so this should never fire — and if it ever
    // does, it means the SDK and the deployed API have drifted, which is worth
    // an unmissable error rather than an empty list.
    if (contentType && !looksLikeJson(contentType)) {
      throw new ZernioHtmlResponseError(operation, response.status, contentType)
    }
  }

  if (result.error !== undefined && result.error !== null) {
    const detail = typeof result.error === 'string'
      ? result.error
      : messageOf((result.error as { error?: unknown }).error ?? result.error)
    throw new ZernioError(operation, `${operation}: ${detail}`, {
      ...(response ? { status: response.status } : {}),
      cause: result.error,
    })
  }

  if (result.data === undefined || result.data === null) {
    throw new ZernioError(operation, `${operation}: the publisher answered with no payload.`)
  }

  return result.data
}

/** One line for a catch block: log the truth, return the owner's version. */
export function zernioOwnerMessage(operation: string, err: unknown): string {
  console.error(`[zernio] ${operation} failed:`, messageOf(err))
  return err instanceof ZernioError ? err.ownerMessage : OWNER_PUBLISHER_UNREACHABLE
}
