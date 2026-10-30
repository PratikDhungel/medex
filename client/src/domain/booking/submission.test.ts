import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import {
  canSubmit,
  classifyError,
  loadAttempt,
  outstandingAttempt,
  saveAttempt,
  submissionReducer,
  type BookingRequest,
  type SubmissionState,
} from './submission'

const request: BookingRequest = { providerId: 48, specialistId: 'rana', date: '2026-11-02', start: 1120, numberOfPeople: 1 }
const attempt = { request, idempotencyKey: 'key-1' }
const submitting: SubmissionState = { kind: 'submitting', attempt, resend: false }

const http = (status: number, code: string | null = null, details?: unknown) =>
  new ApiError('http', '/booking/bookings', `HTTP ${status}`, status, { code, details })

describe('classifyError', () => {
  it('reads a 409 as a conflict, with the alternatives', () => {
    const details = { alternatives: [{ date: '2026-11-02', startTime: '19:00' }] }
    expect(classifyError(http(409, 'slot_taken', details))).toEqual({
      kind: 'conflict',
      code: 'slot_taken',
      alternatives: [{ date: '2026-11-02', start: 1140 }],
    })
    expect(classifyError(http(409, 'slot_unavailable'))).toMatchObject({ kind: 'conflict', code: 'slot_unavailable', alternatives: [] })
  })

  it("treats anything that may have reached the server as unknown", () => {
    expect(classifyError(new ApiError('network', '/booking/bookings', 'down'))).toEqual({ kind: 'unknown', reason: 'network' })
    expect(classifyError(http(500))).toEqual({ kind: 'unknown', reason: 'server' })
    expect(classifyError(http(503))).toEqual({ kind: 'unknown', reason: 'server' })
    expect(classifyError(new ApiError('invalid', '/booking/bookings', 'unreadable'))).toEqual({ kind: 'unknown', reason: 'unreadable' })
    expect(classifyError(new DOMException('slow', 'TimeoutError'))).toEqual({ kind: 'unknown', reason: 'timeout' })
    expect(classifyError(new Error('something odd'))).toEqual({ kind: 'unknown', reason: 'network' })
  })

  it('knows when nothing was booked', () => {
    expect(classifyError(new ApiError('offline', '/booking/bookings', 'offline'))).toEqual({ kind: 'failed', reason: 'offline' })
    expect(classifyError(http(400, 'invalid_request'))).toEqual({ kind: 'failed', reason: 'rejected' })
    // The key was reused for a different request: this request was not booked
    expect(classifyError(http(409, 'idempotency_key_reused'))).toEqual({ kind: 'failed', reason: 'rejected' })
  })
})

describe('submissionReducer', () => {
  it('starts an attempt with a new key', () => {
    expect(submissionReducer({ kind: 'idle' }, { type: 'submit', request, newKey: 'key-1' })).toEqual(submitting)
  })

  it('records the booking', () => {
    expect(submissionReducer(submitting, { type: 'succeeded', bookingId: 'BK-1' })).toEqual({ kind: 'booked', attempt, bookingId: 'BK-1' })
  })

  it('keeps the attempt when the result is unknown, and resends it with the same key', () => {
    const unknown = submissionReducer(submitting, { type: 'errored', error: http(500) })
    expect(unknown).toEqual({ kind: 'unknown', attempt, reason: 'server' })
    expect(submissionReducer(unknown, { type: 'resend' })).toEqual({ ...submitting, resend: true })
  })

  it('stays unknown when a resend finds the browser offline, since an earlier try may have arrived', () => {
    const resending: SubmissionState = { kind: 'submitting', attempt, resend: true }
    const offline = new ApiError('offline', '/booking/bookings', 'offline')
    expect(submissionReducer(resending, { type: 'errored', error: offline })).toEqual({ kind: 'unknown', attempt, reason: 'network' })
    // A first try that never left booked nothing
    expect(submissionReducer(submitting, { type: 'errored', error: offline })).toEqual({ kind: 'failed', request, reason: 'offline' })
  })

  it('refuses a new booking while one is in flight or unknown', () => {
    const other = { ...request, start: 1140 }
    expect(submissionReducer(submitting, { type: 'submit', request: other, newKey: 'key-2' })).toBe(submitting)
    const unknown: SubmissionState = { kind: 'unknown', attempt, reason: 'network' }
    expect(submissionReducer(unknown, { type: 'submit', request: other, newKey: 'key-2' })).toBe(unknown)
    expect(canSubmit(unknown)).toBe(false)
  })

  it('turns a 409 into a conflict that keeps the request', () => {
    expect(submissionReducer(submitting, { type: 'errored', error: http(409, 'slot_taken') })).toEqual({
      kind: 'conflict',
      request,
      code: 'slot_taken',
      alternatives: [],
    })
  })

  it('allows a new attempt, with a new key, after a conflict or failure', () => {
    const conflict = submissionReducer(submitting, { type: 'errored', error: http(409, 'slot_taken') })
    const next = submissionReducer(conflict, { type: 'submit', request: { ...request, start: 1140 }, newKey: 'key-2' })
    expect(next).toEqual({ kind: 'submitting', attempt: { request: { ...request, start: 1140 }, idempotencyKey: 'key-2' }, resend: false })
  })

  it('ignores results that arrive when nothing is in flight', () => {
    expect(submissionReducer({ kind: 'idle' }, { type: 'succeeded', bookingId: 'BK-1' })).toEqual({ kind: 'idle' })
  })

  it('restores an attempt from before a reload as unknown', () => {
    expect(submissionReducer({ kind: 'idle' }, { type: 'restore', attempt })).toEqual({ kind: 'unknown', attempt, reason: 'network' })
  })

  it('only dismisses settled problems', () => {
    expect(submissionReducer({ kind: 'failed', request, reason: 'offline' }, { type: 'dismiss' })).toEqual({ kind: 'idle' })
    expect(submissionReducer(submitting, { type: 'dismiss' })).toBe(submitting)
  })
})

describe('keeping the attempt across reloads', () => {
  const memory = () => {
    const items = new Map<string, string>()
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    }
  }

  it('saves only an outstanding attempt, and reads it back', () => {
    const storage = memory()
    saveAttempt(storage, outstandingAttempt(submitting))
    expect(loadAttempt(storage)).toEqual(attempt)
    saveAttempt(storage, outstandingAttempt({ kind: 'booked', attempt, bookingId: 'BK-1' }))
    expect(loadAttempt(storage)).toBeNull()
  })

  it('drops a saved attempt it cannot fully read', () => {
    const storage = memory()
    storage.setItem('medex.booking.pending', JSON.stringify({ idempotencyKey: 'k', request: { ...request, numberOfPeople: 9 } }))
    expect(loadAttempt(storage)).toBeNull()
    storage.setItem('medex.booking.pending', '{not json')
    expect(loadAttempt(storage)).toBeNull()
  })
})
