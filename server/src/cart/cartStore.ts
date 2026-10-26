import { buildCart, isAvailable } from './cart.js'
import { ApiError } from './errors.js'
import type { Cart, CartLine } from './types.js'

/** Most of one service a customer can book in one go; above this PATCH returns 409 */
export const MAX_QUANTITY = 10

/** The logged-in customer's cart, held in memory. `reset` restores the seed data. */
export class CartStore {
  private lines: CartLine[] = []
  private readonly seed: CartLine[]

  constructor(seed: CartLine[]) {
    this.seed = structuredClone(seed)
    this.reset()
  }

  reset() {
    this.lines = structuredClone(this.seed)
  }

  get cart(): Cart {
    return buildCart(this.lines)
  }

  line(lineId: string): CartLine | undefined {
    return this.lines.find((line) => line.id === lineId)
  }

  private require(lineId: string): CartLine {
    const line = this.line(lineId)
    if (!line) throw new ApiError(404, 'line_not_found', 'This item is no longer in your cart.')
    return line
  }

  private requireAvailable(lineId: string) {
    const line = this.require(lineId)
    if (!isAvailable(line.product)) {
      throw new ApiError(409, 'unavailable', 'This service is no longer offered, so it can only be removed.')
    }
    return { line, product: line.product }
  }

  setQuantity(lineId: string, quantity: number) {
    const { line } = this.requireAvailable(lineId)
    if (quantity > MAX_QUANTITY) {
      throw new ApiError(409, 'quantity_limit', `You can book up to ${MAX_QUANTITY} of one service at a time.`, {
        maxQuantity: MAX_QUANTITY,
      })
    }
    line.quantity = quantity
  }

  selectWellnessOption(lineId: string, optionId: string) {
    const { line, product } = this.requireAvailable(lineId)
    if (product.type !== 'wellness') {
      throw new ApiError(400, 'not_wellness', 'Only wellness services have a duration to choose.')
    }
    if (!product.wellnessPricing?.some((option) => option.id === optionId)) {
      throw new ApiError(409, 'option_unavailable', 'That duration is no longer offered. Please choose another.')
    }
    line.wellnessPricingId = optionId
  }

  /** Idempotent: removing a line that's already gone is not an error */
  remove(lineId: string) {
    this.lines = this.lines.filter((line) => line.id !== lineId)
  }

  /** Removes lines that became part of an order and returns them */
  take(lineIds: string[]): CartLine[] {
    const ids = new Set(lineIds)
    const taken = this.lines.filter((line) => ids.has(line.id))
    this.lines = this.lines.filter((line) => !ids.has(line.id))
    return taken
  }

  /** Puts an order's lines back, e.g. after its payment failed. Lines still in the cart are left alone. */
  restore(lines: CartLine[]) {
    for (const line of lines) {
      if (!this.line(line.id)) this.lines.push(structuredClone(line))
    }
  }
}
