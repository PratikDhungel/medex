import { afterEach, describe, expect, it, vi } from 'vitest'
import { mergeGuestCart, removeLine, selectLineDuration, updateLineQuantity } from './cart'
import { ApiError } from './client'
import { getOrder, placeOrder } from './orders'

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init))

const cart = { groups: [], totalItems: 0 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cart API', () => {
  it('PATCHes the quantity and returns the cart', async () => {
    const fetch = respond({ cart })
    vi.stubGlobal('fetch', fetch)
    await expect(updateLineQuantity('a/b', 3)).resolves.toEqual(cart)
    expect(fetch.mock.calls[0]).toEqual([
      '/api/cart/items/a%2Fb',
      expect.objectContaining({ method: 'PATCH', body: '{"quantity":3}' }),
    ])
  })

  it('PATCHes the chosen duration', async () => {
    const fetch = respond({ cart })
    vi.stubGlobal('fetch', fetch)
    await selectLineDuration('a', 'w90')
    expect(fetch.mock.calls[0][1]).toMatchObject({ body: '{"wellnessPricingId":"w90"}' })
  })

  it('rejects a response without a cart', async () => {
    vi.stubGlobal('fetch', respond({ groups: [] }))
    await expect(updateLineQuantity('a', 1)).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('removes a line with DELETE', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(removeLine('a')).resolves.toBeUndefined()
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('returns merge changes, dropping any without a kind', async () => {
    vi.stubGlobal('fetch', respond({ cart, changes: [{ kind: 'added', productId: 'p' }, { productId: 'q' }, null] }))
    await expect(mergeGuestCart([{ productId: 'p', quantity: 1 }])).resolves.toEqual({
      cart,
      changes: [{ kind: 'added', productId: 'p' }],
    })
  })

  it('rejects a merge response without changes', async () => {
    vi.stubGlobal('fetch', respond({ cart }))
    await expect(mergeGuestCart([])).rejects.toMatchObject({ kind: 'invalid' })
  })
})

describe('orders API', () => {
  const request = {
    groupType: 'package',
    items: [{ lineId: 'a', quantity: 1, wellnessPricingId: null }],
    paymentMethod: 'card' as const,
    idempotencyKey: 'key-12345',
  }

  it('posts the checkout and returns the order', async () => {
    const fetch = respond({ orderId: 'o1', status: 'pending', extra: true }, { status: 201 })
    vi.stubGlobal('fetch', fetch)
    await expect(placeOrder(request)).resolves.toEqual({ orderId: 'o1', status: 'pending' })
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(request)
  })

  it('surfaces the mismatches when the cart changed', async () => {
    const details = { mismatches: [{ lineId: 'a', reason: 'quantity_changed' }] }
    vi.stubGlobal('fetch', respond({ code: 'cart_changed', message: 'Changed', details }, { status: 409 }))
    const error = (await placeOrder(request).catch((e: unknown) => e)) as ApiError
    expect(error).toMatchObject({ status: 409, code: 'cart_changed', details })
  })

  it('never guesses an order status it does not know', async () => {
    vi.stubGlobal('fetch', respond({ orderId: 'o1', status: 'complete' }))
    await expect(getOrder('o1')).rejects.toMatchObject({ kind: 'invalid' })
  })
})
