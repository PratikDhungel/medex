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

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly path: string

  constructor(kind: ApiErrorKind, path: string, message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.path = path
    this.status = status
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

/** GETs a JSON array. Every failure is thrown as an ApiError. */
export async function getJsonArray<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  if (globalThis.navigator?.onLine === false) {
    throw new ApiError('offline', path, 'You appear to be offline')
  }

  let response: Response
  try {
    response = await fetch(apiUrl(path), { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    // Cancellation isn't a failure; let the caller see it as-is
    if (signal?.aborted) throw error
    throw new ApiError('network', path, 'Could not reach the server')
  }

  if (!response.ok) {
    throw new ApiError('http', path, `The server responded with ${response.status}`, response.status)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiError('invalid', path, 'The server sent a response that is not JSON')
  }
  if (!Array.isArray(body)) {
    throw new ApiError('invalid', path, 'The server sent an unexpected response')
  }
  return body as T[]
}
