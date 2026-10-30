/**
 * A date with no time and no zone: "2026-11-03". Whose calendar it belongs to
 * is up to the caller. Booking dates are always the provider's.
 *
 * Arithmetic runs on UTC midnights, where every day is exactly 24 hours, so
 * no daylight-saving change can shift a date.
 */
export type CalendarDate = string

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** UTC midnight at the start of the date, in ms */
export function calendarDateToUtcMs(date: CalendarDate): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** The UTC date of a moment, as YYYY-MM-DD */
export function utcMsToCalendarDate(ms: number): CalendarDate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Accepts only a real date in YYYY-MM-DD form: "2026-02-30" and "2026-1-5" are rejected */
export function parseCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null
  // Date.UTC rolls 30 February over into March, so a round trip catches impossible dates
  return utcMsToCalendarDate(calendarDateToUtcMs(value)) === value ? value : null
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return utcMsToCalendarDate(calendarDateToUtcMs(date) + days * DAY_MS)
}

/** Whole days from `from` to `to`: negative when `to` is earlier */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((calendarDateToUtcMs(to) - calendarDateToUtcMs(from)) / DAY_MS)
}

export function weekdayOf(date: CalendarDate): Weekday {
  return WEEKDAYS[new Date(calendarDateToUtcMs(date)).getUTCDay()]
}
