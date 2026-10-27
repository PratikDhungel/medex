import { BOOKING_WINDOW_DAYS } from '@shared/booking/availability'
import { addDays, calendarDateToUtcMs, daysBetween, type CalendarDate } from '@shared/time/calendarDate'
import type { DayAvailability } from './model'

// The booking calendar's logic: which month shows which dates, where arrow
// keys move, and what each date's status is. All dates are the provider's.

/** "2026-11" */
export type Month = string

export const monthOf = (date: CalendarDate): Month => date.slice(0, 7)

/** First day of a month offset by `months` */
export function addMonths(month: Month, months: number): Month {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + months, 1))
  return date.toISOString().slice(0, 7)
}

/**
 * The month as weeks of dates, Sunday first (the usual start of the week in
 * Thailand, Nepal and India). Days of the neighbouring months are null.
 */
export function monthWeeks(month: Month): (CalendarDate | null)[][] {
  const first = `${month}-01`
  const lead = new Date(calendarDateToUtcMs(first)).getUTCDay()
  const length = daysBetween(first, `${addMonths(month, 1)}-01`)

  const cells: (CalendarDate | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => addDays(first, i)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

/** The bookable window at the provider: today and the following 89 days */
export interface BookingWindow {
  first: CalendarDate
  last: CalendarDate
}

export const bookingWindow = (today: CalendarDate): BookingWindow => ({
  first: today,
  last: addDays(today, BOOKING_WINDOW_DAYS - 1),
})

export const inWindow = (date: CalendarDate, window: BookingWindow) => date >= window.first && date <= window.last

/** The months the window touches, for the month switcher */
export function windowMonths(window: BookingWindow): Month[] {
  const months: Month[] = []
  for (let month = monthOf(window.first); month <= monthOf(window.last); month = addMonths(month, 1)) months.push(month)
  return months
}

export type CalendarKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown'

/**
 * Where focus goes for a key, following the WAI-ARIA date picker pattern,
 * kept inside the window. PageUp/PageDown keep the day of the month where it
 * exists (31 January → 28 February).
 */
export function moveFocus(date: CalendarDate, key: CalendarKey, window: BookingWindow): CalendarDate {
  const weekday = new Date(calendarDateToUtcMs(date)).getUTCDay()
  let next: CalendarDate
  switch (key) {
    case 'ArrowLeft':
      next = addDays(date, -1)
      break
    case 'ArrowRight':
      next = addDays(date, 1)
      break
    case 'ArrowUp':
      next = addDays(date, -7)
      break
    case 'ArrowDown':
      next = addDays(date, 7)
      break
    case 'Home':
      next = addDays(date, -weekday)
      break
    case 'End':
      next = addDays(date, 6 - weekday)
      break
    case 'PageUp':
    case 'PageDown': {
      const month = addMonths(monthOf(date), key === 'PageUp' ? -1 : 1)
      const length = daysBetween(`${month}-01`, `${addMonths(month, 1)}-01`)
      next = `${month}-${String(Math.min(Number(date.slice(8)), length)).padStart(2, '0')}`
      break
    }
  }
  if (next < window.first) return window.first
  if (next > window.last) return window.last
  return next
}

/**
 * A date's status for the calendar. The server's answer is used, except that
 * a date already past by the provider's clock in this browser is past: the
 * calendar may have been loaded before midnight there.
 */
export function dayStatusOn(
  date: CalendarDate,
  days: ReadonlyMap<CalendarDate, DayAvailability>,
  providerToday: CalendarDate,
  window: BookingWindow,
): DayAvailability {
  if (date < providerToday) return { date, status: 'past' }
  if (!inWindow(date, window)) return { date, status: 'outside-window' }
  return days.get(date) ?? { date, status: 'unknown' }
}

/** The first bookable date after `date` (or from the start, when null) */
export function nextAvailableDate(days: readonly DayAvailability[], after: CalendarDate | null, providerToday: CalendarDate) {
  return days.find((day) => day.status === 'available' && day.date >= providerToday && (after === null || day.date > after))?.date ?? null
}

/** The last bookable date before `date`, for "or the day before" suggestions */
export function previousAvailableDate(days: readonly DayAvailability[], before: CalendarDate, providerToday: CalendarDate) {
  return days.findLast((day) => day.status === 'available' && day.date >= providerToday && day.date < before)?.date ?? null
}
