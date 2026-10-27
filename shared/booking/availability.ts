import { daysBetween, weekdayOf, type CalendarDate } from '../time/calendarDate.js'
import type { WallTime } from '../time/wallTime.js'
import { instantOf, todayIn, type TimeZone } from '../time/zone.js'
import type { Consultation, WeeklySchedule } from './schedule.js'
import { daySlots, groupStartTimes, hasStarted, hoursLimit, slotStep, type DaySlot, type HoursLimit } from './slots.js'

/** Bookings open for today plus the next 89 days, counted on the provider's calendar */
export const BOOKING_WINDOW_DAYS = 90

export const MAX_PEOPLE = 4

/**
 * Whether a day can be booked, and if not, the reason the customer is shown.
 * Reasons are checked in this order, so each day gets the one that matters
 * most: a holiday is "closed for a public holiday", not "fully booked".
 */
export type DayStatus =
  | { kind: 'available'; startTimes: WallTime[] }
  | { kind: 'past' }
  | { kind: 'outside-window' }
  /** A one-off closure, with the provider's reason */
  | { kind: 'closure'; reason: string }
  /** Closed every week on this weekday */
  | { kind: 'closed' }
  /** Open, but none of the specialist's hours fit inside the opening hours */
  | { kind: 'specialist-unavailable'; limit: HoursLimit | null }
  | { kind: 'fully-booked' }
  /** Today, and every slot still free has already started */
  | { kind: 'no-time-left' }
  /** Free slots exist, but not enough in a row for the group */
  | { kind: 'not-enough-in-a-row'; people: number }

export interface SpecialistDay {
  date: CalendarDate
  zone: TimeZone
  schedule: WeeklySchedule
  consultation: Consultation
  /** The provider's reason when the date is a one-off closure */
  closure?: string
  /** Start times taken with this specialist on the date */
  bookedStarts: readonly WallTime[]
}

export function dayStatus(day: SpecialistDay, people: number, nowMs: number): DayStatus {
  const offset = daysBetween(todayIn(day.zone, nowMs), day.date)
  if (offset < 0) return { kind: 'past' }
  if (offset >= BOOKING_WINDOW_DAYS) return { kind: 'outside-window' }
  // A closure wins over bookings recorded on that day; see the README
  if (day.closure !== undefined) return { kind: 'closure', reason: day.closure.trim() || 'Closed' }

  const hours = day.schedule[weekdayOf(day.date)]
  if (!hours) return { kind: 'closed' }

  const slots = daySlots(hours, day.consultation, day.bookedStarts)
  if (slots.length === 0) return { kind: 'specialist-unavailable', limit: hoursLimit(hours, day.consultation) }

  const unbooked = slots.filter((slot) => !slot.booked)
  if (unbooked.length === 0) return { kind: 'fully-booked' }

  const isFree = (slot: DaySlot) => !slot.booked && !hasStarted(day.zone, day.date, slot.start, nowMs)
  if (!unbooked.some(isFree)) return { kind: 'no-time-left' }

  const startTimes = groupStartTimes(slots, people, slotStep(day.consultation), isFree)
  return startTimes.length > 0 ? { kind: 'available', startTimes } : { kind: 'not-enough-in-a-row', people }
}

export interface SlotRef {
  date: CalendarDate
  start: WallTime
}

/**
 * The `limit` candidates closest in time to the one the customer wanted,
 * e.g. after someone else took it. Distance is measured in real time, so
 * 23:00 is close to 00:30 the next day. On a tie the earlier one comes first.
 */
export function nearestAlternatives(candidates: readonly SlotRef[], wanted: SlotRef, zone: TimeZone, limit: number): SlotRef[] {
  const target = instantOf(zone, wanted.date, wanted.start)
  return candidates
    .filter((slot) => slot.date !== wanted.date || slot.start !== wanted.start)
    .map((slot) => ({ slot, at: instantOf(zone, slot.date, slot.start) }))
    .sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target) || a.at - b.at)
    .slice(0, limit)
    .map(({ slot }) => slot)
}
