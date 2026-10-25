import { parseMoney } from './money'
import type { RawAdjustmentType, RawPricing } from './raw'

export type PricingIssue =
  | 'invalid-discount'
  | 'invalid-service-charge'
  | 'discount-exceeds-price'

export interface Price {
  /** Listed price before any discount */
  original: number
  afterDiscount: number
  serviceCharge: number
  /** afterDiscount + serviceCharge, unrounded */
  final: number
  hasDiscount: boolean
  issues: PricingIssue[]
}

/**
 * Resolves a discount or service charge to an amount. A missing value or
 * type means "none". Malformed input also counts as none, flagged by `ok`.
 */
function adjustment(
  rawValue: string | null,
  type: RawAdjustmentType | null,
  base: number,
): { amount: number; ok: boolean } {
  if (rawValue === null && type === null) return { amount: 0, ok: true }

  const value = parseMoney(rawValue)
  if (value === null) return { amount: 0, ok: false }
  if (value === 0) return { amount: 0, ok: true }

  switch (type) {
    case 'percent':
      return { amount: (base * value) / 100, ok: true }
    case 'amount':
      return { amount: value, ok: true }
    default:
      return { amount: 0, ok: false }
  }
}

/**
 * finalPrice = afterDiscount + serviceCharge.
 *
 * A percentage service charge is taken on the discounted price. A discount
 * larger than the price is capped so the price never goes below zero.
 * Returns null when there is no usable price ("Price on request").
 */
export function computePrice(pricing: RawPricing): Price | null {
  const original = parseMoney(pricing.price)
  if (original === null) return null

  const issues: PricingIssue[] = []

  const discount = adjustment(pricing.discount, pricing.discountType, original)
  if (!discount.ok) issues.push('invalid-discount')

  let afterDiscount = original - discount.amount
  if (afterDiscount < 0) {
    issues.push('discount-exceeds-price')
    afterDiscount = 0
  }

  const charge = adjustment(pricing.serviceCharge, pricing.serviceChargeType, afterDiscount)
  if (!charge.ok) issues.push('invalid-service-charge')

  return {
    original,
    afterDiscount,
    serviceCharge: charge.amount,
    final: afterDiscount + charge.amount,
    hasDiscount: afterDiscount < original,
    issues,
  }
}
