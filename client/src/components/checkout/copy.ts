import { plural } from '@/components/cart/copy'
import type { GroupOrder, SessionSummary } from '@/domain/checkout/machine'
import type { PaymentMethod } from '@/domain/checkout/model'
import { serviceTypeLabel } from '@/domain/serviceTypes'

// Customer-facing wording for checkout. Each order is explained on its own,
// in terms of what happened to the customer's money and booking.

export const methodLabel = (method: PaymentMethod) => (method === 'card' ? 'Pay by card now' : 'Pay at the clinic')

export const orderLabel = (order: Pick<GroupOrder, 'groupType'>) => serviceTypeLabel(order.groupType)

/** A short reference the customer can quote, from the order id */
export const orderReference = (orderId: string) => orderId.slice(0, 8).toUpperCase()

export type Tone = 'progress' | 'success' | 'warning' | 'error'

export interface OrderStatusText {
  tone: Tone
  title: string
  body: string
}

export function orderStatusText(order: GroupOrder): OrderStatusText {
  const { phase } = order
  switch (phase.kind) {
    case 'queued':
      return order.attempts === 0
        ? { tone: 'progress', title: 'Waiting', body: 'This order will be placed after the ones before it.' }
        : { tone: 'progress', title: 'Waiting to try again', body: 'This order will be placed again shortly.' }
    case 'submitting':
      return { tone: 'progress', title: 'Placing your order…', body: 'Please keep this page open.' }
    case 'confirming':
      return {
        tone: 'progress',
        title: 'Order placed. Confirming your payment…',
        body: 'This usually takes a few seconds. You can leave this page; we will keep checking.',
      }
    case 'paid':
      return { tone: 'success', title: 'Paid and booked', body: 'Your payment went through and your booking is confirmed.' }
    case 'booked':
      return {
        tone: 'success',
        title: 'Booked. Pay at the clinic',
        body: 'Your booking is confirmed. You will pay the provider on the day.',
      }
    case 'interrupted':
      return {
        tone: 'warning',
        title: "We couldn't confirm this order",
        body:
          phase.reason === 'offline'
            ? "You were offline, so it wasn't sent. Try again once you're back online."
            : 'It may or may not have gone through. Trying again is safe: you will never be charged twice for it.',
      }
    case 'declined':
      return {
        tone: 'error',
        title: 'Your card was declined',
        body: "No order was placed and you haven't been charged. Try again, or choose to pay at the clinic.",
      }
    case 'payment_failed':
      return {
        tone: 'error',
        title: "The payment didn't go through",
        body: "This booking wasn't made and you haven't been charged. Its items are back in your cart.",
      }
    case 'cart_changed':
      return {
        tone: 'warning',
        title: 'Your cart changed',
        body: 'Some items changed before this order was placed, so nothing was charged. Check them and place it again.',
      }
    case 'rejected':
      return {
        tone: 'error',
        title: "We couldn't place this order",
        body: "Nothing was charged. Please try again later or contact us if it keeps happening.",
      }
  }
}

/** One sentence for the whole checkout, announced as it changes */
export function sessionSummaryText({ total, done, inProgress, needsAction }: SessionSummary): string {
  const attention = `${needsAction} ${needsAction === 1 ? 'needs' : 'need'} your attention`
  if (inProgress > 0) {
    const progress = `${done} of ${plural(total, 'order')} done, ${inProgress} still in progress`
    return needsAction > 0 ? `${progress}, ${attention}.` : `${progress}.`
  }
  if (needsAction === 0) {
    return total === 1 ? 'Your order is done.' : `All ${total} orders are done.`
  }
  if (done === 0) {
    return needsAction === 1 ? 'Your order needs your attention.' : `None of the ${total} orders went through yet.`
  }
  return `${done} of ${plural(total, 'order')} done. ${attention}.`
}
