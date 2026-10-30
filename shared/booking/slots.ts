import type { CalendarDate } from '../time/calendarDate.js'
import type { WallTime } from '../time/wallTime.js'
import { instantOf, type TimeZone } from '../time/zone.js'
import type { Consultation, OpeningHours } from './schedule.js'

/**
 * The slot rule: a specialist's slots start at the start of their consultation
 * hours and repeat every duration + buffer. The last slot is the one that still
 * ends (by duration alone) by the end of those hours. A slot is offered only
 * if it fits entirely inside the provider's opening hours that day.
 */

export interface Slot {
  start: WallTime
  end: WallTime
}

export interface DaySlot extends Slot {
  booked: boolean
}

/** Minutes from one slot's start to the next */
export const slotStep = (consultation: Consultation) => consultation.durationMinutes + consultation.bufferMinutes

/** The specialist's advertised slots, before opening hours are applied */
export function consultationSlots(consultation: Consultation): Slot[] {
  const slots: Slot[] = []
  const step = slotStep(consultation)
  for (let start = consultation.start; start + consultation.durationMinutes <= consultation.end; start += step) {
    slots.push({ start, end: start + consultation.durationMinutes })
  }
  return slots
}

const fitsHours = (slot: Slot, hours: OpeningHours) => slot.start >= hours.open && slot.end <= hours.close

/**
 * Why some advertised slots aren't offered on a day the provider is open:
 * `opensAt` when slots before opening were dropped, `closesAt` when slots after
 * closing were. Null when every advertised slot fits.
 */
export interface HoursLimit {
  opensAt: WallTime | null
  closesAt: WallTime | null
}

export function hoursLimit(hours: OpeningHours, consultation: Consultation): HoursLimit | null {
  const advertised = consultationSlots(consultation)
  const opensAt = advertised.some((slot) => slot.start < hours.open) ? hours.open : null
  const closesAt = advertised.some((slot) => slot.end > hours.close) ? hours.close : null
  return opensAt === null && closesAt === null ? null : { opensAt, closesAt }
}

/**
 * The day's offered slots, marked booked or not. `bookedStarts` are the start
 * times taken with this specialist that day.
 *
 * A booking holds the doctor for duration + buffer from its start, and a slot
 * needs the same. Compared that way, a booked time that isn't on the slot grid
 * (say 10:30 on a 10:00, 10:40 grid) blocks every slot it overlaps instead of
 * matching none of them.
 */
export function daySlots(hours: OpeningHours | undefined, consultation: Consultation, bookedStarts: readonly WallTime[]): DaySlot[] {
  if (!hours) return []
  const step = slotStep(consultation)
  return consultationSlots(consultation)
    .filter((slot) => fitsHours(slot, hours))
    .map((slot) => ({
      ...slot,
      booked: bookedStarts.some((booked) => booked < slot.start + step && slot.start < booked + step),
    }))
}

/**
 * Whether the slot has already started, by the provider's clock: the moment
 * it starts at the provider is compared with now, whatever the customer's
 * device thinks the date is.
 */
export function hasStarted(zone: TimeZone, date: CalendarDate, start: WallTime, nowMs: number): boolean {
  return instantOf(zone, date, start) <= nowMs
}

/**
 * Start times from which `people` slots in a row are free, for a group
 * booking with the same specialist. "In a row" means each slot starts exactly
 * one step (duration + buffer) after the one before: a gap in the list, such
 * as a slot missing from the data, breaks the run.
 *
 * `isFree` decides each slot: not booked, not started, and during a
 * reschedule, the booking's own slots count as free.
 */
export function groupStartTimes<S extends Slot>(
  slots: readonly S[],
  people: number,
  step: number,
  isFree: (slot: S) => boolean,
): WallTime[] {
  const starts: WallTime[] = []
  for (let first = 0; first + people <= slots.length; first++) {
    let fits = true
    for (let offset = 0; offset < people && fits; offset++) {
      const slot = slots[first + offset]
      const inStep = offset === 0 || slot.start === slots[first + offset - 1].start + step
      fits = inStep && isFree(slot)
    }
    if (fits) starts.push(slots[first].start)
  }
  return starts
}
