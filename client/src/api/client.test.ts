import { afterEach, describe, expect, it, vi } from 'vitest'
import { shouldRetry } from '@/lib/queryClient'
import { ApiError, apiUrl, getJsonArray, requestJson } from './client'

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn().mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), init))

const rejection = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiUrl', () => {
  it('prefixes the API path', () => {
    expect(apiUrl('/service', '')).toBe('/api/service')
  })

  it('passes on only the mock flags from the page URL', () => {
    expect(apiUrl('/service', '?type=lab_test&mockDelay=2000&mockFail=providers')).toBe(
      '/api/service?mockDelay=2000&mockFail=providers',
    )
  })
})

describe('getJsonArray', () => {
  it('returns the array', async () => {
    vi.stubGlobal('fetch', respond([{ id: 1 }]))
    await expect(getJsonArray('/providers')).resolves.toEqual([{ id: 1 }])
  })

  it('throws a retryable http error for a 500', async () => {
    vi.stubGlobal('fetch', respond({ error: 'boom' }, { status: 500 }))
    const error = await rejection(getJsonArray('/service'))
    expect(error).toMatchObject({ kind: 'http', status: 500, path: '/service', retryable: true })
  })

  it('does not retry a 404', async () => {
    vi.stubGlobal('fetch', respond({ error: 'Not found' }, { status: 404 }))
    expect((await rejection(getJsonArray('/service'))).retryable).toBe(false)
  })

  it('rejects a response that is not a JSON array', async () => {
    vi.stubGlobal('fetch', respond({ data: [] }))
    expect(await rejection(getJsonArray('/service'))).toMatchObject({ kind: 'invalid', retryable: false })

    vi.stubGlobal('fetch', respond('<html>'))
    expect((await rejection(getJsonArray('/service'))).kind).toBe('invalid')
  })

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await rejection(getJsonArray('/service'))).toMatchObject({ kind: 'network', retryable: true })
  })

  it('reports offline without making a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('navigator', { onLine: false })
    expect((await rejection(getJsonArray('/service'))).kind).toBe('offline')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('lets a cancelled request reject as an abort, not a failure', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(getJsonArray('/service', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('requestJson', () => {
  it('sends a JSON body with the method', async () => {
    const fetch = respond({ ok: true })
    vi.stubGlobal('fetch', fetch)
    await requestJson('/cart/items/a', { method: 'PATCH', body: { quantity: 3 } })
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/cart/items/a')
    expect(init).toMatchObject({ method: 'PATCH', body: '{"quantity":3}' })
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('returns undefined for 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(requestJson('/cart/items/a', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('reads the error code, message and details the server sends', async () => {
    vi.stubGlobal('fetch', respond({ code: 'quantity_limit', message: 'Up to 10', details: { maxQuantity: 10 } }, { status: 409 }))
    expect(await rejection(requestJson('/cart/items/a', { method: 'PATCH', body: {} }))).toMatchObject({
      kind: 'http',
      status: 409,
      code: 'quantity_limit',
      serverMessage: 'Up to 10',
      details: { maxQuantity: 10 },
      retryable: false,
    })
  })

  it('copes with an error response that is not JSON', async () => {
    vi.stubGlobal('fetch', respond('Bad Gateway', { status: 502 }))
    expect(await rejection(requestJson('/cart'))).toMatchObject({ status: 502, code: null, serverMessage: null })
  })

  it('does not retry a declined payment', async () => {
    vi.stubGlobal('fetch', respond({ code: 'payment_declined' }, { status: 402 }))
    expect((await rejection(requestJson('/checkout', { method: 'POST', body: {} }))).retryable).toBe(false)
  })
})

describe('shouldRetry', () => {
  it('retries retryable errors up to twice', () => {
    const error = new ApiError('http', '/service', 'boom', 500)
    expect([0, 1, 2].map((count) => shouldRetry(count, error))).toEqual([true, true, false])
  })

  it('gives up straight away on errors retrying cannot fix', () => {
    expect(shouldRetry(0, new ApiError('invalid', '/service', 'bad'))).toBe(false)
  })
})
