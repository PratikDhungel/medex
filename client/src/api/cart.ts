import { queryOptions } from '@tanstack/react-query'
import type { RawCart, RawGuestCartItem, RawMergeChange } from '@/domain/cart/raw'
import { ApiError, requestJson } from './client'

// The cache holds the cart exactly as the server sent it. Components derive
// the clean model with normaliseCart, so optimistic edits can work on the
// same raw shape the server returns.

export const cartKey = ['cart'] as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks the `{ cart }` envelope. The lines inside are left to normaliseCart. */
function readCart(body: unknown, path: string): RawCart {
  const cart = isObject(body) ? body.cart : undefined
  if (!isObject(cart) || !Array.isArray(cart.groups)) {
    throw new ApiError('invalid', path, 'The server sent an unexpected cart')
  }
  return cart as unknown as RawCart
}

const linePath = (lineId: string) => `/cart/items/${encodeURIComponent(lineId)}`

export const cartQuery = queryOptions({
  queryKey: cartKey,
  queryFn: async ({ signal }) => readCart(await requestJson('/cart', { signal }), '/cart'),
})

/** Sets a line's quantity. 409 when the server refuses it (e.g. over the booking limit). */
export async function updateLineQuantity(lineId: string, quantity: number): Promise<RawCart> {
  const path = linePath(lineId)
  return readCart(await requestJson(path, { method: 'PATCH', body: { quantity } }), path)
}

/** Chooses a wellness line's duration */
export async function selectLineDuration(lineId: string, wellnessPricingId: string): Promise<RawCart> {
  const path = linePath(lineId)
  return readCart(await requestJson(path, { method: 'PATCH', body: { wellnessPricingId } }), path)
}

/** Removes a line. Succeeds when the line is already gone. */
export async function removeLine(lineId: string): Promise<void> {
  await requestJson(linePath(lineId), { method: 'DELETE' })
}

export interface MergeResult {
  cart: RawCart
  changes: RawMergeChange[]
}

/** Merges a guest's cart into the logged-in customer's cart */
export async function mergeGuestCart(items: RawGuestCartItem[]): Promise<MergeResult> {
  const path = '/cart/merge'
  const body = await requestJson(path, { method: 'POST', body: { items } })
  const cart = readCart(body, path)
  const changes = isObject(body) && Array.isArray(body.changes) ? body.changes : null
  if (changes === null) throw new ApiError('invalid', path, 'The server sent no list of changes')
  return {
    cart,
    // A change without a kind can't be explained to the customer
    changes: changes.filter((change): change is RawMergeChange => isObject(change) && typeof change.kind === 'string'),
  }
}
