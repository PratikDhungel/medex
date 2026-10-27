import { slotStep } from '@shared/booking/slots'
import type { Consultation } from '@shared/booking/schedule'
import type { CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'
import type { TimeZone } from '@shared/time/zone'
import { customerTimeOf, formatDate, formatTime, sameClock, zoneCity } from '@/domain/booking/clock'
import { bookingEnd } from '@/domain/booking/slotView'
import { cn } from '@/lib/utils'
import { peopleText } from './copy'

export interface SummaryBooking {
  providerName: string
  zone: TimeZone
  specialistName: string
  consultation: Consultation
  date: CalendarDate
  start: WallTime
  people: number
}

interface BookingSummaryProps {
  booking: SummaryBooking
  customerZone: TimeZone
  now: number
  /** "Booking ref BK-…" and similar, shown first */
  reference?: string
  className?: string
}

/**
 * One booking, with the provider's time first and the customer's own time
 * under it, each labelled with its city, so neither can be mistaken for the
 * other.
 */
export function BookingSummary({ booking, customerZone, now, reference, className }: BookingSummaryProps) {
  const { providerName, zone, specialistName, consultation, date, start, people } = booking
  const end = bookingEnd(consultation, start, people)
  const showCustomer = !sameClock(zone, customerZone, now)
  const customerStart = customerTimeOf(zone, date, start, customerZone)
  const customerEnd = customerTimeOf(zone, date, end, customerZone)
  const step = slotStep(consultation)

  return (
    <dl className={cn('grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]', className)}>
      {reference && (
        <>
          <dt className="text-muted-foreground">Booking ref</dt>
          <dd className="font-mono">{reference}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Where</dt>
      <dd>
        {providerName}, with {specialistName}
      </dd>

      <dt className="text-muted-foreground">When, in {zoneCity(zone)}</dt>
      <dd>
        <span className="block text-base font-semibold">{formatDate(date, 'long')}</span>
        <span className="block text-base font-semibold tabular-nums">
          {formatTime(start)} – {formatTime(end)} {zoneCity(zone)} time
        </span>
      </dd>

      {showCustomer && (
        <>
          <dt className="text-muted-foreground">Your time ({zoneCity(customerZone)})</dt>
          <dd className="tabular-nums text-muted-foreground">
            {customerStart.date !== date && `${formatDate(customerStart.date, 'long')}, `}
            {formatTime(customerStart.time)} – {formatTime(customerEnd.time)}
            {customerEnd.date !== customerStart.date && ` (${formatDate(customerEnd.date)})`}
          </dd>
        </>
      )}

      <dt className="text-muted-foreground">Who</dt>
      <dd>
        {peopleText(people)}
        {people > 1 && (
          <span className="block text-muted-foreground">
            {people} appointments back to back, starting at{' '}
            {Array.from({ length: people }, (_, i) => formatTime(start + i * step)).join(', ')}
          </span>
        )}
      </dd>
    </dl>
  )
}
