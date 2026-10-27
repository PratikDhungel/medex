import { randomUUID } from 'node:crypto'
import { MAX_QUANTITY, type CartStore } from './cartStore.js'
import type { CartLine, Product } from './types.js'

/**
 * What happened to one guest cart item, so the client can tell the customer.
 * One item can produce more than one change (e.g. a duration applied and a
 * quantity raised).
 */
export type MergeChange =
  /** Not in the account's cart: added as a new line */
  | { kind: 'added'; productId: string; lineId: string; title: string; quantity: number }
  /** In both carts: the larger quantity is kept */
  | {
      kind: 'kept_larger_quantity'
      productId: string
      lineId: string
      title: string
      quantity: number
      accountQuantity: number
      guestQuantity: number
    }
  /** In both carts, and the account already had at least as many */
  | { kind: 'already_in_cart'; productId: string; lineId: string; title: string; quantity: number }
  /** The account's line had no duration yet; the one chosen as a guest is used */
  | {
      kind: 'duration_applied'
      productId: string
      lineId: string
      title: string
      wellnessPricingId: string
      durationInMinutes: number
    }
  /** The guest's chosen duration isn't offered any more; the customer must pick again */
  | { kind: 'duration_not_offered'; productId: string; lineId: string; title: string }
  /** More than one booking allows; lowered to the limit */
  | { kind: 'quantity_capped'; productId: string; lineId: string; title: string; requested: number; quantity: number }
  /** The product isn't in the catalog any more: not added */
  | { kind: 'not_offered'; productId: string }
  /** Unreadable item (no product id, or a quantity that isn't a whole number of at least 1): not added */
  | { kind: 'invalid_item'; index: number; productId: string | null }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The account line a guest item folds into, or undefined to add a new line.
 * Two different durations of a wellness service are different bookings, so
 * they stay on separate lines.
 */
function matchingLine(lines: CartLine[], product: Product, optionId: string | null): CartLine | undefined {
  if (product.type !== 'wellness' || optionId === null) return lines[0]
  return (
    lines.find((line) => line.wellnessPricingId === optionId) ??
    lines.find((line) => (line.wellnessPricingId ?? null) === null)
  )
}

/**
 * Merges a guest's cart into the account's cart and reports each change.
 *
 * Quantities are never added together: the larger one wins. A customer who
 * put 3 tests in a guest cart and 2 in their account wants 3, not 5. This also
 * makes the merge safe to repeat: sending the same guest cart twice changes
 * nothing the second time.
 */
export function mergeGuestCart(
  cart: CartStore,
  catalog: ReadonlyMap<string, Product>,
  items: unknown[],
  newLineId: () => string = randomUUID,
): MergeChange[] {
  const changes: MergeChange[] = []

  items.forEach((item, index) => {
    if (!isObject(item) || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || (item.quantity as number) < 1) {
      const productId = isObject(item) && typeof item.productId === 'string' ? item.productId : null
      changes.push({ kind: 'invalid_item', index, productId })
      return
    }

    const { productId } = item
    const product = catalog.get(productId)
    if (!product) {
      changes.push({ kind: 'not_offered', productId })
      return
    }

    const { title } = product
    const requested = item.quantity as number
    const quantity = Math.min(requested, MAX_QUANTITY)
    const isWellness = product.type === 'wellness'
    const option = isWellness ? product.wellnessPricing?.find((o) => o.id === item.wellnessPricingId) : undefined
    const optionNotOffered = isWellness && typeof item.wellnessPricingId === 'string' && !option

    const target = matchingLine(cart.linesFor(productId), product, option?.id ?? null)
    let lineId: string

    if (target) {
      lineId = target.id
      const accountQuantity = target.quantity
      let durationApplied = false

      if (option && (target.wellnessPricingId ?? null) === null) {
        cart.selectWellnessOption(lineId, option.id)
        changes.push({
          kind: 'duration_applied',
          productId,
          lineId,
          title,
          wellnessPricingId: option.id,
          durationInMinutes: option.durationInMinutes,
        })
        durationApplied = true
      }

      if (quantity > accountQuantity) {
        cart.setQuantity(lineId, quantity)
        changes.push({
          kind: 'kept_larger_quantity',
          productId,
          lineId,
          title,
          quantity,
          accountQuantity,
          guestQuantity: requested,
        })
      } else if (!durationApplied) {
        changes.push({ kind: 'already_in_cart', productId, lineId, title, quantity: accountQuantity })
      }
    } else {
      lineId = newLineId()
      cart.add({
        id: lineId,
        productId,
        quantity,
        product: structuredClone(product),
        ...(isWellness ? { wellnessPricingId: option?.id ?? null } : {}),
      })
      changes.push({ kind: 'added', productId, lineId, title, quantity })
    }

    if (requested > MAX_QUANTITY) {
      changes.push({ kind: 'quantity_capped', productId, lineId, title, requested, quantity })
    }
    if (optionNotOffered) {
      changes.push({ kind: 'duration_not_offered', productId, lineId, title })
    }
  })

  return changes
}
