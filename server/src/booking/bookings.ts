import {
  BOOKING_WINDOW_DAYS,
  MAX_PEOPLE,
  dayStatus,
  nearestAlternatives,
  type DayStatus,
  type SlotRef,
  type SpecialistDay,
} from '../../../shared/booking/availability.js'
import { consultationSlots, daySlots, hasStarted, slotStep, type DaySlot } from '../../../shared/booking/slots.js'
import { addDays, daysBetween, weekdayOf, type CalendarDate } from '../../../shared/time/calendarDate.js'
import { formatWallTime, type WallTime } from '../../../shared/time/wallTime.js'
import { todayIn } from '../../../shared/time/zone.js'
import { ApiError } from '../cart/errors.js'
import type { BookingData, ProviderRecord, SeedBooking, TakenSlot } from './data.js'

/**
 * Bookings held in memory, seeded from the data file. Every check runs on the
 * provider's own clock and calendar.
 */

export type Booking = SeedBooking

export interface BookingRequest {
  providerId: number
  specialistId: string
  date: CalendarDate
  start: WallTime
  numberOfPeople: number
  idempotencyKey?: string
}

/** A booking as the API returns it */
export function bookingJson(booking: Booking) {
  const { bookingId, providerId, specialistId, date, start, numberOfPeople } = booking
  return { bookingId, providerId, specialistId, date, startTime: formatWallTime(start), numberOfPeople }
}

/** How far either side of the wanted day to look for alternatives */
const ALTERNATIVE_DAYS = 3
const ALTERNATIVE_COUNT = 3

const MESSAGES: Record<Exclude<DayStatus['kind'], 'available'>, string> = {
  past: 'That day has already passed.',
  'outside-window': `Bookings open ${BOOKING_WINDOW_DAYS} days ahead.`,
  closure: 'The provider is closed that day.',
  closed: 'The provider is closed that day.',
  'specialist-unavailable': "The specialist isn't available that day.",
  'fully-booked': 'That day is fully booked.',
  'no-time-left': 'There are no times left today.',
  'not-enough-in-a-row': "There aren't enough times in a row that day for your group.",
}

export class BookingService {
  private bookings = new Map<string, Booking>()
  /** Slots taken by "someone else" through the dev panel, on top of the data file */
  private raced: TakenSlot[] = []
  private keys = new Map<string, { fingerprint: string; bookingId: string }>()
  private sequence = 0

  constructor(
    private readonly data: BookingData,
    private readonly now: () => number = Date.now,
    /** Dev panel: specialists to treat as fully booked on every day */
    private readonly fullyBooked: () => ReadonlySet<string> = () => new Set(),
  ) {
    this.reset()
  }

  reset() {
    this.bookings = new Map()
    if (this.data.existingBooking) this.bookings.set(this.data.existingBooking.bookingId, { ...this.data.existingBooking })
    this.raced = []
    this.keys = new Map()
    this.sequence = 0
  }

  provider(id: number): ProviderRecord {
    const provider = this.data.providers.get(id)
    if (!provider) throw new ApiError(404, 'provider_not_found', 'We could not find this provider.')
    return provider
  }

  get providers(): ProviderRecord[] {
    return [...this.data.providers.values()]
  }

  booking(id: string): Booking {
    const booking = this.bookings.get(id)
    if (!booking) throw new ApiError(404, 'booking_not_found', 'We could not find this booking.')
    return booking
  }

  /** Today at the provider */
  today(providerId: number): CalendarDate {
    return todayIn(this.bookableProvider(providerId).zone, this.now())
  }

  /** The day's offered slots for a specialist. `rescheduling` counts that booking's slots as free. */
  slots(providerId: number, specialistId: string, date: CalendarDate, rescheduling?: string): DaySlot[] {
    const day = this.specialistDay(providerId, specialistId, date, rescheduling)
    if (day.closure !== undefined) return []
    return daySlots(day.schedule[weekdayOf(date)], day.consultation, day.bookedStarts)
  }

  /** Every date in the window with its status, for `people` people */
  availability(providerId: number, specialistId: string, people: number, rescheduling?: string) {
    const today = this.today(providerId)
    const now = this.now()
    const days = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, offset) => {
      const date = addDays(today, offset)
      return { date, status: dayStatus(this.specialistDay(providerId, specialistId, date, rescheduling), people, now) }
    })
    return { today, days }
  }

  create(request: BookingRequest): { bookingId: string } {
    const fingerprint = JSON.stringify({ ...request, idempotencyKey: undefined })
    const previous = request.idempotencyKey ? this.keys.get(request.idempotencyKey) : undefined
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new ApiError(409, 'idempotency_key_reused', 'This request key was already used for a different booking.')
      }
      return { bookingId: previous.bookingId }
    }

    this.assertBookable(request)
    const bookingId = this.nextBookingId()
    const { providerId, specialistId, date, start, numberOfPeople } = request
    this.bookings.set(bookingId, { bookingId, providerId, specialistId, date, start, numberOfPeople })
    if (request.idempotencyKey) this.keys.set(request.idempotencyKey, { fingerprint, bookingId })
    return { bookingId }
  }

  /**
   * Moves a booking to another time with the same specialist and group size.
   * Its own slots count as free, so a group can move by one slot, and sending
   * the same move twice is harmless.
   */
  reschedule(bookingId: string, date: CalendarDate, start: WallTime): Booking {
    const booking = this.booking(bookingId)
    this.assertBookable({ ...booking, date, start }, bookingId)
    const moved = { ...booking, date, start }
    this.bookings.set(bookingId, moved)
    return moved
  }

  /**
   * Dev panel: someone else books this slot right before the customer's
   * request arrives, so the request meets a real conflict.
   */
  takeSlot(slot: TakenSlot) {
    this.raced.push(slot)
  }

  /** Same shape as the data file's ids: BK-<UTC date made>-<sequence> */
  private nextBookingId(): string {
    const made = new Date(this.now()).toISOString().slice(0, 10).replaceAll('-', '')
    let id: string
    do {
      this.sequence += 1
      id = `BK-${made}-${String(this.sequence).padStart(4, '0')}`
    } while (this.bookings.has(id))
    return id
  }

  private bookableProvider(providerId: number): ProviderRecord & { zone: NonNullable<ProviderRecord['zone']> } {
    const provider = this.provider(providerId)
    if (!provider.zone) {
      throw new ApiError(422, 'provider_unavailable', "This provider can't take online bookings right now.")
    }
    return provider as ProviderRecord & { zone: NonNullable<ProviderRecord['zone']> }
  }

  private specialistDay(providerId: number, specialistId: string, date: CalendarDate, rescheduling?: string): SpecialistDay {
    const provider = this.bookableProvider(providerId)
    const specialist = provider.specialists.get(specialistId)
    if (!specialist) throw new ApiError(404, 'specialist_not_found', 'We could not find this specialist.')
    if (!specialist.consultation) {
      throw new ApiError(422, 'specialist_unavailable', "This specialist's hours aren't available for online booking.")
    }

    const step = slotStep(specialist.consultation)
    const sameDay = (slot: TakenSlot) => slot.providerId === providerId && slot.specialistId === specialistId && slot.date === date
    const bookedStarts = [
      ...(this.fullyBooked().has(specialistId) ? consultationSlots(specialist.consultation).map((slot) => slot.start) : []),
      ...this.data.bookedSlots.filter(sameDay).map((slot) => slot.start),
      ...this.raced.filter(sameDay).map((slot) => slot.start),
      // A group booking holds one slot per person, one after another
      ...[...this.bookings.values()]
        .filter((booking) => booking.bookingId !== rescheduling && sameDay(booking))
        .flatMap((booking) => Array.from({ length: booking.numberOfPeople }, (_, i) => booking.start + i * step)),
    ]

    return {
      date,
      zone: provider.zone,
      schedule: provider.schedule,
      consultation: specialist.consultation,
      closure: provider.closures.get(date),
      bookedStarts,
    }
  }

  /**
   * Throws a 409 unless `people` slots in a row from `start` are free now. A
   * conflict says whether someone else holds one of the slots (`slot_taken`)
   * or the time can't be booked at all (`slot_unavailable`), and carries the
   * nearest times that can.
   */
  private assertBookable(request: Omit<BookingRequest, 'idempotencyKey'>, rescheduling?: string) {
    const { providerId, specialistId, date, start, numberOfPeople } = request
    if (numberOfPeople < 1 || numberOfPeople > MAX_PEOPLE) {
      throw new ApiError(400, 'invalid_request', `"numberOfPeople" must be between 1 and ${MAX_PEOPLE}`)
    }

    const day = this.specialistDay(providerId, specialistId, date, rescheduling)
    const status = dayStatus(day, numberOfPeople, this.now())
    if (status.kind === 'available' && status.startTimes.includes(start)) return

    const conflict = (code: string, message: string) =>
      new ApiError(409, code, message, { alternatives: this.alternatives(request, rescheduling) })

    if (status.kind !== 'available') throw conflict('slot_unavailable', MESSAGES[status.kind])

    const step = slotStep(day.consultation)
    const slots = daySlots(day.schedule[weekdayOf(date)], day.consultation, day.bookedStarts)
    const run = Array.from({ length: numberOfPeople }, (_, i) => slots.find((slot) => slot.start === start + i * step))
    if (run.some((slot) => slot?.booked)) {
      throw conflict('slot_taken', 'Someone else booked this time a moment ago.')
    }
    if (hasStarted(day.zone, date, start, this.now())) throw conflict('slot_unavailable', 'This time has already started.')
    throw conflict('slot_unavailable', `This time isn't offered for ${numberOfPeople === 1 ? 'one person' : `${numberOfPeople} people`}.`)
  }

  /** The bookable times nearest to the wanted one, a few days either side */
  private alternatives(request: Omit<BookingRequest, 'idempotencyKey'>, rescheduling?: string) {
    const { providerId, specialistId, date, start, numberOfPeople } = request
    const today = this.today(providerId)
    const now = this.now()

    const candidates: SlotRef[] = []
    for (let offset = -ALTERNATIVE_DAYS; offset <= ALTERNATIVE_DAYS; offset++) {
      const candidateDate = addDays(date, offset)
      const fromToday = daysBetween(today, candidateDate)
      if (fromToday < 0 || fromToday >= BOOKING_WINDOW_DAYS) continue
      const status = dayStatus(this.specialistDay(providerId, specialistId, candidateDate, rescheduling), numberOfPeople, now)
      if (status.kind === 'available') candidates.push(...status.startTimes.map((time) => ({ date: candidateDate, start: time })))
    }

    const zone = this.bookableProvider(providerId).zone
    return nearestAlternatives(candidates, { date, start }, zone, ALTERNATIVE_COUNT).map((slot) => ({
      date: slot.date,
      startTime: formatWallTime(slot.start),
    }))
  }
}
