import { ApiError } from '@/api/client'
import { quantityIn } from '@/domain/cart/overlay'
import type { RawCart } from '@/domain/cart/raw'

export interface QuantityFailure {
  lineId: string
  /** The quantity the server refused, or couldn't confirm */
  attempted: number
  /** What the line went back to; null when the outcome is unknown and the cart is being reloaded */
  restored: number | null
  error: unknown
}

export interface QuantitySnapshot {
  /** Quantities to show instead of the cached cart's */
  quantities: ReadonlyMap<string, number>
  /** Lines with a change still being saved */
  pending: ReadonlySet<string>
  /** The last failure per line, until the customer changes that line again or dismisses it */
  failures: ReadonlyMap<string, QuantityFailure>
}

export interface QuantitySyncDeps {
  /** Sends one quantity for one line and resolves with the server's cart */
  send: (lineId: string, quantity: number) => Promise<RawCart>
  /**
   * Every line has settled. The owner should reload the cart and, once the
   * reload has landed, call `clearSettled(mark)` so the server's values show.
   */
  onIdle: (mark: number) => void
}

interface LineState {
  /** Last quantity the server accepted */
  confirmed: number
  /** What the customer asked for last */
  desired: number
  /** Quantity on its way to the server, or null */
  inFlight: number | null
  /** When it settled, for clearSettled; null while still changing */
  settledAt: number | null
}

/**
 * Optimistic quantity changes for cart lines.
 *
 * The customer sees `desired` at once. Each line has at most one request in
 * flight; taps made meanwhile only move the target, and the newest target is
 * sent when the request returns. So five quick taps send at most two
 * requests, in order, and nothing on screen jumps back.
 *
 * A refusal (409, 500, …) rolls the line back to the last quantity the server
 * accepted. A lost connection means the change may or may not have been
 * saved, so the line drops its local value and the cart is reloaded instead.
 */
export class QuantitySync {
  private readonly lines = new Map<string, LineState>()
  private failures = new Map<string, QuantityFailure>()
  private readonly listeners = new Set<() => void>()
  private snapshot: QuantitySnapshot = { quantities: new Map(), pending: new Set(), failures: new Map() }
  private generation = 0
  private readonly deps: QuantitySyncDeps

  constructor(deps: QuantitySyncDeps) {
    this.deps = deps
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Stable between changes, as useSyncExternalStore requires */
  getSnapshot = (): QuantitySnapshot => this.snapshot

  /**
   * The customer asked for `quantity`. `shown` is the quantity on screen now,
   * which becomes the fallback the first time this line changes.
   */
  set(lineId: string, quantity: number, shown: number) {
    let line = this.lines.get(lineId)
    if (line) {
      line.desired = quantity
      line.settledAt = null
    } else {
      line = { confirmed: shown, desired: quantity, inFlight: null, settledAt: null }
      this.lines.set(lineId, line)
    }
    this.failures.delete(lineId)
    this.publish()
    if (line.inFlight === null) void this.flush(lineId, line)
  }

  /** Stops tracking a line that was removed from the cart */
  forget(lineId: string) {
    const known = this.lines.delete(lineId)
    if (this.failures.delete(lineId) || known) this.publish()
  }

  dismissFailure(lineId: string) {
    if (this.failures.delete(lineId)) this.publish()
  }

  /** Drops local values for lines that settled at or before `mark`, so the reloaded cart shows */
  clearSettled(mark: number) {
    let changed = false
    for (const [lineId, line] of this.lines) {
      if (line.inFlight === null && line.settledAt !== null && line.settledAt <= mark) {
        this.lines.delete(lineId)
        changed = true
      }
    }
    if (changed) this.publish()
  }

  private async flush(lineId: string, line: LineState) {
    while (line.desired !== line.confirmed) {
      const quantity = line.desired
      line.inFlight = quantity
      this.publish()

      let cart: RawCart
      try {
        cart = await this.deps.send(lineId, quantity)
      } catch (error) {
        if (this.lines.get(lineId) === line) this.fail(lineId, line, quantity, error)
        else this.checkIdle()
        return
      }
      // Forgotten meanwhile (the line was removed): stop here
      if (this.lines.get(lineId) !== line) {
        this.checkIdle()
        return
      }

      const saved = quantityIn(cart, lineId)
      if (saved === null) {
        // Removed meanwhile (e.g. in another tab): nothing left to sync
        this.lines.delete(lineId)
        line.inFlight = null
        this.publish()
        this.checkIdle()
        return
      }
      line.confirmed = saved
      // The server may store something else (e.g. a clamp); accept it unless the customer has moved on
      if (line.desired === quantity) line.desired = saved
    }

    line.inFlight = null
    line.settledAt = this.generation
    this.publish()
    this.checkIdle()
  }

  private fail(lineId: string, line: LineState, attempted: number, error: unknown) {
    line.inFlight = null
    const outcomeUnknown = error instanceof ApiError && error.kind === 'network'

    if (outcomeUnknown) {
      this.lines.delete(lineId)
    } else {
      line.desired = line.confirmed
      line.settledAt = this.generation
    }
    this.failures.set(lineId, { lineId, attempted, restored: outcomeUnknown ? null : line.confirmed, error })
    this.publish()
    this.checkIdle()
  }

  private checkIdle() {
    for (const line of this.lines.values()) {
      if (line.inFlight !== null) return
    }
    // Lines that settle from now on get a later generation and survive this mark
    const mark = this.generation
    this.generation += 1
    this.deps.onIdle(mark)
  }

  private publish() {
    const quantities = new Map<string, number>()
    const pending = new Set<string>()
    for (const [lineId, line] of this.lines) {
      quantities.set(lineId, line.desired)
      if (line.inFlight !== null || line.desired !== line.confirmed) pending.add(lineId)
    }
    this.snapshot = { quantities, pending, failures: new Map(this.failures) }
    for (const listener of this.listeners) listener()
  }
}
