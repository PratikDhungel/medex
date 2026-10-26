import { randomUUID } from 'node:crypto'
import { groupTypeOf, isAvailable, totalsByCurrency, unitPrice } from './cart.js'
import type { CartStore } from './cartStore.js'
import { ApiError } from './errors.js'
import type { CartLine, OrderStatus, PaymentMethod } from './types.js'

export interface CheckoutItem {
  lineId: string
  quantity: number
  wellnessPricingId?: string | null
}

export interface CheckoutRequest {
  groupType: string
  items: CheckoutItem[]
  paymentMethod: PaymentMethod
  idempotencyKey: string
}

export interface CheckoutResult {
  orderId: string
  status: OrderStatus
}

export interface Order extends CheckoutResult {
  groupType: string
  paymentMethod: PaymentMethod
  items: CartLine[]
  totals: Record<string, number>
  createdAt: string
}

/** How a card payment ends, and how long the payment provider takes to tell us */
export interface Settlement {
  outcome: 'paid' | 'failed'
  afterMs: number
}

export type Scheduler = (run: () => void, ms: number) => void

/** Why a checkout item no longer matches the cart, sent back with a 409 */
export type MismatchReason =
  | 'not_in_cart'
  | 'wrong_group'
  | 'unavailable'
  | 'quantity_changed'
  | 'option_changed'
  | 'price_unknown'

function mismatchOf(line: CartLine, item: CheckoutItem, groupType: string): MismatchReason | null {
  if (groupTypeOf(line) !== groupType) return 'wrong_group'
  if (!isAvailable(line.product)) return 'unavailable'
  if (line.quantity !== item.quantity) return 'quantity_changed'
  if ((line.wellnessPricingId ?? null) !== (item.wellnessPricingId ?? null)) return 'option_changed'
  if (unitPrice(line) === null) return 'price_unknown'
  return null
}

/** Same fields in the same order, so equal requests always match */
function fingerprintOf({ groupType, items, paymentMethod }: CheckoutRequest): string {
  const sorted = [...items]
    .sort((a, b) => a.lineId.localeCompare(b.lineId))
    .map(({ lineId, quantity, wellnessPricingId }) => [lineId, quantity, wellnessPricingId ?? null])
  return JSON.stringify([groupType, paymentMethod, sorted])
}

/**
 * Turns one cart group into one order.
 *
 * Idempotency: the first successful request for a key is stored. Repeating it
 * returns the same order, with its current status, and never creates or
 * charges another. Reusing a key
 * for a different request is refused. Requests that fail (409, 500) store
 * nothing, so the same key can be retried.
 *
 * Card orders start `pending` and settle later, like a real payment provider.
 * If payment fails, the lines go back into the cart. Pay-at-clinic orders stay
 * `pending`: the booking is made and payment is taken at the visit.
 */
export class OrderService {
  private readonly orders = new Map<string, Order>()
  /** Idempotency key → the request it was first used for and the order it created */
  private readonly completed = new Map<string, { fingerprint: string; orderId: string }>()
  private readonly cart: CartStore
  private readonly settlement: () => Settlement
  private readonly schedule: Scheduler

  constructor(cart: CartStore, settlement: () => Settlement, schedule: Scheduler = (run, ms) => void setTimeout(run, ms)) {
    this.cart = cart
    this.settlement = settlement
    this.schedule = schedule
  }

  reset() {
    this.orders.clear()
    this.completed.clear()
  }

  order(orderId: string): Order | undefined {
    return this.orders.get(orderId)
  }

  checkout(request: CheckoutRequest): CheckoutResult {
    const fingerprint = fingerprintOf(request)
    const previous = this.completed.get(request.idempotencyKey)
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new ApiError(409, 'idempotency_key_reused', 'This checkout key was already used for a different order.')
      }
      // The order as it is now: a replay after settlement reports paid, not the original pending
      const { orderId, status } = this.orders.get(previous.orderId)!
      return { orderId, status }
    }

    const lines = this.matchCart(request)
    if (request.groupType === 'insurance' && request.paymentMethod === 'pay_at_clinic') {
      throw new ApiError(400, 'payment_method_unavailable', 'Insurance can only be paid by card.')
    }

    const order: Order = {
      orderId: randomUUID(),
      status: 'pending',
      groupType: request.groupType,
      paymentMethod: request.paymentMethod,
      items: this.cart.take(lines.map((line) => line.id)),
      totals: totalsByCurrency(lines),
      createdAt: new Date().toISOString(),
    }
    this.orders.set(order.orderId, order)

    this.completed.set(request.idempotencyKey, { fingerprint, orderId: order.orderId })

    if (order.paymentMethod === 'card') {
      const { outcome, afterMs } = this.settlement()
      this.schedule(() => this.settle(order.orderId, outcome), afterMs)
    }
    return { orderId: order.orderId, status: order.status }
  }

  private settle(orderId: string, outcome: Settlement['outcome']) {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'pending') return
    order.status = outcome
    if (outcome === 'failed') this.cart.restore(order.items)
  }

  /** The cart lines the request names, or a 409 listing every item that no longer matches */
  private matchCart({ groupType, items }: CheckoutRequest): CartLine[] {
    const lines: CartLine[] = []
    const mismatches: { lineId: string; reason: MismatchReason }[] = []

    for (const item of items) {
      const line = this.cart.line(item.lineId)
      const reason = line ? mismatchOf(line, item, groupType) : 'not_in_cart'
      if (reason) mismatches.push({ lineId: item.lineId, reason })
      else if (line) lines.push(line)
    }

    if (mismatches.length > 0) {
      throw new ApiError(409, 'cart_changed', 'Your cart changed before this order was placed.', { mismatches })
    }
    return lines
  }
}
