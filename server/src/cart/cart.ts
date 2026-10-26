import type { Cart, CartGroup, CartLine, Product } from './types.js'

/** Group for lines whose product was removed and so has no type */
export const UNKNOWN_GROUP = 'unknown'

export function isAvailable(product: CartLine['product']): product is Product {
  return typeof (product as Partial<Product>).id === 'string'
}

function validAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Final price per unit, or null while it's unknown: a wellness line without a
 * chosen duration, a removed product, or a price the provider got wrong.
 */
export function unitPrice(line: CartLine): number | null {
  const { product } = line
  if (!isAvailable(product)) return null
  if (product.type === 'wellness') {
    const option = product.wellnessPricing?.find((o) => o.id === line.wellnessPricingId)
    return validAmount(option?.amount_after_service_charge)
  }
  return validAmount(product.price)
}

export function groupTypeOf(line: CartLine): string {
  return isAvailable(line.product) && line.product.type ? line.product.type : UNKNOWN_GROUP
}

/**
 * Totals per currency over the lines that have a price. Amounts are summed in
 * minor units so fractional prices (e.g. 23009.5) don't drift. Currencies are
 * never added together.
 */
export function totalsByCurrency(lines: CartLine[]): Record<string, number> {
  const minor = new Map<string, number>()
  for (const line of lines) {
    const price = unitPrice(line)
    if (price === null || !isAvailable(line.product)) continue
    const { currency } = line.product
    minor.set(currency, (minor.get(currency) ?? 0) + Math.round(price * 100) * line.quantity)
  }
  return Object.fromEntries([...minor].map(([currency, amount]) => [currency, amount / 100]))
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** The GET /v2/cart shape, recomputed from the lines on every call */
export function buildCart(lines: CartLine[]): Cart {
  const byType = new Map<string, CartLine[]>()
  for (const line of lines) {
    const type = groupTypeOf(line)
    const group = byType.get(type)
    if (group) group.push(line)
    else byType.set(type, [line])
  }

  const groups: CartGroup[] = [...byType].map(([type, items]) => ({
    type,
    itemCount: sum(items.map((line) => line.quantity)),
    unpricedItems: sum(items.filter((line) => unitPrice(line) === null).map((line) => line.quantity)),
    subtotals: totalsByCurrency(items),
    items: structuredClone(items),
  }))

  return { groups, totalItems: sum(groups.map((group) => group.itemCount)) }
}

/** Cart lines in group order. Wellness lines always carry `wellnessPricingId`, null until chosen. */
export function flattenCart(cart: { groups: { items: CartLine[] }[] }): CartLine[] {
  return cart.groups.flatMap((group) =>
    group.items.map((line) =>
      isAvailable(line.product) && line.product.type === 'wellness'
        ? { ...structuredClone(line), wellnessPricingId: line.wellnessPricingId ?? null }
        : structuredClone(line),
    ),
  )
}
