import type { HoursLimit } from '@shared/booking/slots'
import { calendarDateToUtcMs, type CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'
import type { Consultation } from '@shared/booking/schedule'
import { formatTime } from '@/domain/booking/clock'
import type { SlotView } from '@/domain/booking/slotView'

const weekdays = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' })

/**
 * Why the specialist's advertised hours are cut short on this day, naming the
 * first or last time that is offered:
 * "Dr. N. Rana's hours run to 9:00 PM, but Riverside closes at 8:00 PM on Mondays, so the last time is 7:40 PM."
 */
export function hoursNote(
  limit: HoursLimit | null,
  date: CalendarDate,
  context: { providerName: string; specialistName: string; consultation: Consultation; firstStart: WallTime | null; lastStart: WallTime | null },
): string | null {
  if (!limit) return null
  const { providerName, specialistName, consultation, firstStart, lastStart } = context
  const days = `${weekdays.format(calendarDateToUtcMs(date))}s`
  const notes: string[] = []
  if (limit.opensAt !== null) {
    notes.push(
      `${specialistName}'s hours start at ${formatTime(consultation.start)}, but ${providerName} opens at ${formatTime(limit.opensAt)} on ${days}` +
        (firstStart !== null ? `, so the first time is ${formatTime(firstStart)}.` : '.'),
    )
  }
  if (limit.closesAt !== null) {
    notes.push(
      `${specialistName}'s hours run to ${formatTime(consultation.end)}, but ${providerName} closes at ${formatTime(limit.closesAt)} on ${days}` +
        (lastStart !== null ? `, so the last time is ${formatTime(lastStart)}.` : '.'),
    )
  }
  return notes.join(' ')
}

/** "6 times available" / "2 start times for 3 people" */
export function availableText(views: SlotView[], people: number): string {
  const count = views.filter((view) => view.state === 'available').length
  if (people === 1) return `${count} ${count === 1 ? 'time' : 'times'} available`
  return `${count} start ${count === 1 ? 'time' : 'times'} for ${people} people`
}
