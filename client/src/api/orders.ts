import { queryOptions } from '@tanstack/react-query'
import type { CheckoutItem } from '@/domain/cart/summary'
import { ORDER_STATUSES, type OrderStatus, type PaymentMethod, type PlacedOrder } from '@/domain/checkout/model'
import { ApiError, requestJson } from './client'

export interface CheckoutRequest {
  groupType: string
  items: CheckoutItem[]
  paymentMethod: PaymentMethod
  /** Same key, same request → the same order, never a second one */
  idempotencyKey: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** An order id and a status we know. Anything else is unusable: guessing an order's status is never safe. */
function readOrder(body: unknown, path: string): PlacedOrder {
  if (
    !isObject(body) ||
    typeof body.orderId !== 'string' ||
    !ORDER_STATUSES.includes(body.status as OrderStatus)
  ) {
    throw new ApiError('invalid', path, 'The server sent an unexpected order')
  }
  return { orderId: body.orderId, status: body.status as OrderStatus }
}

/**
 * Places one group's order. Errors to expect:
 *   402: card declined (no order was created)
 *   409: the cart changed (`details.mismatches`), or the key was reused for a different request
 *   500 / network: the order may or may not exist; retry with the same key to find out
 */
export async function placeOrder(request: CheckoutRequest): Promise<PlacedOrder> {
  return readOrder(await requestJson('/checkout', { method: 'POST', body: request }), '/checkout')
}

export async function getOrder(orderId: string, signal?: AbortSignal): Promise<PlacedOrder> {
  const path = `/orders/${encodeURIComponent(orderId)}`
  return readOrder(await requestJson(path, { signal }), path)
}

export const orderKey = (orderId: string) => ['order', orderId] as const

export const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: orderKey(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
  })
