import type { Money } from '../cart/model'
import type { CheckoutItem } from '../cart/summary'
import type { OrderStatus, PaymentMethod, PlacedOrder } from './model'

/**
 * Where one group's order is. Each group in a checkout is its own order, paid
 * on its own, so each has its own phase.
 */
export type OrderPhase =
  /** Waiting its turn */
  | { kind: 'queued' }
  /** POST /checkout sent, no answer yet. Saved before sending, so a reload knows a request was out. */
  | { kind: 'submitting' }
  /**
   * We don't know whether an order was created: a server error, a lost
   * connection, or a reload mid-request. Retried with the same key, which
   * either creates the order or returns the one that already exists.
   */
  | { kind: 'interrupted'; reason: 'server' | 'network' | 'offline' | 'unknown' }
  /** Order created; the card payment is being confirmed */
  | { kind: 'confirming'; orderId: string }
  | { kind: 'paid'; orderId: string }
  /** Order created to be paid at the clinic: booked, nothing more to do online */
  | { kind: 'booked'; orderId: string }
  /** Card declined (402); no order was created */
  | { kind: 'declined' }
  /** Order created but the card payment failed afterwards; its items went back to the cart */
  | { kind: 'payment_failed'; orderId: string }
  /** The cart no longer matches what was being ordered (409) */
  | { kind: 'cart_changed'; mismatches: { lineId: string; reason: string }[] }
  /** Refused for a reason retrying won't fix (400, or a key reused for a different request) */
  | { kind: 'rejected'; code: string | null }

export type OrderPhaseKind = OrderPhase['kind']

export interface GroupOrder {
  groupType: string
  /** Exactly what is being ordered, frozen when checkout starts */
  items: CheckoutItem[]
  /** What the customer saw they would pay, per currency */
  totals: Money[]
  paymentMethod: PaymentMethod
  /**
   * Sent with every attempt. Kept while an order might exist; set to null
   * ("spent") once an attempt is known to have ended without a usable order,
   * so the next attempt is a new order with a new key.
   */
  idempotencyKey: string | null
  /** Requests sent so far */
  attempts: number
  phase: OrderPhase
}

export interface CheckoutSession {
  version: 1
  id: string
  startedAt: string
  /** In the order they are submitted */
  orders: GroupOrder[]
}

/** How a POST /checkout failed, as the machine needs to know it */
export type CheckoutFailure =
  | { kind: 'declined' }
  | { kind: 'cart_changed'; mismatches: { lineId: string; reason: string }[] }
  | { kind: 'rejected'; code: string | null }
  | { kind: 'interrupted'; reason: 'server' | 'network' | 'offline' }

export type CheckoutEvent =
  /** About to send POST /checkout. `newKey` is used only if the order has no key yet. */
  | { type: 'submitting'; groupType: string; newKey: string }
  | { type: 'placed'; groupType: string; order: PlacedOrder }
  | { type: 'failed'; groupType: string; failure: CheckoutFailure }
  /** A later status from GET /orders/:id */
  | { type: 'status'; groupType: string; status: OrderStatus }
  /** The customer retries a failed order */
  | { type: 'retry'; groupType: string }
  | { type: 'set_method'; groupType: string; method: PaymentMethod }
  /** The customer accepts the cart as it is now, after it changed */
  | { type: 'update_items'; groupType: string; items: CheckoutItem[]; totals: Money[] }
  /** The page was loaded again: any request that was out has an unknown outcome */
  | { type: 'reloaded' }

const IN_PROGRESS: OrderPhaseKind[] = ['queued', 'submitting', 'confirming']
const DONE: OrderPhaseKind[] = ['paid', 'booked']
const RETRYABLE: OrderPhaseKind[] = ['interrupted', 'declined', 'payment_failed']

export const isInProgress = (order: GroupOrder) => IN_PROGRESS.includes(order.phase.kind)
export const isDone = (order: GroupOrder) => DONE.includes(order.phase.kind)
export const canRetry = (order: GroupOrder) => RETRYABLE.includes(order.phase.kind)

/**
 * The payment method can change only while no key is outstanding: before the
 * first attempt, or once the last attempt is known to have failed. Otherwise
 * the first attempt may already have created an order with the old method,
 * and a retry with the same key must be the same request.
 */
export const canChangeMethod = (order: GroupOrder) =>
  (order.phase.kind === 'queued' && order.attempts === 0) ||
  order.phase.kind === 'declined' ||
  order.phase.kind === 'payment_failed' ||
  order.phase.kind === 'cart_changed'

/** Payment methods a group can use. Insurance is paid online only. */
export const allowedMethods = (groupType: string): PaymentMethod[] =>
  groupType === 'insurance' ? ['card'] : ['card', 'pay_at_clinic']

export interface NewOrder {
  groupType: string
  items: CheckoutItem[]
  totals: Money[]
  paymentMethod: PaymentMethod
}

export function createSession(id: string, startedAt: string, orders: NewOrder[]): CheckoutSession {
  return {
    version: 1,
    id,
    startedAt,
    orders: orders.map((order) => ({ ...order, idempotencyKey: null, attempts: 0, phase: { kind: 'queued' } })),
  }
}

/** The next order to submit; orders go one at a time, in session order */
export function nextQueued(session: CheckoutSession): GroupOrder | undefined {
  return session.orders.find((order) => order.phase.kind === 'queued')
}

/** True while a request is out or an order is waiting its turn */
export function isRunning(session: CheckoutSession): boolean {
  return session.orders.some((order) => order.phase.kind === 'queued' || order.phase.kind === 'submitting')
}

/** The phase an order's reported status puts it in */
function phaseForStatus(order: GroupOrder, orderId: string, status: OrderStatus): OrderPhase {
  if (status === 'paid') return { kind: 'paid', orderId }
  if (status === 'failed') return { kind: 'payment_failed', orderId }
  // Pending means "payment being confirmed" for a card, "booked" for pay at clinic
  return order.paymentMethod === 'pay_at_clinic' ? { kind: 'booked', orderId } : { kind: 'confirming', orderId }
}

/** Phases after which a new attempt needs a new key: no usable order came of this one */
const SPENDS_KEY: OrderPhaseKind[] = ['declined', 'payment_failed', 'cart_changed', 'rejected']

function transition(order: GroupOrder, event: Exclude<CheckoutEvent, { type: 'reloaded' }>): GroupOrder {
  const { phase } = order
  const to = (next: OrderPhase): GroupOrder => ({
    ...order,
    phase: next,
    idempotencyKey: SPENDS_KEY.includes(next.kind) ? null : order.idempotencyKey,
  })

  switch (event.type) {
    case 'submitting':
      if (phase.kind !== 'queued') return order
      return {
        ...order,
        idempotencyKey: order.idempotencyKey ?? event.newKey,
        attempts: order.attempts + 1,
        phase: { kind: 'submitting' },
      }

    case 'placed':
      if (phase.kind !== 'submitting') return order
      return to(phaseForStatus(order, event.order.orderId, event.order.status))

    case 'failed':
      if (phase.kind !== 'submitting') return order
      return to(event.failure.kind === 'interrupted' ? { kind: 'interrupted', reason: event.failure.reason } : event.failure)

    case 'status':
      if (phase.kind !== 'confirming') return order
      return to(phaseForStatus(order, phase.orderId, event.status))

    case 'retry':
      return canRetry(order) ? { ...order, phase: { kind: 'queued' } } : order

    case 'set_method':
      if (!canChangeMethod(order) || !allowedMethods(order.groupType).includes(event.method)) return order
      return { ...order, paymentMethod: event.method }

    case 'update_items':
      if (phase.kind !== 'cart_changed') return order
      return { ...order, items: event.items, totals: event.totals, phase: { kind: 'queued' } }
  }
}

/**
 * Applies one event. Events that don't fit the order's phase (a late
 * response, a double click) are ignored, so the session never goes backwards.
 */
export function checkoutReducer(session: CheckoutSession, event: CheckoutEvent): CheckoutSession {
  if (event.type === 'reloaded') {
    return {
      ...session,
      orders: session.orders.map((order) =>
        order.phase.kind === 'submitting' ? { ...order, phase: { kind: 'interrupted', reason: 'unknown' } } : order,
      ),
    }
  }

  let changed = false
  const orders = session.orders.map((order) => {
    if (order.groupType !== event.groupType) return order
    const next = transition(order, event)
    if (next !== order) changed = true
    return next
  })
  return changed ? { ...session, orders } : session
}

/** The error fields the classifier reads; ApiError has them all */
export interface CheckoutErrorLike {
  kind: 'offline' | 'network' | 'http' | 'invalid'
  status: number | null
  code: string | null
  details?: unknown
}

/** Turns a POST /checkout error into what it means for the order */
export function classifyCheckoutError(error: CheckoutErrorLike): CheckoutFailure {
  if (error.kind === 'offline') return { kind: 'interrupted', reason: 'offline' }
  // No response, or one we couldn't read: the order may or may not exist
  if (error.kind === 'network' || error.kind === 'invalid') return { kind: 'interrupted', reason: 'network' }

  const { status, code } = error
  if (status === 402) return { kind: 'declined' }
  if (status === 409 && code === 'idempotency_key_reused') return { kind: 'rejected', code }
  if (status === 409) {
    const raw = (error.details as { mismatches?: unknown } | undefined)?.mismatches
    const mismatches = Array.isArray(raw)
      ? raw.filter((m): m is { lineId: string; reason: string } => typeof m?.lineId === 'string' && typeof m?.reason === 'string')
      : []
    return { kind: 'cart_changed', mismatches }
  }
  if (status !== null && status >= 400 && status < 500 && status !== 429) return { kind: 'rejected', code }
  // 5xx, 429: the server may have created the order before failing
  return { kind: 'interrupted', reason: 'server' }
}
