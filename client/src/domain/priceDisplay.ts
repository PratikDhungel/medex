import type { ServicePricing } from './model'
import { formatMoney } from './money'

export type PriceDisplay =
  | { kind: 'on-request' }
  | {
      kind: 'amount'
      /** Formatted final price, or "Free" */
      final: string
      /** Formatted price before discount, shown struck through; null without a discount */
      original: string | null
      /** The cheapest of several durations: shown as "From …" */
      from: boolean
      /** Wellness duration info, e.g. "60 min" or "3 durations, 60–120 min" */
      detail: string | null
    }

function durationDetail(minutes: number[]): string {
  if (minutes.length === 1) return `${minutes[0]} min`
  return `${minutes.length} durations, ${minutes[0]}–${minutes[minutes.length - 1]} min`
}

/**
 * What a price shows. Wellness services show their cheapest duration
 * ("From"), with that duration's own discount struck through.
 */
export function describePrice(pricing: ServicePricing, currency: string | null): PriceDisplay {
  if (pricing.kind === 'none' || currency === null) return { kind: 'on-request' }

  const tiers = pricing.kind === 'tiers' ? pricing.tiers : null
  const price =
    pricing.kind === 'fixed'
      ? pricing.price
      : pricing.tiers.reduce((cheapest, tier) => (tier.price.final < cheapest.price.final ? tier : cheapest)).price

  const final = Math.round(price.final * 100) === 0 ? 'Free' : formatMoney(price.final, currency)

  return {
    kind: 'amount',
    final,
    original: price.hasDiscount ? formatMoney(price.original, currency) : null,
    from: tiers !== null && tiers.length > 1,
    detail: tiers === null ? null : durationDetail(tiers.map((tier) => tier.durationMinutes)),
  }
}
