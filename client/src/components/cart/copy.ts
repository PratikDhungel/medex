import { UNKNOWN_GROUP } from '@/domain/cart/normalise'
import type { BlockReason, CartGroup, CartLine } from '@/domain/cart/model'
import { serviceTypeLabel } from '@/domain/serviceTypes'

// Customer-facing wording for the cart, kept in one place so it stays consistent.

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })

export const formatList = (items: string[]) => listFormat.format(items)

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** A group with nothing left to book (e.g. the API's `unknown` group of removed services) */
export function groupLabel(group: CartGroup): string {
  return group.bookable && group.type !== UNKNOWN_GROUP ? serviceTypeLabel(group.type) : 'No longer available'
}

export function lineTitle(line: CartLine): string {
  return line.title ?? 'A service that is no longer offered'
}

/** Shown where the price would be, for a line without one */
export function blockedPriceText(reason: BlockReason): string {
  switch (reason) {
    case 'needs-duration':
      return 'Price shown once you choose a duration'
    case 'no-durations':
    case 'price-missing':
      return 'Price unavailable'
    case 'invalid-quantity':
      return 'Quantity needs checking'
  }
}

/** Why a group can't be booked yet, one sentence per blocked line */
export function blockerText(reason: BlockReason, title: string): string {
  switch (reason) {
    case 'needs-duration':
      return `Choose a duration for ${title}.`
    case 'no-durations':
      return `${title} has no duration that can be booked online. Remove it, or contact the provider.`
    case 'price-missing':
      return `${title} has no price at the moment. Remove it, or contact the provider.`
    case 'invalid-quantity':
      return `${title} has a quantity we can't book. Change the quantity, or remove it.`
  }
}
