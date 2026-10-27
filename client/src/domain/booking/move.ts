import { daysBetween, type CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'

/** How a rescheduled booking moves, on the provider's calendar and clock */
export interface Move {
  /** Whole days later (negative: earlier) */
  days: number
  /** Minutes later in the day (negative: earlier) */
  minutes: number
}

export function moveBetween(from: { date: CalendarDate; start: WallTime }, to: { date: CalendarDate; start: WallTime }): Move {
  return { days: daysBetween(from.date, to.date), minutes: to.start - from.start }
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours && plural(hours, 'hour'), rest && plural(rest, 'minute')].filter(Boolean).join(' ')
}

/**
 * "12 days later", "the day before", "same day, 1 hour 20 minutes earlier":
 * the headline of the change, so the customer sees which way it moves.
 */
export function moveSummary({ days, minutes }: Move): string {
  if (days === 0) {
    if (minutes === 0) return 'No change'
    return `Same day, ${duration(Math.abs(minutes))} ${minutes > 0 ? 'later' : 'earlier'}`
  }
  if (days === 1) return 'The next day'
  if (days === -1) return 'The day before'
  return `${plural(Math.abs(days), 'day')} ${days > 0 ? 'later' : 'earlier'}`
}
