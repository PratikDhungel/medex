import { checkoutReducer, type CheckoutSession } from './machine'

// The checkout session is kept in localStorage, so a reload or a closed tab
// comes back to the true state of each order instead of starting again.

export const STORAGE_KEY = 'medex.checkout'

/** Just what we use of Storage, so tests can pass a plain object */
export type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Enough of a session to resume safely. A session we can't trust is dropped, not repaired. */
function isSession(value: unknown): value is CheckoutSession {
  return (
    isObject(value) &&
    value.version === 1 &&
    typeof value.id === 'string' &&
    Array.isArray(value.orders) &&
    value.orders.every(
      (order) =>
        isObject(order) &&
        typeof order.groupType === 'string' &&
        Array.isArray(order.items) &&
        (order.idempotencyKey === null || typeof order.idempotencyKey === 'string') &&
        isObject(order.phase) &&
        typeof order.phase.kind === 'string',
    )
  )
}

/**
 * Saves the session. Returns false when storage is unavailable (private
 * mode, quota): checkout still works, it just can't survive a reload.
 */
export function saveSession(storage: SessionStorageLike, session: CheckoutSession): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

/**
 * The saved session, if any. Requests that were out when the page went away
 * come back as interrupted: their outcome is unknown until retried with the
 * same key.
 */
export function loadSession(storage: SessionStorageLike): CheckoutSession | null {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) ? checkoutReducer(parsed, { type: 'reloaded' }) : null
  } catch {
    return null
  }
}

export function clearSession(storage: SessionStorageLike) {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: there is no session we could read either
  }
}
