import { ApiError } from '@/api/client'
import { UNKNOWN_GROUP } from '@/domain/cart/normalise'
import type { BlockReason, CartGroup, CartLine } from '@/domain/cart/model'
import { serviceTypeLabel } from '@/domain/serviceTypes'
import type { QuantityFailure } from '@/state/quantitySync'

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

/** Why a quantity change didn't stick, and what the line shows now */
export function quantityFailureText({ error, restored }: QuantityFailure): string {
  if (restored === null) {
    return "We couldn't confirm that change, so we've reloaded your cart to show what's saved."
  }
  const back = `It's back to ${restored}.`

  if (error instanceof ApiError) {
    if (error.kind === 'offline') return `You're offline, so the quantity wasn't changed. ${back}`
    if (error.code === 'quantity_limit') {
      const max = (error.details as { maxQuantity?: unknown } | undefined)?.maxQuantity
      return `You can book up to ${typeof max === 'number' ? max : 'a limited number'} of one service at a time. ${back}`
    }
    if (error.code === 'unavailable') return "This service is no longer offered, so its quantity can't be changed."
    if (error.status === 404) return 'This item is no longer in your cart.'
    if (error.status === 409) return `The quantity couldn't be changed right now. ${back}`
  }
  return `Something went wrong on our side, so the quantity wasn't changed. ${back} Please try again.`
}
