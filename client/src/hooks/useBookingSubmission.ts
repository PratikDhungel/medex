import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer } from 'react'
import { bookingKeys, createBooking } from '@/api/booking'
import {
  loadAttempt,
  outstandingAttempt,
  saveAttempt,
  submissionReducer,
  type BookingRequest,
  type SubmissionState,
} from '@/domain/booking/submission'
import { browserStorage } from '@/lib/browserStorage'

/** A request this slow gets an unknown result, never an endless spinner */
const TIMEOUT_MS = 20_000

/**
 * Books a slot at one provider (see domain/booking/submission). An attempt
 * that may have reached the server is saved, so after a reload, or when the
 * connection comes back, it is sent again with the same key rather than
 * forgotten.
 */
export function useBookingSubmission(providerId: number) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(submissionReducer, providerId, (id): SubmissionState => {
    const saved = loadAttempt(browserStorage())
    return saved && saved.request.providerId === id ? { kind: 'unknown', attempt: saved, reason: 'network' } : { kind: 'idle' }
  })

  useEffect(() => {
    const storage = browserStorage()
    const attempt = outstandingAttempt(state)
    if (attempt) saveAttempt(storage, attempt)
    // Settled: forget this provider's attempt, but leave another provider's alone
    else if (loadAttempt(storage)?.request.providerId === providerId) saveAttempt(storage, null)
  }, [state, providerId])

  // Each new submitting state is one request. The result is never cancelled:
  // leaving the page mid-request keeps the attempt in storage instead.
  useEffect(() => {
    if (state.kind !== 'submitting') return
    const { request, idempotencyKey } = state.attempt
    createBooking({ ...request, idempotencyKey }, AbortSignal.timeout(TIMEOUT_MS))
      .then(({ bookingId }) => dispatch({ type: 'succeeded', bookingId }))
      .catch((error: unknown) => dispatch({ type: 'errored', error }))
      // Whatever happened, the calendar and times may have changed
      .finally(() => void queryClient.invalidateQueries({ queryKey: bookingKeys.occupancy(request.providerId) }))
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
