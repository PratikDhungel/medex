import { MAX_PEOPLE } from '@shared/booking/availability'
import { parseCalendarDate, type CalendarDate } from '@shared/time/calendarDate'
import { formatWallTime, parseWallTime, type WallTime } from '@shared/time/wallTime'

/**
 * What the customer has chosen so far, kept in the URL
 * (?specialist=…&people=2&date=2026-11-02&time=10:40). A failed request, a
 * retry, a reload or a shared link never loses it. Date and time are the
 * provider's.
 */
export interface BookingSelection {
  specialistId: string | null
  people: number
  date: CalendarDate | null
  time: WallTime | null
}

const KEYS = { specialistId: 'specialist', people: 'people', date: 'date', time: 'time' } as const

/** Values that can't be read are dropped, never guessed at */
export function readSelection(params: URLSearchParams): BookingSelection {
  const people = Number(params.get(KEYS.people))
  return {
    specialistId: params.get(KEYS.specialistId) || null,
    people: Number.isInteger(people) && people >= 1 && people <= MAX_PEOPLE ? people : 1,
    date: parseCalendarDate(params.get(KEYS.date)),
    // Only HH:MM, as written by writeSelection
    time: /^\d{2}:\d{2}$/.test(params.get(KEYS.time) ?? '') ? parseWallTime(params.get(KEYS.time)) : null,
  }
}

/** The selection written over `params`, keeping anything else there (e.g. mock flags) */
export function writeSelection(params: URLSearchParams, selection: BookingSelection): URLSearchParams {
  const next = new URLSearchParams(params)
  const set = (key: string, value: string | null) => (value === null ? next.delete(key) : next.set(key, value))
  set(KEYS.specialistId, selection.specialistId)
  set(KEYS.people, selection.people === 1 ? null : String(selection.people))
  set(KEYS.date, selection.date)
  set(KEYS.time, selection.time === null ? null : formatWallTime(selection.time))
  return next
}

/**
 * The selection after one choice. A time only makes sense for the
 * specialist, group size and date it was picked with, so changing any of
 * those clears it. The date stays: it may still suit the new choice, and the
 * calendar says so if it doesn't.
 */
export function choose(selection: BookingSelection, change: Partial<BookingSelection>): BookingSelection {
  const next = { ...selection, ...change }
  const timeStillValid =
    next.specialistId === selection.specialistId && next.people === selection.people && next.date === selection.date
  return 'time' in change || timeStillValid ? next : { ...next, time: null }
}

/**
 * The specialist to book with: the one chosen, if they can be booked, or the
 * only bookable one when there's no choice to make. `stale` means the URL
 * named a specialist who isn't (or is no longer) bookable, e.g. an old link.
 */
export function selectedSpecialist<S extends { id: string; consultation: unknown }>(
  specialists: readonly S[],
  specialistId: string | null,
): { specialist: S | null; stale: boolean } {
  const bookable = specialists.filter((specialist) => specialist.consultation !== null)
  const chosen = specialistId === null ? undefined : bookable.find((specialist) => specialist.id === specialistId)
  if (chosen) return { specialist: chosen, stale: false }
  return { specialist: bookable.length === 1 ? bookable[0] : null, stale: specialistId !== null }
}
