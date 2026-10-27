import { parseConsultation, parseWeeklySchedule } from '@shared/booking/schedule'
import { parseCalendarDate } from '@shared/time/calendarDate'
import { resolveProviderTimeZone } from '@shared/time/resolveTimeZone'
import { parseWallTime } from '@shared/time/wallTime'
import type {
  Availability,
  Booking,
  BookingProvider,
  DayAvailability,
  DaySlots,
  Slot,
  SlotChoice,
  Specialist,
  UnavailableStatus,
} from './model'
import type { RawAvailabilityDay, RawBooking, RawBookingProvider, RawSlot, RawSpecialist } from './raw'

// Raw API records → the booking model. A record that can't be used at all
// returns null; the API layer turns that into an "unexpected response"
// error. Inside a usable record, bad parts are dropped or marked unbookable
// rather than guessed at.

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)

function normaliseSpecialist(raw: RawSpecialist): Specialist | null {
  const id = text(raw.id)
  if (!id) return null
  return {
    id,
    name: text(raw.name) ?? 'Specialist',
    speciality: text(raw.speciality),
    consultation: parseConsultation(raw.consultation).value,
  }
}

/** `nowMs` decides only whether a bare offset like "UTC+05:45" matches the country's zone */
export function normaliseProvider(raw: unknown, nowMs: number): BookingProvider | null {
  if (!isObject(raw) || !Number.isInteger(raw.id)) return null
  const provider = raw as RawBookingProvider

  const resolved = resolveProviderTimeZone(provider.timezone, provider.country, nowMs)
  const seen = new Set<string>()
  const specialists: Specialist[] = []
  for (const entry of Array.isArray(provider.specialists) ? provider.specialists : []) {
    const specialist = isObject(entry) ? normaliseSpecialist(entry) : null
    if (specialist && !seen.has(specialist.id)) {
      seen.add(specialist.id)
      specialists.push(specialist)
    }
  }

  return {
    id: provider.id as number,
    name: text(provider.name) ?? 'Unnamed provider',
    country: text(provider.country)?.toUpperCase() ?? null,
    zone: resolved?.zone ?? null,
    zoneSource: resolved?.source ?? null,
    schedule: parseWeeklySchedule(provider.daySchedules).value,
    specialists,
  }
}

const UNAVAILABLE: readonly string[] = [
  'past',
  'outside-window',
  'closed',
  'fully-booked',
  'no-time-left',
  'not-enough-in-a-row',
] satisfies UnavailableStatus[]

function normaliseDay(raw: RawAvailabilityDay): DayAvailability | null {
  const date = parseCalendarDate(raw.date)
  if (!date) return null

  switch (raw.status) {
    case 'available': {
      const count = Number(raw.availableStartTimes)
      // A day "available" with nothing to book would be a dead end
      return Number.isInteger(count) && count > 0 ? { date, status: 'available', startCount: count } : { date, status: 'unknown' }
    }
    case 'closure':
      return { date, status: 'closure', reason: text(raw.reason) ?? 'Closed' }
    case 'specialist-unavailable':
      return { date, status: 'specialist-unavailable', opensAt: parseWallTime(raw.opensAt), closesAt: parseWallTime(raw.closesAt) }
    default:
      return { date, status: UNAVAILABLE.includes(raw.status as string) ? (raw.status as UnavailableStatus) : 'unknown' }
  }
}

export function normaliseAvailability(raw: unknown): Availability | null {
  if (!isObject(raw) || !Array.isArray(raw.days)) return null
  const today = parseCalendarDate(raw.today)
  if (!today) return null

  const days = raw.days
    .map((day) => (isObject(day) ? normaliseDay(day) : null))
    .filter((day): day is DayAvailability => day !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { today, days }
}

export function normaliseDaySlots(raw: unknown): DaySlots | null {
  if (!isObject(raw) || !Array.isArray(raw.slots)) return null
  const date = parseCalendarDate(raw.date)
  if (!date) return null

  const slots: Slot[] = []
  for (const entry of raw.slots as unknown[]) {
    if (!isObject(entry)) continue
    const { startTime, endTime, isBooked } = entry as RawSlot
    const start = parseWallTime(startTime)
    const end = parseWallTime(endTime)
    if (start === null || end === null || end <= start) continue
    // Anything but a clear "not booked" counts as booked: offering a taken slot is worse than hiding a free one
    slots.push({ start, end, booked: isBooked !== false })
  }
  slots.sort((a, b) => a.start - b.start)
  return { date, slots: slots.filter((slot, i) => i === 0 || slot.start !== slots[i - 1].start) }
}

export function normaliseBooking(raw: unknown): Booking | null {
  if (!isObject(raw)) return null
  const { bookingId, providerId, specialistId, date, startTime, numberOfPeople } = raw as RawBooking
  const id = text(bookingId)
  const specialist = text(specialistId)
  const day = parseCalendarDate(date)
  const start = parseWallTime(startTime)
  if (!id || !Number.isInteger(providerId) || !specialist || !day || start === null) return null
  return {
    bookingId: id,
    providerId: providerId as number,
    specialistId: specialist,
    date: day,
    start,
    numberOfPeople: Number.isInteger(numberOfPeople) && (numberOfPeople as number) >= 1 ? (numberOfPeople as number) : 1,
  }
}

/** The nearest bookable times a 409 carries in `details.alternatives`; unreadable entries are dropped */
export function readAlternatives(details: unknown): SlotChoice[] {
  if (!isObject(details) || !Array.isArray(details.alternatives)) return []
  return details.alternatives.flatMap((entry: unknown) => {
    if (!isObject(entry)) return []
    const date = parseCalendarDate(entry.date)
    const start = parseWallTime(entry.startTime)
    return date && start !== null ? [{ date, start }] : []
  })
}
