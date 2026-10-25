// Plain non-negative decimals only: "6200", "6200.00". Anything else
// ("6,200.00", "฿6200", "-5", "", "abc") is rejected rather than guessed at.
const MONEY_PATTERN = /^\d+(\.\d+)?$/

/** Parses an API money string. Returns null when absent or malformed. */
export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return MONEY_PATTERN.test(trimmed) ? Number(trimmed) : null
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatters.set(key, formatter)
  }
  return formatter
}

/**
 * Formats an amount in its own currency. This is the only place prices are
 * rounded: whole amounts drop the decimals, others show two.
 */
export function formatMoney(amount: number, currency: string): string {
  const cents = Math.round(amount * 100)
  return formatterFor(currency, cents % 100 === 0 ? 0 : 2).format(cents / 100)
}
