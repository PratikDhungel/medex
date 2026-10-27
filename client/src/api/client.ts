// Mock-API flags (see server/README.md). Adding them to the page URL, e.g.
// /?mockFail=providers, passes them on to every API request.
const MOCK_PARAMS = ['mockDelay', 'mockFail', 'mockFailRate'] as const

export type ApiErrorKind =
  /** The browser reports no connection */
  | 'offline'
  /** The request never got a response */
  | 'network'
  /** The server responded with an error status */
  | 'http'
  /** The response wasn't the JSON shape we expected */
  | 'invalid'

/** The error body the cart API sends: `{ code, message, details? }` */
export interface ApiErrorBody {
  code: string | null
  /** The server's own wording; the UI prefers its own copy, chosen by `code` */
  serverMessage: string | null
  details?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly path: string
  readonly code: string | null
  readonly serverMessage: string | null
  readonly details: unknown

  constructor(
    kind: ApiErrorKind,
    path: string,
    message: string,
    status: number | null = null,
    body: Partial<ApiErrorBody> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.path = path
    this.status = status
    this.code = body.code ?? null
    this.serverMessage = body.serverMessage ?? null
    this.details = body.details
  }

  /** Whether trying again could help: not for responses we can't use */
  get retryable(): boolean {
    if (this.kind === 'http') return this.status === null || this.status >= 500 || this.status === 429
    return this.kind !== 'invalid'
  }
}

export function apiUrl(path: string, pageSearch = globalThis.location?.search ?? ''): string {
  const pageParams = new URLSearchParams(pageSearch)
  const params = new URLSearchParams()
  for (const key of MOCK_PARAMS) {
    const value = pageParams.get(key)
    if (value !== null) params.set(key, value)
  }
  const query = params.toString()
  return `/api${path}${query ? `?${query}` : ''}`
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  /** Sent as JSON */
  body?: unknown
  signal?: AbortSignal
}

/** Reads `{ code, message, details }` from an error response, if it has one */
async function errorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null) {
      const { code, message, details } = body as Record<string, unknown>
      return {
        code: typeof code === 'string' ? code : null,
        serverMessage: typeof message === 'string' ? message : null,
        details,
      }
    }
  } catch {
    // Not JSON: the status alone has to do
  }
  return { code: null, serverMessage: null }
}

/**
 * Sends a request and returns its JSON body, or undefined for 204 No Content.
 * Every failure is thrown as an ApiError.
 *
 * A `network` error on a write means the outcome is unknown: the request may
 * have reached the server before the connection failed. An `offline` error
 * means it was never sent.
 */
export async function requestJson(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<unknown> {
  if (globalThis.navigator?.onLine === false) {
    throw new ApiError('offline', path, 'You appear to be offline')
  }

  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // Cancellation isn't a failure; let the caller see it as-is
    if (signal?.aborted) throw error
    throw new ApiError('network', path, 'Could not reach the server')
  }

  if (!response.ok) {
    throw new ApiError('http', path, `The server responded with ${response.status}`, response.status, await errorBody(response))
  }
  if (response.status === 204) return undefined

  try {
    return await response.json()
  } catch {
    throw new ApiError('invalid', path, 'The server sent a response that is not JSON')
  }
}

/** GETs a JSON array. Every failure is thrown as an ApiError. */
export async function getJsonArray<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const body = await requestJson(path, { signal })
  if (!Array.isArray(body)) {
    throw new ApiError('invalid', path, 'The server sent an unexpected response')
  }
  return body as T[]
}
