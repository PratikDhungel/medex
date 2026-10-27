import type { Cart, CartGroup, Money } from './model'
import { totalsByCurrency } from './totals'

export interface CartSummary {
  /** What the priced items add up to, one entry per currency, never combined */
  totals: Money[]
  /** Separate orders the cart becomes: one per bookable group */
  orderCount: number
  /** Orders that can be placed now */
  readyOrderCount: number
  /** Items (by quantity) whose price is still unknown, so not in `totals` */
  unpricedCount: number
  /** Removed services, which no order includes */
  unavailableCount: number
}

/**
 * The cart-wide picture: what the customer will pay in each currency, across
 * how many separate orders, and what isn't priced yet. Unknown prices are
 * counted, never added in as zero.
 */
export function summariseCart(cart: Cart): CartSummary {
  const bookable = cart.groups.filter((group) => group.bookable)
  const lines = cart.groups.flatMap((group) => group.lines)

  return {
    totals: totalsByCurrency(bookable.flatMap((group) => group.subtotals)),
    orderCount: bookable.length,
    readyOrderCount: bookable.filter((group) => group.ready).length,
    unpricedCount: lines.filter((line) => line.status.kind === 'blocked').reduce((sum, line) => sum + line.quantity, 0),
    unavailableCount: lines.filter((line) => line.status.kind === 'unavailable').length,
  }
}

export interface CheckoutItem {
  lineId: string
  quantity: number
  wellnessPricingId: string | null
}

/**
 * What POST /checkout gets for a group: every line that can be booked, exactly
 * as the customer sees it, so the server can refuse if the cart has changed.
 * Removed services are left out. Throws if the group isn't ready.
 */
export function checkoutItems(group: CartGroup): CheckoutItem[] {
  if (!group.ready) throw new Error(`Group "${group.type}" is not ready for checkout`)
  return group.lines
    .filter((line) => line.status.kind === 'priced')
    .map((line) => ({ lineId: line.id, quantity: line.quantity, wellnessPricingId: line.selectedDurationId }))
}
