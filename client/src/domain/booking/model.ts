import type { Consultation, WeeklySchedule } from '@shared/booking/schedule'
import type { CalendarDate } from '@shared/time/calendarDate'
import type { ZoneSource } from '@shared/time/resolveTimeZone'
import type { WallTime } from '@shared/time/wallTime'
import type { TimeZone } from '@shared/time/zone'

// What the booking UI works with. Every time is a WallTime on the provider's
// clock and every date a CalendarDate on the provider's calendar; the
// customer's own time is only ever derived from these for display.

export interface Specialist {
  id: string
  name: string
  speciality: string | null
  /** Null when the consultation hours can't be read: shown, but can't be booked */
  consultation: Consultation | null
}

export interface BookingProvider {
  id: number
  name: string
  country: string | null
  /** Null when neither `timezone` nor `country` can be read: the provider can't be booked */
  zone: TimeZone | null
  zoneSource: ZoneSource | null
  schedule: WeeklySchedule
  specialists: Specialist[]
}

export type UnavailableStatus =
  | 'past'
  | 'outside-window'
  | 'closed'
  | 'fully-booked'
  | 'no-time-left'
  | 'not-enough-in-a-row'
  /** A status this version of the app doesn't know: shown as unavailable */
  | 'unknown'

export type DayAvailability = { date: CalendarDate } & (
  | { status: 'available'; startCount: number }
  | { status: 'closure'; reason: string }
  /** Open, but none of the specialist's hours fit inside the opening hours */
  | { status: 'specialist-unavailable'; opensAt: WallTime | null; closesAt: WallTime | null }
  | { status: UnavailableStatus }
)

export interface Availability {
  /** Today at the provider, by the server's clock */
  today: CalendarDate
  days: DayAvailability[]
}

export interface Slot {
  start: WallTime
  end: WallTime
  booked: boolean
}

export interface DaySlots {
  date: CalendarDate
  /** In start order */
  slots: Slot[]
}

export interface Booking {
  bookingId: string
  providerId: number
  specialistId: string
  date: CalendarDate
  start: WallTime
  numberOfPeople: number
}

/** A start time on a date: a slot the customer can pick, or an alternative the server suggests */
export interface SlotChoice {
  date: CalendarDate
  start: WallTime
}
