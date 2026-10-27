import { calendarDateToUtcMs, utcMsToCalendarDate, type CalendarDate } from './calendarDate.js'
import type { WallTime } from './wallTime.js'

/**
 * Time zones and the arithmetic between a provider's wall clock and real
 * moments. Built on Intl only, so it runs the same on the server and in the
 * browser.
 *
 * A fixed offset is computed here rather than handed to Intl as "+05:45":
 * offset ids in Intl are new and not in every browser yet.
 */
export type TimeZone = { kind: 'iana'; id: string } | { kind: 'fixed'; offsetMinutes: number }

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(id: string): Intl.DateTimeFormat {
  let formatter = formatters.get(id)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(id, formatter)
  }
  return formatter
}

/** Whether this runtime's Intl knows the IANA zone */
export function isSupportedZoneId(id: string): boolean {
  try {
    formatterFor(id)
    return true
  } catch {
    return false
  }
}

/** The zone's offset from UTC at a moment, in minutes: +345 for Kathmandu */
export function offsetMinutesAt(zone: TimeZone, ms: number): number {
  if (zone.kind === 'fixed') return zone.offsetMinutes

  const parts: Record<string, number> = {}
  for (const part of formatterFor(zone.id).formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  // Intl has no milliseconds here, so compare against the whole second
  return Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / MINUTE_MS)
}

/** The provider's date and wall-clock time at a moment */
export function zonedDateTimeAt(zone: TimeZone, ms: number): { date: CalendarDate; time: WallTime } {
  const shifted = ms + offsetMinutesAt(zone, ms) * MINUTE_MS
  const date = utcMsToCalendarDate(shifted)
  const time = Math.floor((shifted - calendarDateToUtcMs(date)) / MINUTE_MS)
  return { date, time }
}

/** Today's date on the zone's own calendar, which can differ from the device's */
export function todayIn(zone: TimeZone, nowMs: number): CalendarDate {
  return zonedDateTimeAt(zone, nowMs).date
}

/**
 * The moment a wall-clock time happens in the zone.
 *
 * Around a daylight-saving change a wall time can happen twice (clocks go
 * back) or never (clocks go forward). Twice: the first one is returned.
 * Never: the time is read with the offset from before the change, which lands
 * just after the gap, as a person resetting their watch would expect. None of
 * the providers' zones have daylight saving today; this keeps the logic right
 * if one ever does.
 */
export function instantOf(zone: TimeZone, date: CalendarDate, time: WallTime): number {
  const wallAsUtc = calendarDateToUtcMs(date) + time * MINUTE_MS
  if (zone.kind === 'fixed') return wallAsUtc - zone.offsetMinutes * MINUTE_MS

  // A day either side is past any change touching this wall time
  const offsetBefore = offsetMinutesAt(zone, wallAsUtc - DAY_MS)
  const offsetAfter = offsetMinutesAt(zone, wallAsUtc + DAY_MS)
  const candidates = [wallAsUtc - offsetBefore * MINUTE_MS, wallAsUtc - offsetAfter * MINUTE_MS]

  const matching = candidates.filter((ms) => {
    const local = zonedDateTimeAt(zone, ms)
    return local.date === date && local.time === time
  })
  return matching.length > 0 ? Math.min(...matching) : candidates[0]
}

/** "UTC+7", "UTC+5:45", "UTC-3:30", "UTC" */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC'
  const sign = offsetMinutes > 0 ? '+' : '-'
  const hours = Math.floor(Math.abs(offsetMinutes) / 60)
  const minutes = Math.abs(offsetMinutes) % 60
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}
