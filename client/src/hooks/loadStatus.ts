import type { FetchStatus, QueryStatus } from '@tanstack/react-query'

export type LoadStatus =
  /** First load; the page decides when that counts as slow */
  | { kind: 'loading' }
  /** Waiting for a connection with nothing to show yet */
  | { kind: 'offline' }
  /** Nothing to show */
  | { kind: 'error'; error: Error }
  /** Data to show. `refreshFailed`: a later reload failed, so it may be out of date. */
  | { kind: 'ready'; refreshFailed: boolean }

interface QueryState {
  status: QueryStatus
  fetchStatus: FetchStatus
  hasData: boolean
  error: Error | null
}

/**
 * What a screen shows for one query; the same rules as the cart's. Data
 * already on screen is never swapped for an error.
 */
export function deriveLoadStatus({ status, fetchStatus, hasData, error }: QueryState): LoadStatus {
  if (hasData) return { kind: 'ready', refreshFailed: status === 'error' }
  if (status === 'error') return { kind: 'error', error: error ?? new Error('Loading failed') }
  return fetchStatus === 'paused' ? { kind: 'offline' } : { kind: 'loading' }
}

/** Shorthand for a useQuery result */
export const loadStatusOf = (query: { status: QueryStatus; fetchStatus: FetchStatus; data: unknown; error: Error | null }) =>
  deriveLoadStatus({ status: query.status, fetchStatus: query.fetchStatus, hasData: query.data !== undefined, error: query.error })
