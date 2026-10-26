import type { RawCart } from './raw'

/**
 * The cart with some line quantities replaced, e.g. ones the customer just
 * changed that the server hasn't confirmed yet. Returns the same object when
 * there's nothing to replace, so memoised work downstream isn't redone.
 */
export function withQuantities(cart: RawCart, quantities: ReadonlyMap<string, number>): RawCart {
  if (quantities.size === 0) return cart
  return {
    ...cart,
    groups: cart.groups.map((group) =>
      Array.isArray(group.items)
        ? {
            ...group,
            items: (group.items as { id?: unknown }[]).map((line) =>
              typeof line?.id === 'string' && quantities.has(line.id) ? { ...line, quantity: quantities.get(line.id) } : line,
            ),
          }
        : group,
    ),
  }
}

/** A line's quantity in a server cart, or null when the line isn't there */
export function quantityIn(cart: RawCart, lineId: string): number | null {
  for (const group of cart.groups) {
    if (!Array.isArray(group.items)) continue
    for (const line of group.items as { id?: unknown; quantity?: unknown }[]) {
      if (line?.id === lineId) return typeof line.quantity === 'number' ? line.quantity : null
    }
  }
  return null
}
