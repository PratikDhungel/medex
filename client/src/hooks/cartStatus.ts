import type { FetchStatus, QueryStatus } from '@tanstack/react-query'

export type CartStatus =
  /** First load; the page decides when that counts as slow */
  | { kind: 'loading' }
  /** Waiting for a connection with no cart to show yet */
  | { kind: 'offline' }
  /** Nothing to show */
  | { kind: 'error'; error: Error }
  /** A cart to show. `refreshFailed`: a later reload failed, so it may be out of date. */
  | { kind: 'ready'; refreshFailed: boolean }

interface CartQueryState {
  status: QueryStatus
  fetchStatus: FetchStatus
  hasData: boolean
  error: Error | null
}

/**
 * What the cart page shows. A cart already on screen is never swapped for an
 * error: a failed reload only adds a notice that it may be out of date.
 */
export function deriveCartStatus({ status, fetchStatus, hasData, error }: CartQueryState): CartStatus {
  if (hasData) return { kind: 'ready', refreshFailed: status === 'error' }
  if (status === 'error') return { kind: 'error', error: error ?? new Error('The cart could not be loaded') }
  return fetchStatus === 'paused' ? { kind: 'offline' } : { kind: 'loading' }
}
