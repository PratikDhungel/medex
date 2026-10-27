import type { Money } from './model'

export const toCents = (amount: number) => Math.round(amount * 100)

/** Price × quantity, in whole cents so fractional prices don't drift */
export const lineTotal = (unitPrice: number, quantity: number) => (toCents(unitPrice) * quantity) / 100

/**
 * Adds amounts per currency, one entry per currency sorted by code. There is
 * no exchange rate, so different currencies are kept apart, never converted.
 */
export function totalsByCurrency(amounts: Money[]): Money[] {
  const cents = new Map<string, number>()
  for (const { amount, currency } of amounts) {
    cents.set(currency, (cents.get(currency) ?? 0) + toCents(amount))
  }
  return [...cents]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, amount: total / 100 }))
}
