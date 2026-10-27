import type { Consultation } from '@shared/booking/schedule'
import { calendarDateToUtcMs, type CalendarDate } from '@shared/time/calendarDate'
import { BOOKING_WINDOW_DAYS } from '@shared/booking/availability'
import { formatTime } from '@/domain/booking/clock'
import type { DayAvailability } from '@/domain/booking/model'

// Why a day can't be booked, in two lengths: a word that fits in a calendar
// cell, and a sentence for the day panel and screen readers.

export interface DayContext {
  providerName: string
  specialistName: string
  consultation: Consultation
  people: number
  /** "Bangkok" */
  city: string
  /** The provider's wall-clock time now, for "today" explanations */
  providerTimeNow: number
}

/** The word shown in the cell, or null when the cell's look says enough (past days) */
export function dayShortLabel(day: DayAvailability): string | null {
  switch (day.status) {
    case 'available':
      return null
    case 'closed':
    case 'closure':
      return 'Closed'
    case 'specialist-unavailable':
      return 'Off'
    case 'fully-booked':
      return 'Full'
    case 'no-time-left':
      return 'Ended'
    case 'not-enough-in-a-row':
      return 'Too few'
    case 'past':
    case 'outside-window':
    case 'unknown':
      return null
  }
}

const weekdays = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' })
/** "Fridays" */
const weekdayPlural = (date: CalendarDate) => `${weekdays.format(calendarDateToUtcMs(date))}s`

/** "Dr. N. Rana's" */
const possessive = (name: string) => `${name}'${name.endsWith('s') ? '' : 's'}`

export function dayReason(day: DayAvailability, context: DayContext): string {
  const { providerName, specialistName, consultation, people, city } = context

  switch (day.status) {
    case 'available':
      return `${day.startCount === 1 ? '1 time' : `${day.startCount} times`} available.`
    case 'past':
      return `This day has already passed in ${city}.`
    case 'outside-window':
      return `Bookings open ${BOOKING_WINDOW_DAYS} days ahead.`
    case 'closed':
      return `${providerName} is closed on ${weekdayPlural(day.date)}.`
    case 'closure':
      return `${providerName} is closed that day: ${day.reason}.`
    case 'specialist-unavailable': {
      const days = weekdayPlural(day.date)
      if (day.closesAt !== null && day.opensAt === null) {
        return consultation.start >= day.closesAt
          ? `${providerName} closes at ${formatTime(day.closesAt)} on ${days}, before ${possessive(specialistName)} hours start at ${formatTime(consultation.start)}.`
          : `${providerName} closes at ${formatTime(day.closesAt)} on ${days}, too early for any of ${possessive(specialistName)} appointments.`
      }
      if (day.opensAt !== null && day.closesAt === null) {
        return consultation.end <= day.opensAt
          ? `${providerName} opens at ${formatTime(day.opensAt)} on ${days}, after ${possessive(specialistName)} hours end at ${formatTime(consultation.end)}.`
          : `${providerName} opens at ${formatTime(day.opensAt)} on ${days}, too late for any of ${possessive(specialistName)} appointments.`
      }
      return `${possessive(specialistName)} hours don't fit ${possessive(providerName)} opening hours on ${days}.`
    }
    case 'fully-booked':
      return `${specialistName} is fully booked that day.`
    case 'no-time-left':
      return `${possessive(specialistName)} last time today has already started. It's ${formatTime(context.providerTimeNow)} in ${city}.`
    case 'not-enough-in-a-row':
      return `${specialistName} doesn't have ${people} times in a row free that day for your group. Try another day, or fewer people.`
    case 'unknown':
      return "This day can't be booked online."
  }
}
