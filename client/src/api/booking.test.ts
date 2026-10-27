import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { availabilityQuery, createBooking, daySlotsQuery, rescheduleBooking } from './booking'
import { ApiError } from './client'

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init))

const requested = (fetch: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('booking queries', () => {
  it('asks for availability with the group size and the booking being rescheduled', async () => {
    const fetch = respond({ today: '2026-10-27', days: [] })
    vi.stubGlobal('fetch', fetch)
    await new QueryClient().fetchQuery(
      availabilityQuery({ providerId: 48, specialistId: 'doc', numberOfPeople: 2, rescheduling: 'BK-1' }),
    )
    expect(requested(fetch).url).toBe('/api/booking/providers/48/availability?specialistId=doc&numberOfPeople=2&rescheduling=BK-1')
  })

  it('leaves out a booking that is not being rescheduled', async () => {
    const fetch = respond({ date: '2026-11-02', slots: [] })
    vi.stubGlobal('fetch', fetch)
    await new QueryClient().fetchQuery(daySlotsQuery({ providerId: 48, specialistId: 'doc', date: '2026-11-02' }))
    expect(requested(fetch).url).toBe('/api/booking/providers/48/slots?date=2026-11-02&specialistId=doc')
  })

  it('reports a body it cannot use as an unexpected response', async () => {
    vi.stubGlobal('fetch', respond({ slots: 'none' }))
    const error = await new QueryClient()
      .fetchQuery(daySlotsQuery({ providerId: 48, specialistId: 'doc', date: '2026-11-02' }))
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ kind: 'invalid', retryable: false })
  })
})

describe('createBooking', () => {
  const booking = { providerId: 48, specialistId: 'doc', date: '2026-11-02', start: 640, numberOfPeople: 2, idempotencyKey: 'key-12345678' }

  it('sends the start time as HH:MM along with the idempotency key', async () => {
    const fetch = respond({ bookingId: 'BK-20261027-0001' }, { status: 201 })
    vi.stubGlobal('fetch', fetch)
    await expect(createBooking(booking)).resolves.toEqual({ bookingId: 'BK-20261027-0001' })
    expect(requested(fetch)).toEqual({
      url: '/api/booking/bookings',
      method: 'POST',
      body: { providerId: 48, specialistId: 'doc', date: '2026-11-02', startTime: '10:40', numberOfPeople: 2, idempotencyKey: 'key-12345678' },
    })
  })

  it('passes on a conflict with its code and alternatives', async () => {
    const details = { alternatives: [{ date: '2026-11-02', startTime: '11:20' }] }
    vi.stubGlobal('fetch', respond({ code: 'slot_taken', message: 'Taken', details }, { status: 409 }))
    const error = await createBooking(booking).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'slot_taken', details, retryable: false })
  })
})

describe('rescheduleBooking', () => {
  it('sends the new date and time and reads the moved booking', async () => {
    const fetch = respond({ bookingId: 'BK-1', providerId: 48, specialistId: 'doc', date: '2026-11-11', startTime: '14:00', numberOfPeople: 1 })
    vi.stubGlobal('fetch', fetch)
    await expect(rescheduleBooking('BK-1', '2026-11-11', 840)).resolves.toMatchObject({ date: '2026-11-11', start: 840 })
    expect(requested(fetch)).toMatchObject({ url: '/api/booking/bookings/BK-1', method: 'PUT', body: { date: '2026-11-11', startTime: '14:00' } })
  })
})
