// Orders as the checkout API reports them.

export type PaymentMethod = 'card' | 'pay_at_clinic'

/**
 * `pending` means different things by payment method: for a card, the payment
 * is still being confirmed; for pay at clinic, the booking is made and payment
 * happens at the visit.
 */
export type OrderStatus = 'pending' | 'paid' | 'failed'

export const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'failed']

export interface PlacedOrder {
  orderId: string
  status: OrderStatus
}
