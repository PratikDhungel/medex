import type { Money } from '@/domain/cart/model'
import type { CheckoutItem } from '@/domain/cart/summary'
import {
  checkoutReducer,
  classifyCheckoutError,
  createSession,
  nextQueued,
  type CheckoutErrorLike,
  type CheckoutEvent,
  type CheckoutSession,
  type NewOrder,
} from '@/domain/checkout/machine'
import type { PaymentMethod, PlacedOrder } from '@/domain/checkout/model'
import { clearSession, loadSession, saveSession, type SessionStorageLike } from '@/domain/checkout/storage'
import type { CheckoutRequest } from '@/api/orders'

export interface CheckoutStoreDeps {
  storage: SessionStorageLike
  placeOrder: (request: CheckoutRequest) => Promise<PlacedOrder>
  getOrder: (orderId: string) => Promise<PlacedOrder>
  newKey: () => string
  now: () => string
  /** The server changed the cart (an order took its lines, or a failed payment returned them) */
  onCartChanged: () => void
  /** Delay between status checks for a card payment being confirmed */
  pollMs?: number
  sleep?: (ms: number) => Promise<void>
}

const isErrorLike = (error: unknown): error is CheckoutErrorLike =>
  typeof error === 'object' && error !== null && 'kind' in error && 'status' in error && 'code' in error

/**
 * Runs checkout outside any component, so leaving the page neither stops it
 * nor, on coming back, starts a second copy. Every change goes through the
 * reducer and is saved before anything is sent.
 *
 * Orders are placed one at a time, in session order, carrying on past
 * failures. Card payments being confirmed are checked until they settle.
 */
export class CheckoutStore {
  private session: CheckoutSession | null
  private readonly listeners = new Set<() => void>()
  private running = false
  private readonly polling = new Set<string>()
  private readonly deps: Required<CheckoutStoreDeps>

  constructor(deps: CheckoutStoreDeps) {
    this.deps = {
      pollMs: 1500,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ...deps,
    }
    this.session = loadSession(deps.storage)
    this.pollConfirming()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): CheckoutSession | null => this.session

  /** Starts a checkout for these groups, replacing any finished one */
  start(orders: NewOrder[]) {
    this.session = createSession(this.deps.newKey(), this.deps.now(), orders)
    this.save()
    void this.run()
  }

  retry(groupType: string) {
    this.dispatch({ type: 'retry', groupType })
    void this.run()
  }

  setMethod(groupType: string, method: PaymentMethod) {
    this.dispatch({ type: 'set_method', groupType, method })
  }

  /** Places an order again with the cart's current items, after the cart changed */
  updateItems(groupType: string, items: CheckoutItem[], totals: Money[]) {
    this.dispatch({ type: 'update_items', groupType, items, totals })
    void this.run()
  }

  /** Forgets the session, e.g. once the customer is done with it */
  clear() {
    this.session = null
    clearSession(this.deps.storage)
    this.publish()
  }

  private dispatch(event: CheckoutEvent) {
    if (!this.session) return
    const next = checkoutReducer(this.session, event)
    if (next === this.session) return
    this.session = next
    this.save()
    this.pollConfirming()
  }

  private save() {
    if (this.session) saveSession(this.deps.storage, this.session)
    this.publish()
  }

  /** Places queued orders one at a time. Only one loop runs, however often it's called. */
  private async run() {
    if (this.running) return
    this.running = true
    try {
      for (let next = this.session && nextQueued(this.session); next; next = this.session && nextQueued(this.session)) {
        const { groupType } = next
        // Saved (with its key) before the request goes out
        this.dispatch({ type: 'submitting', groupType, newKey: this.deps.newKey() })
        const order = this.session?.orders.find((o) => o.groupType === groupType)
        if (!order?.idempotencyKey || order.phase.kind !== 'submitting') continue

        try {
          const placed = await this.deps.placeOrder({
            groupType,
            items: order.items,
            paymentMethod: order.paymentMethod,
            idempotencyKey: order.idempotencyKey,
          })
          this.dispatch({ type: 'placed', groupType, order: placed })
        } catch (error) {
          const failure = isErrorLike(error)
            ? classifyCheckoutError(error)
            : ({ kind: 'interrupted', reason: 'network' } as const)
          this.dispatch({ type: 'failed', groupType, failure })
        }
        this.deps.onCartChanged()
      }
    } finally {
      this.running = false
    }
  }

  /** Starts checking each card payment being confirmed, once per order */
  private pollConfirming() {
    for (const order of this.session?.orders ?? []) {
      if (order.phase.kind === 'confirming' && !this.polling.has(order.phase.orderId)) {
        void this.poll(order.groupType, order.phase.orderId)
      }
    }
  }

  private async poll(groupType: string, orderId: string) {
    this.polling.add(orderId)
    try {
      while (this.isConfirming(orderId)) {
        await this.deps.sleep(this.deps.pollMs)
        if (!this.isConfirming(orderId)) break
        try {
          const { status } = await this.deps.getOrder(orderId)
          if (status !== 'pending') {
            this.dispatch({ type: 'status', groupType, status })
            if (status === 'failed') this.deps.onCartChanged()
          }
        } catch {
          // A failed check changes nothing: the payment is still being confirmed, so try again
        }
      }
    } finally {
      this.polling.delete(orderId)
    }
  }

  private isConfirming(orderId: string): boolean {
    return !!this.session?.orders.some((o) => o.phase.kind === 'confirming' && o.phase.orderId === orderId)
  }

  private publish() {
    for (const listener of this.listeners) listener()
  }
}
