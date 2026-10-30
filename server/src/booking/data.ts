import { readFileSync } from 'node:fs'
import { parseConsultation, parseWeeklySchedule, type Consultation, type WeeklySchedule } from '../../../shared/booking/schedule.js'
import { addDays, type CalendarDate } from '../../../shared/time/calendarDate.js'
import { resolveProviderTimeZone } from '../../../shared/time/resolveTimeZone.js'
import { parseWallTime, type WallTime } from '../../../shared/time/wallTime.js'
import { todayIn, type TimeZone } from '../../../shared/time/zone.js'
import { dataFile } from '../paths.js'

/**
 * Loads task3-booking.json. Providers are served exactly as stored, so the
 * client meets the same messy fields the real API sends. The server also keeps
 * a parsed copy to work out slots and check bookings.
 *
 * dayOffset counts from today at each provider, so it becomes a date on that
 * provider's calendar, once, when the server starts. Two providers' "day 0"
 * can be different dates.
 */

export interface SpecialistRecord {
  id: string
  /** Null when its consultation hours can't be read: it can't be booked */
  consultation: Consultation | null
}

export interface ProviderRecord {
  id: number
  /** Served as is */
  raw: Record<string, unknown>
  /** Null when neither the timezone nor the country can be read: it can't be booked */
  zone: TimeZone | null
  schedule: WeeklySchedule
  specialists: Map<string, SpecialistRecord>
  /** One-off closures, with the provider's reason */
  closures: Map<CalendarDate, string>
}

export interface TakenSlot {
  providerId: number
  specialistId: string
  date: CalendarDate
  start: WallTime
}

export interface SeedBooking extends TakenSlot {
  bookingId: string
  numberOfPeople: number
}

export interface BookingData {
  providers: Map<number, ProviderRecord>
  bookedSlots: TakenSlot[]
  existingBooking: SeedBooking | null
  /** Records that were skipped or read with a fallback, logged at startup */
  issues: string[]
}

const DATA_FILE = dataFile('task3-booking.json')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function loadBookingData(file: URL = DATA_FILE, nowMs = Date.now()): BookingData {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!isObject(raw) || !Array.isArray(raw.providers)) throw new Error(`${file.pathname}: "providers" must be an array`)
  return parseBookingData(raw, nowMs)
}

export function parseBookingData(raw: Record<string, unknown>, nowMs: number): BookingData {
  const issues: string[] = []
  const providers = new Map<number, ProviderRecord>()

  for (const [index, entry] of (raw.providers as unknown[]).entries()) {
    if (!isObject(entry) || !Number.isInteger(entry.id)) {
      issues.push(`providers[${index}] has no numeric id; skipped`)
      continue
    }
    const id = entry.id as number
    if (providers.has(id)) {
      issues.push(`provider ${id} appears twice; the first is used`)
      continue
    }

    const resolved = resolveProviderTimeZone(entry.timezone, entry.country, nowMs)
    if (!resolved) issues.push(`provider ${id}: timezone ${JSON.stringify(entry.timezone)} and country unreadable; can't be booked`)
    else if (resolved.source === 'country') {
      issues.push(`provider ${id}: timezone ${JSON.stringify(entry.timezone)} unreadable; using its country's zone`)
    }

    const schedule = parseWeeklySchedule(entry.daySchedules)
    issues.push(...schedule.issues.map((issue) => `provider ${id}: ${issue}`))

    const specialists = new Map<string, SpecialistRecord>()
    for (const specialist of Array.isArray(entry.specialists) ? entry.specialists : []) {
      if (!isObject(specialist) || typeof specialist.id !== 'string' || specialists.has(specialist.id)) {
        issues.push(`provider ${id}: a specialist has a missing or repeated id; skipped`)
        continue
      }
      const consultation = parseConsultation(specialist.consultation)
      issues.push(...consultation.issues.map((issue) => `specialist ${specialist.id}: ${issue}`))
      specialists.set(specialist.id, { id: specialist.id, consultation: consultation.value })
    }

    providers.set(id, { id, raw: entry, zone: resolved?.zone ?? null, schedule: schedule.value, specialists, closures: new Map() })
  }

  /** dayOffset → the date at that provider, or null when the provider can't be dated */
  const dateAt = (provider: ProviderRecord, dayOffset: unknown): CalendarDate | null =>
    provider.zone && Number.isInteger(dayOffset) ? addDays(todayIn(provider.zone, nowMs), dayOffset as number) : null

  for (const closure of Array.isArray(raw.closures) ? raw.closures : []) {
    const provider = isObject(closure) ? providers.get(closure.providerId as number) : undefined
    const date = provider && dateAt(provider, closure.dayOffset)
    if (!provider || !date) {
      issues.push(`closure ${JSON.stringify(closure)} has an unknown provider or day; skipped`)
      continue
    }
    if (!provider.closures.has(date)) provider.closures.set(date, typeof closure.reason === 'string' ? closure.reason : '')
  }

  /** A provider/specialist/day/time reference, or null with an issue logged */
  const takenSlot = (entry: unknown, label: string): TakenSlot | null => {
    const provider = isObject(entry) ? providers.get(entry.providerId as number) : undefined
    const specialistId = isObject(entry) ? entry.specialistId : undefined
    const date = provider && dateAt(provider, (entry as Record<string, unknown>).dayOffset)
    const start = isObject(entry) ? parseWallTime(entry.startTime) : null
    if (!provider || typeof specialistId !== 'string' || !provider.specialists.has(specialistId) || !date || start === null) {
      issues.push(`${label} ${JSON.stringify(entry)} can't be read; skipped`)
      return null
    }
    return { providerId: provider.id, specialistId, date, start }
  }

  const bookedSlots: TakenSlot[] = []
  for (const entry of Array.isArray(raw.bookedSlots) ? raw.bookedSlots : []) {
    const slot = takenSlot(entry, 'booked slot')
    if (slot) bookedSlots.push(slot)
  }

  let existingBooking: SeedBooking | null = null
  if (raw.existingBooking !== undefined) {
    const slot = takenSlot(raw.existingBooking, 'existingBooking')
    const { bookingId, numberOfPeople } = raw.existingBooking as Record<string, unknown>
    if (slot && typeof bookingId === 'string') {
      const people = Number.isInteger(numberOfPeople) && (numberOfPeople as number) >= 1 ? (numberOfPeople as number) : 1
      existingBooking = { ...slot, bookingId, numberOfPeople: people }
    }
  }

  return { providers, bookedSlots, existingBooking, issues }
}
