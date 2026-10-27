import { queryOptions } from '@tanstack/react-query'
import type { CalendarDate } from '@shared/time/calendarDate'
import { formatWallTime, type WallTime } from '@shared/time/wallTime'
import type { Availability, Booking, BookingProvider, DaySlots } from '@/domain/booking/model'
import {
  normaliseAvailability,
  normaliseBooking,
  normaliseDaySlots,
  normaliseProvider,
} from '@/domain/booking/normalise'
import { ApiError, requestJson } from './client'

// The booking API (server/README.md, "Booking endpoints"). Unlike the cart,
// nothing here is edited optimistically, so the cache holds the normalised
// model and components never see raw records.

const BASE = '/booking'

/** Throws an "unexpected response" error when the normaliser couldn't use the body */
function required<T>(value: T | null, path: string, what: string): T {
  if (value === null) throw new ApiError('invalid', path, `The server sent an unexpected ${what}`)
  return value
}

const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return `${path}?${query}`
}

export const bookingKeys = {
  all: ['booking'] as const,
  providers: () => [...bookingKeys.all, 'providers'] as const,
  provider: (providerId: number) => [...bookingKeys.all, 'provider', providerId] as const,
  /** Everything that depends on which slots are taken, refetched after any booking change */
  occupancy: (providerId: number) => [...bookingKeys.all, 'occupancy', providerId] as const,
  booking: (bookingId: string) => [...bookingKeys.all, 'booking', bookingId] as const,
}

export const bookingProvidersQuery = queryOptions({
  queryKey: bookingKeys.providers(),
  queryFn: async ({ signal }): Promise<BookingProvider[]> => {
    const path = `${BASE}/providers`
    const body = await requestJson(path, { signal })
    if (!Array.isArray(body)) throw new ApiError('invalid', path, 'The server sent an unexpected provider list')
    const now = Date.now()
    // A provider record the app can't read is left out of the list rather than failing it
    return body.map((raw) => normaliseProvider(raw, now)).filter((provider) => provider !== null)
  },
})

export const bookingProviderQuery = (providerId: number) =>
  queryOptions({
    queryKey: bookingKeys.provider(providerId),
    queryFn: async ({ signal }): Promise<BookingProvider> => {
      const path = `${BASE}/providers/${providerId}`
      return required(normaliseProvider(await requestJson(path, { signal }), Date.now()), path, 'provider')
    },
  })

export interface AvailabilityParams {
  providerId: number
  specialistId: string
  numberOfPeople: number
  /** While rescheduling, that booking's own slots count as free */
  rescheduling?: string
  /**
   * Today at the provider, by the browser's clock. Only part of the cache
   * key: when midnight passes there, the calendar is fetched again.
   */
  asOf?: CalendarDate
}

export const availabilityQuery = ({ providerId, specialistId, numberOfPeople, rescheduling, asOf }: AvailabilityParams) =>
  queryOptions({
    queryKey: [
      ...bookingKeys.occupancy(providerId),
      'availability',
      specialistId,
      numberOfPeople,
      rescheduling ?? null,
      asOf ?? null,
    ] as const,
    queryFn: async ({ signal }): Promise<Availability> => {
      const path = withQuery(`${BASE}/providers/${providerId}/availability`, { specialistId, numberOfPeople, rescheduling })
      return required(normaliseAvailability(await requestJson(path, { signal })), path, 'calendar')
    },
  })

export interface SlotsParams {
  providerId: number
  specialistId: string
  date: CalendarDate
  rescheduling?: string
}

export const daySlotsQuery = ({ providerId, specialistId, date, rescheduling }: SlotsParams) =>
  queryOptions({
    queryKey: [...bookingKeys.occupancy(providerId), 'slots', specialistId, date, rescheduling ?? null] as const,
    queryFn: async ({ signal }): Promise<DaySlots> => {
      const path = withQuery(`${BASE}/providers/${providerId}/slots`, { date, specialistId, rescheduling })
      return required(normaliseDaySlots(await requestJson(path, { signal })), path, 'list of times')
    },
  })

export const bookingQuery = (bookingId: string) =>
  queryOptions({
    queryKey: bookingKeys.booking(bookingId),
    queryFn: async ({ signal }): Promise<Booking> => {
      const path = `${BASE}/bookings/${encodeURIComponent(bookingId)}`
      return required(normaliseBooking(await requestJson(path, { signal })), path, 'booking')
    },
  })

export interface NewBooking {
  providerId: number
  specialistId: string
  date: CalendarDate
  start: WallTime
  numberOfPeople: number
  /** Same key, same request → the same booking, never a second one */
  idempotencyKey: string
}

/**
 * Books a slot. Errors to expect:
 *   409 `slot_taken` / `slot_unavailable`, with `details.alternatives`
 *   500 / network: the booking may or may not exist; resend with the same key to find out
 */
export async function createBooking({ start, ...request }: NewBooking): Promise<{ bookingId: string }> {
  const path = `${BASE}/bookings`
  const body = await requestJson(path, { method: 'POST', body: { ...request, startTime: formatWallTime(start) } })
  const bookingId = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).bookingId : undefined
  if (typeof bookingId !== 'string' || bookingId === '') throw new ApiError('invalid', path, 'The server sent no booking id')
  return { bookingId }
}

/**
 * Moves a booking. Safe to resend: moving a booking to where it already is
 * succeeds. Errors as for createBooking.
 */
export async function rescheduleBooking(bookingId: string, date: CalendarDate, start: WallTime): Promise<Booking> {
  const path = `${BASE}/bookings/${encodeURIComponent(bookingId)}`
  const body = await requestJson(path, { method: 'PUT', body: { date, startTime: formatWallTime(start) } })
  return required(normaliseBooking(body), path, 'booking')
}
