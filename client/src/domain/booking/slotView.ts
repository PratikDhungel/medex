import { hoursLimit, groupStartTimes, hasStarted, slotStep } from '@shared/booking/slots'
import type { Consultation, WeeklySchedule } from '@shared/booking/schedule'
import { weekdayOf, type CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'
import type { TimeZone } from '@shared/time/zone'
import { customerTimeOf } from './clock'
import type { Slot } from './model'

// The day's times as the customer sees them: what each one is, both clocks,
// and which part of the day it falls in. All on the provider's clock.

export type SlotState =
  /** Can be chosen */
  | 'available'
  /** Someone else has it */
  | 'booked'
  /** Today, and it has started at the provider */
  | 'started'
  /** Free, but the slots after it can't take the whole group */
  | 'no-room'

export interface SlotView {
  start: WallTime
  end: WallTime
  state: SlotState
  /** When it starts on the customer's own clock */
  customer: { date: CalendarDate; time: WallTime }
}

export interface SlotContext {
  date: CalendarDate
  zone: TimeZone
  customerZone: TimeZone
  consultation: Consultation
  people: number
  nowMs: number
  /** Start times held by the booking being rescheduled: free for it */
  ownStarts?: ReadonlySet<WallTime>
}

export function slotViews(slots: readonly Slot[], context: SlotContext): SlotView[] {
  const { date, zone, customerZone, consultation, people, nowMs, ownStarts } = context
  const booked = (slot: Slot) => slot.booked && !ownStarts?.has(slot.start)
  const started = (slot: Slot) => hasStarted(zone, date, slot.start, nowMs)
  const startable = new Set(groupStartTimes(slots, people, slotStep(consultation), (slot) => !booked(slot) && !started(slot)))

  return slots.map((slot) => ({
    start: slot.start,
    end: slot.end,
    state: booked(slot) ? 'booked' : started(slot) ? 'started' : startable.has(slot.start) ? 'available' : 'no-room',
    customer: customerTimeOf(zone, date, slot.start, customerZone),
  }))
}

/** When the last person's appointment ends: one slot per person, with the buffers between them */
export const bookingEnd = (consultation: Consultation, start: WallTime, people: number): WallTime =>
  start + (people - 1) * slotStep(consultation) + consultation.durationMinutes

export type PartOfDay = 'morning' | 'afternoon' | 'evening'

const NOON = 12 * 60
const FIVE_PM = 17 * 60

export const partOfDay = (time: WallTime): PartOfDay => (time < NOON ? 'morning' : time < FIVE_PM ? 'afternoon' : 'evening')

/** Slots by part of the provider's day, leaving out parts with none */
export function groupByPartOfDay<S extends { start: WallTime }>(slots: readonly S[]): { part: PartOfDay; slots: S[] }[] {
  const parts: PartOfDay[] = ['morning', 'afternoon', 'evening']
  return parts
    .map((part) => ({ part, slots: slots.filter((slot) => partOfDay(slot.start) === part) }))
    .filter((group) => group.slots.length > 0)
}

/**
 * Why some of the specialist's advertised hours aren't offered on this day,
 * or null when they all are: the provider opens later or closes earlier.
 */
export function hoursLimitOn(date: CalendarDate, schedule: WeeklySchedule, consultation: Consultation) {
  const hours = schedule[weekdayOf(date)]
  return hours ? hoursLimit(hours, consultation) : null
}
