import { Router, type Request } from 'express'
import { BOOKING_WINDOW_DAYS, MAX_PEOPLE, type DayStatus } from '../../../shared/booking/availability.js'
import { daysBetween, parseCalendarDate, type CalendarDate } from '../../../shared/time/calendarDate.js'
import { formatWallTime, parseWallTime, type WallTime } from '../../../shared/time/wallTime.js'
import { ApiError } from '../cart/errors.js'
import { mockNetwork } from '../mock.js'
import { send, type MockRules } from '../mockRules.js'
import { bookingJson, type BookingService } from './bookings.js'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const badRequest = (message: string) => new ApiError(400, 'invalid_request', message)

function query(req: Request, key: string): string | undefined {
  const value = req.query[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function providerId(req: Request): number {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ApiError(404, 'provider_not_found', 'We could not find this provider.')
  return id
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') throw badRequest(`"${name}" is required`)
  return value
}

function date(value: unknown): CalendarDate {
  const parsed = parseCalendarDate(value)
  if (!parsed) throw badRequest('"date" must be a real date in YYYY-MM-DD form')
  return parsed
}

function startTime(value: unknown): WallTime {
  const parsed = parseWallTime(value)
  if (parsed === null) throw badRequest('"startTime" must be a time in HH:MM form')
  return parsed
}

function people(value: unknown): number {
  const number = typeof value === 'string' ? Number(value) : value
  if (!Number.isInteger(number) || (number as number) < 1 || (number as number) > MAX_PEOPLE) {
    throw badRequest(`"numberOfPeople" must be a whole number from 1 to ${MAX_PEOPLE}`)
  }
  return number as number
}

/** A day's status in the API's shape: the reason and any detail the customer needs */
function dayJson(date: CalendarDate, status: DayStatus) {
  switch (status.kind) {
    case 'available':
      return { date, status: status.kind, availableStartTimes: status.startTimes.length }
    case 'closure':
      return { date, status: status.kind, reason: status.reason }
    case 'specialist-unavailable':
      return {
        date,
        status: status.kind,
        opensAt: status.limit?.opensAt == null ? null : formatWallTime(status.limit.opensAt),
        closesAt: status.limit?.closesAt == null ? null : formatWallTime(status.limit.closesAt),
      }
    default:
      return { date, status: status.kind }
  }
}

/**
 * The booking API, under /api/booking because /api/providers already serves
 * Task 1's providers. Paths below that follow the brief.
 */
export function createBookingRouter(bookings: BookingService, rules: MockRules): Router {
  const router = Router()

  /** Rejects dates outside today..today+89 at the provider */
  const inWindow = (id: number, value: CalendarDate) => {
    const offset = daysBetween(bookings.today(id), value)
    if (offset < 0 || offset >= BOOKING_WINDOW_DAYS) {
      throw new ApiError(400, 'date_out_of_range', `Bookings are open from today for ${BOOKING_WINDOW_DAYS} days.`)
    }
    return value
  }

  /** `?rescheduling=<bookingId>`: that booking's own slots count as free */
  const rescheduling = (req: Request) => {
    const id = query(req, 'rescheduling')
    if (id) bookings.booking(id)
    return id
  }

  router.get('/providers', mockNetwork('booking'), rules.middleware('bookingProviders'), (req, res) => {
    send(req, res, 200, bookings.providers.map((provider) => provider.raw))
  })

  router.get('/providers/:id', mockNetwork('booking'), rules.middleware('bookingProvider'), (req, res) => {
    send(req, res, 200, bookings.provider(providerId(req)).raw)
  })

  router.get('/providers/:id/availability', mockNetwork('booking'), rules.middleware('availability'), (req, res) => {
    const id = providerId(req)
    const specialistId = requiredString(query(req, 'specialistId'), 'specialistId')
    const numberOfPeople = people(query(req, 'numberOfPeople') ?? '1')
    const { today, days } = bookings.availability(id, specialistId, numberOfPeople, rescheduling(req))
    send(req, res, 200, {
      providerId: id,
      specialistId,
      numberOfPeople,
      today,
      days: days.map((day) => dayJson(day.date, day.status)),
    })
  })

  router.get('/providers/:id/slots', mockNetwork('booking'), rules.middleware('slots'), (req, res) => {
    const id = providerId(req)
    const specialistId = requiredString(query(req, 'specialistId'), 'specialistId')
    const day = inWindow(id, date(query(req, 'date')))
    const slots = bookings.slots(id, specialistId, day, rescheduling(req))
    send(req, res, 200, {
      date: day,
      specialistId,
      slots: slots.map((slot) => ({ startTime: formatWallTime(slot.start), endTime: formatWallTime(slot.end), isBooked: slot.booked })),
    })
  })

  router.post('/bookings', mockNetwork('booking'), rules.middleware('createBooking'), (req, res) => {
    if (!isObject(req.body)) throw badRequest('Expected a JSON object')
    const { idempotencyKey } = req.body
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8)) {
      throw badRequest('"idempotencyKey" must be a string of at least 8 characters')
    }
    const id = Number(req.body.providerId)
    if (!Number.isInteger(id)) throw badRequest('"providerId" must be a number')
    const request = {
      providerId: id,
      specialistId: requiredString(req.body.specialistId, 'specialistId'),
      date: inWindow(id, date(req.body.date)),
      start: startTime(req.body.startTime),
      numberOfPeople: people(req.body.numberOfPeople ?? 1),
      idempotencyKey,
    }
    if (res.locals.raced) bookings.takeSlot(request)
    send(req, res, 201, bookings.create(request))
  })

  router.get('/bookings/:bookingId', mockNetwork('booking'), rules.middleware('getBooking'), (req, res) => {
    send(req, res, 200, bookingJson(bookings.booking(String(req.params.bookingId))))
  })

  router.put('/bookings/:bookingId', mockNetwork('booking'), rules.middleware('updateBooking'), (req, res) => {
    if (!isObject(req.body)) throw badRequest('Expected a JSON object')
    const booking = bookings.booking(String(req.params.bookingId))
    const newDate = inWindow(booking.providerId, date(req.body.date))
    const newStart = startTime(req.body.startTime)
    if (res.locals.raced) bookings.takeSlot({ ...booking, date: newDate, start: newStart })
    send(req, res, 200, bookingJson(bookings.reschedule(booking.bookingId, newDate, newStart)))
  })

  return router
}
