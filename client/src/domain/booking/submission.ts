import { parseCalendarDate, type CalendarDate } from '@shared/time/calendarDate'
import { MAX_PEOPLE } from '@shared/booking/availability'
import type { WallTime } from '@shared/time/wallTime'
import { ApiError } from '@/api/client'
import type { SessionStorageLike } from '@/domain/checkout/storage'
import { readAlternatives } from './normalise'
import type { SlotChoice } from './model'

/**
 * Booking a slot, from Confirm to a known result. The rule that matters: once
 * a request may have reached the server, its result is unknown until the
 * same request (same idempotency key) is answered. Until then nothing else
 * may be booked from this page, or the customer could end up with two.
 */

export interface BookingRequest {
  providerId: number
  specialistId: string
  date: CalendarDate
  start: WallTime
  numberOfPeople: number
}

export interface Attempt {
  request: BookingRequest
  /** Sent with every try of this request; the server returns the same booking for it */
  idempotencyKey: string
}

export type ConflictCode = 'slot_taken' | 'slot_unavailable'

/** Why a request definitely didn't book */
export type FailureReason = 'offline' | 'rejected'

/** Why the result isn't known */
export type UnknownReason = 'network' | 'server' | 'timeout' | 'unreadable'

export type SubmissionState =
  | { kind: 'idle' }
  /** `resend`: an earlier try of this attempt may already have reached the server */
  | { kind: 'submitting'; attempt: Attempt; resend: boolean }
  /** It may have booked. Only resending the same attempt can tell. */
  | { kind: 'unknown'; attempt: Attempt; reason: UnknownReason }
  | { kind: 'booked'; attempt: Attempt; bookingId: string }
  /** Someone else got there first, or the time can't be booked any more. Nothing was booked. */
  | { kind: 'conflict'; request: BookingRequest; code: ConflictCode; alternatives: SlotChoice[] }
  /** Nothing was booked */
  | { kind: 'failed'; request: BookingRequest; reason: FailureReason }

export type SubmissionEvent =
  /** Confirm. `newKey` is used for a new attempt; ignored while one is outstanding. */
  | { type: 'submit'; request: BookingRequest; newKey: string }
  /** Try the outstanding attempt again, with its own key */
  | { type: 'resend' }
  | { type: 'succeeded'; bookingId: string }
  | { type: 'errored'; error: unknown }
  /** Put a conflict or failure away, e.g. once another time is chosen */
  | { type: 'dismiss' }
  /** An attempt found in storage after a reload */
  | { type: 'restore'; attempt: Attempt }

const CONFLICT_CODES: readonly string[] = ['slot_taken', 'slot_unavailable'] satisfies ConflictCode[]

/** What an error means for the booking: definitely not made, a conflict, or unknown */
export function classifyError(
  error: unknown,
): { kind: 'conflict'; code: ConflictCode; alternatives: SlotChoice[] } | { kind: 'failed'; reason: FailureReason } | { kind: 'unknown'; reason: UnknownReason } {
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { kind: 'unknown', reason: 'timeout' }
  }
  if (!(error instanceof ApiError)) return { kind: 'unknown', reason: 'network' }

  switch (error.kind) {
    case 'offline':
      // Checked before sending, so the request never left
      return { kind: 'failed', reason: 'offline' }
    case 'network':
      return { kind: 'unknown', reason: 'network' }
    case 'invalid':
      // A success we couldn't read may still be a booking
      return { kind: 'unknown', reason: 'unreadable' }
    case 'http':
      if (error.status === 409 && error.code !== null && CONFLICT_CODES.includes(error.code)) {
        return { kind: 'conflict', code: error.code as ConflictCode, alternatives: readAlternatives(error.details) }
      }
      // A server error may come after the booking was made
      if (error.status === null || error.status >= 500) return { kind: 'unknown', reason: 'server' }
      return { kind: 'failed', reason: 'rejected' }
  }
}

/** Whether a new booking may be started: not while one is in flight or unresolved */
export const canSubmit = (state: SubmissionState) => state.kind !== 'submitting' && state.kind !== 'unknown'

export function submissionReducer(state: SubmissionState, event: SubmissionEvent): SubmissionState {
  switch (event.type) {
    case 'submit':
      if (!canSubmit(state)) return state
      return { kind: 'submitting', attempt: { request: event.request, idempotencyKey: event.newKey }, resend: false }

    case 'resend':
      return state.kind === 'unknown' ? { kind: 'submitting', attempt: state.attempt, resend: true } : state

    case 'restore':
      return canSubmit(state) ? { kind: 'unknown', attempt: event.attempt, reason: 'network' } : state

    case 'succeeded':
      return state.kind === 'submitting' ? { kind: 'booked', attempt: state.attempt, bookingId: event.bookingId } : state

    case 'errored': {
      if (state.kind !== 'submitting') return state
      const result = classifyError(event.error)
      const { request } = state.attempt
      if (result.kind === 'unknown') return { kind: 'unknown', attempt: state.attempt, reason: result.reason }
      if (result.kind === 'conflict') return { kind: 'conflict', request, code: result.code, alternatives: result.alternatives }
      // This try never left, but an earlier one may have arrived: still unknown
      if (result.reason === 'offline' && state.resend) return { kind: 'unknown', attempt: state.attempt, reason: 'network' }
      return { kind: 'failed', request, reason: result.reason }
    }

    case 'dismiss':
      return state.kind === 'conflict' || state.kind === 'failed' ? { kind: 'idle' } : state
  }
}

/** The attempt to keep across reloads, or null when there's nothing outstanding */
export const outstandingAttempt = (state: SubmissionState): Attempt | null =>
  state.kind === 'submitting' || state.kind === 'unknown' ? state.attempt : null

const STORAGE_KEY = 'medex.booking.pending'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** An outstanding attempt saved before a reload. One we can't fully read is dropped. */
export function loadAttempt(storage: SessionStorageLike): Attempt | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    if (!isObject(raw) || typeof raw.idempotencyKey !== 'string' || !isObject(raw.request)) return null
    const { providerId, specialistId, date, start, numberOfPeople } = raw.request
    const valid =
      Number.isInteger(providerId) &&
      typeof specialistId === 'string' &&
      parseCalendarDate(date) !== null &&
      Number.isInteger(start) &&
      Number.isInteger(numberOfPeople) &&
      (numberOfPeople as number) >= 1 &&
      (numberOfPeople as number) <= MAX_PEOPLE
    return valid ? (raw as unknown as Attempt) : null
  } catch {
    return null
  }
}

export function saveAttempt(storage: SessionStorageLike, attempt: Attempt | null) {
  try {
    if (attempt) storage.setItem(STORAGE_KEY, JSON.stringify(attempt))
    else storage.removeItem(STORAGE_KEY)
  } catch {
    // Storage full or blocked: the attempt then lasts only for this page load
  }
}
