import type { RawMergeChange } from '@/domain/cart/raw'
import { plural } from './copy'

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback)
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/**
 * What the merge did, one sentence per change, in the customer's terms.
 * Items that couldn't be added are summed up in one sentence at the end:
 * the data has no title for them, so the count is all we can say. Kinds this
 * client doesn't know are left out rather than shown as gibberish.
 */
export function describeMergeChanges(changes: RawMergeChange[]): string[] {
  const sentences: string[] = []
  let notOffered = 0
  let unreadable = 0

  for (const change of changes) {
    const title = text(change.title, 'An item')
    switch (change.kind) {
      case 'added': {
        const quantity = count(change.quantity)
        sentences.push(quantity && quantity > 1 ? `${title} (×${quantity}) added.` : `${title} added.`)
        break
      }
      case 'kept_larger_quantity':
        sentences.push(
          `${title}: kept ${count(change.quantity) ?? 'the larger quantity'} from before you logged in` +
            (count(change.accountQuantity) !== null ? ` (your account had ${change.accountQuantity}).` : '.'),
        )
        break
      case 'already_in_cart':
        sentences.push(`${title} was already in your cart.`)
        break
      case 'duration_applied':
        sentences.push(
          count(change.durationInMinutes) !== null
            ? `${title}: we used the ${change.durationInMinutes} min you chose earlier.`
            : `${title}: we used the duration you chose earlier.`,
        )
        break
      case 'duration_not_offered':
        sentences.push(`${title}: the duration you chose is no longer offered. Please choose another.`)
        break
      case 'quantity_capped':
        sentences.push(`${title}: you can book up to ${count(change.quantity) ?? 'a limited number'} at a time, so we kept that many.`)
        break
      case 'not_offered':
        notOffered += 1
        break
      case 'invalid_item':
        unreadable += 1
        break
    }
  }

  if (notOffered > 0) {
    sentences.push(
      `${plural(notOffered, 'item')} you added before logging in ${notOffered === 1 ? 'is' : 'are'} no longer offered, so ${
        notOffered === 1 ? 'it was' : 'they were'
      } not added.`,
    )
  }
  if (unreadable > 0) {
    sentences.push(`${plural(unreadable, 'item')} from before you logged in couldn't be read, so ${unreadable === 1 ? 'it was' : 'they were'} not added.`)
  }
  return sentences
}
