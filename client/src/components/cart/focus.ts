import type { Cart } from '@/domain/cart/model'

// Element ids for moving focus around the cart from script.

export const lineElementId = (lineId: string) => `cart-line-${lineId}`
export const groupHeadingId = (type: string) => `cart-group-${type}`

/**
 * Where focus goes once a line is removed, so a keyboard or screen-reader
 * user carries on from where they were: the next line in the group, else the
 * previous one, else the next group's heading, else the previous group's.
 * Null when nothing is left: focus the page heading.
 */
export function focusTargetAfterRemoval(cart: Cart, lineId: string): string | null {
  const groupIndex = cart.groups.findIndex((group) => group.lines.some((line) => line.id === lineId))
  if (groupIndex === -1) return null

  const { lines } = cart.groups[groupIndex]
  const index = lines.findIndex((line) => line.id === lineId)
  const sibling = lines[index + 1] ?? lines[index - 1]
  if (sibling) return lineElementId(sibling.id)

  const nextGroup = cart.groups[groupIndex + 1] ?? cart.groups[groupIndex - 1]
  return nextGroup ? groupHeadingId(nextGroup.type) : null
}
