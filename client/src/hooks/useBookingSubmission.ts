import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer } from 'react'
import { bookingKeys, createBooking } from '@/api/booking'
import {
  loadAttempt,
  outstandingAttempt,
  PENDING_BOOKING_KEY,
  saveAttempt,
  submissionReducer,
  type Attempt,
  type BookingRequest,
  type SubmissionState,
} from '@/domain/booking/submission'
import { browserStorage } from '@/lib/browserStorage'

/** A request this slow gets an unknown result, never an endless spinner */
const TIMEOUT_MS = 20_000

export interface SubmissionOptions {
  /** Sends one try of the attempt and resolves with the booking id; defaults to booking a new slot */
  send?: (attempt: Attempt, signal: AbortSignal) => Promise<string>
  /** Where an outstanding attempt is kept across reloads */
  storageKey?: string
}

const bookNew: NonNullable<SubmissionOptions['send']> = async ({ request, idempotencyKey }, signal) =>
  (await createBooking({ ...request, idempotencyKey }, signal)).bookingId

/**
 * Books a slot at one provider (see domain/booking/submission), or with
 * `send`, makes another booking change the same way. An attempt that may have
 * reached the server is saved, so after a reload, or when the connection
 * comes back, it is sent again with the same key rather than forgotten.
 */
export function useBookingSubmission(providerId: number, { send = bookNew, storageKey = PENDING_BOOKING_KEY }: SubmissionOptions = {}) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(submissionReducer, providerId, (id): SubmissionState => {
    const saved = loadAttempt(browserStorage(), storageKey)
    return saved && saved.request.providerId === id ? { kind: 'unknown', attempt: saved, reason: 'network' } : { kind: 'idle' }
  })

  useEffect(() => {
    const storage = browserStorage()
    const attempt = outstandingAttempt(state)
    if (attempt) saveAttempt(storage, attempt, storageKey)
    // Settled: forget this provider's attempt, but leave another provider's alone
    else if (loadAttempt(storage, storageKey)?.request.providerId === providerId) saveAttempt(storage, null, storageKey)
  }, [state, providerId, storageKey])

  // Each new submitting state is one request. The result is never cancelled:
  // leaving the page mid-request keeps the attempt in storage instead.
  useEffect(() => {
    if (state.kind !== 'submitting') return
    const { attempt } = state
    send(attempt, AbortSignal.timeout(TIMEOUT_MS))
      .then((bookingId) => dispatch({ type: 'succeeded', bookingId }))
      .catch((error: unknown) => dispatch({ type: 'errored', error }))
      // Whatever happened, the calendar, the times and the booking itself may have changed
      .finally(() => void queryClient.invalidateQueries({ queryKey: bookingKeys.all }))
    // `send` is a fixed function per page; only a new try should send
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, queryClient])

  // An unknown result is checked again on load and whenever the connection returns
  useEffect(() => {
    const resend = () => dispatch({ type: 'resend' })
    if (navigator.onLine) resend()
    window.addEventListener('online', resend)
    return () => window.removeEventListener('online', resend)
  }, [])

  const submit = useCallback(
    (request: BookingRequest) => dispatch({ type: 'submit', request, newKey: crypto.randomUUID() }),
    [],
  )
  const resend = useCallback(() => dispatch({ type: 'resend' }), [])
  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), [])

  return { state, submit, resend, dismiss }
}
