import { CalendarSearch, CloudOff, TriangleAlert, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CalendarDate } from '@shared/time/calendarDate'
import { zonedDateTimeAt, type TimeZone } from '@shared/time/zone'
import { failureMessage } from '@/api/failureMessage'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { bookingWindow, dayStatusOn, nextAvailableDate, previousAvailableDate } from '@/domain/booking/calendar'
import { formatDate, zoneCity } from '@/domain/booking/clock'
import type { Availability, DayAvailability, Specialist } from '@/domain/booking/model'
import type { BookingSelection } from '@/domain/booking/selection'
import type { LoadStatus } from '@/hooks/loadStatus'
import { BookingCalendar, BookingCalendarSkeleton, CalendarLegend } from './BookingCalendar'
import { peopleText } from './copy'
import { dayReason } from './dayCopy'

export interface ScheduleViewProps {
  status: LoadStatus
  availability: Availability | undefined
  slow: boolean
  retrying: boolean
  onRetry: () => void
  providerName: string
  zone: TimeZone
  customerZone: TimeZone
  now: number
  specialist: Specialist & { consultation: NonNullable<Specialist['consultation']> }
  /** Other bookable specialists at the provider, offered when this one has no times */
  otherSpecialists: Specialist[]
  /** The group size can't be changed (rescheduling), so don't suggest fewer people */
  groupFixed?: boolean
  selection: BookingSelection
  onChoose: (change: Partial<BookingSelection>) => void
  /** The times for an available selected date; `nextAvailable` is for when they've all gone since */
  renderTimes?: (date: CalendarDate, nextAvailable: CalendarDate | null) => ReactNode
}

/** "Choose a date": the calendar, and the panel for the chosen day */
export function ScheduleView(props: ScheduleViewProps) {
  const { zone, customerZone, now } = props
  const providerToday = zonedDateTimeAt(zone, now).date
  const customerToday = zonedDateTimeAt(customerZone, now).date

  return (
    <section aria-labelledby="schedule-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="schedule-title" className="font-accent text-lg font-semibold">
          Choose a date
        </h2>
        <p className="text-sm text-muted-foreground">
          Dates follow the calendar in {zoneCity(zone)}.
          {providerToday !== customerToday &&
            ` It's ${providerToday > customerToday ? 'already' : 'still'} ${formatDate(providerToday, 'long')} there.`}
        </p>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {props.status.kind === 'loading' ? (props.slow ? 'Still loading dates. This is taking longer than usual.' : 'Loading dates…') : ''}
      </p>
      <ScheduleBody {...props} providerToday={providerToday} />
    </section>
  )
}

function ScheduleBody(props: ScheduleViewProps & { providerToday: CalendarDate }) {
  const { status, availability, slow, retrying, onRetry } = props

  switch (status.kind) {
    case 'loading':
      return (
        <div aria-busy className="space-y-3">
          {slow && <p className="text-sm text-muted-foreground">Still loading dates. This is taking longer than usual.</p>}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
            <BookingCalendarSkeleton />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      )
    case 'offline':
      return (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Dates will load as soon as you're back online. Your choices are kept.
        </StatePanel>
      )
    case 'error': {
      const message = failureMessage([status.error], 'the available dates')
      return (
        <StatePanel icon={CloudOff} title={message.title} tone="error" role="alert" action={<RetryButton retrying={retrying} onRetry={onRetry} />}>
          {message.body} Your choices are kept.
        </StatePanel>
      )
    }
    case 'ready':
      return availability ? (
        <>
          {status.refreshFailed && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-3">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
                We couldn't refresh the dates, so they may be out of date.
              </p>
              <RetryButton retrying={retrying} onRetry={onRetry} variant="outline" />
            </div>
          )}
          <Schedule {...props} availability={availability} />
        </>
      ) : null
  }
}

function Schedule({
  availability,
  providerToday,
  providerName,
  zone,
  now,
  specialist,
  otherSpecialists,
  groupFixed = false,
  selection,
  onChoose,
  renderTimes,
}: ScheduleViewProps & { availability: Availability; providerToday: CalendarDate }) {
  const window = bookingWindow(providerToday)
  const byDate = new Map(availability.days.map((day) => [day.date, day]))
  const reasonFor = (day: DayAvailability) =>
    dayReason(day, {
      providerName,
      specialistName: specialist.name,
      consultation: specialist.consultation,
      people: selection.people,
      city: zoneCity(zone),
      providerTimeNow: zonedDateTimeAt(zone, now).time,
    })
  const firstAvailable = nextAvailableDate(availability.days, null, providerToday)

  return (
    <div className="space-y-4">
      {!firstAvailable && (
        <NoAvailability
          specialist={specialist}
          otherSpecialists={otherSpecialists}
          people={selection.people}
          groupFixed={groupFixed}
          onChoose={onChoose}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-3">
          <BookingCalendar
            days={availability.days}
            providerToday={providerToday}
            selected={selection.date}
            onSelect={(date) => onChoose({ date })}
            reasonFor={reasonFor}
            city={zoneCity(zone)}
          />
          <CalendarLegend />
        </div>
        <DayPanel
          day={selection.date ? dayStatusOn(selection.date, byDate, providerToday, window) : null}
          reason={reasonFor}
          firstAvailable={firstAvailable}
          nearby={(date) => ({
            before: previousAvailableDate(availability.days, date, providerToday),
            after: nextAvailableDate(availability.days, date, providerToday),
          })}
          onChooseDate={(date) => onChoose({ date })}
          renderTimes={renderTimes}
        />
      </div>
    </div>
  )
}

interface NoAvailabilityProps {
  specialist: Specialist
  otherSpecialists: Specialist[]
  people: number
  groupFixed: boolean
  onChoose: (change: Partial<BookingSelection>) => void
}

/** No bookable day in the whole window: say so plainly and offer the ways forward */
function NoAvailability({ specialist, otherSpecialists, people, groupFixed, onChoose }: NoAvailabilityProps) {
  return (
    <StatePanel
      icon={CalendarSearch}
      title={
        people > 1
          ? `${specialist.name} has no ${people} times in a row free in the next 90 days`
          : `${specialist.name} has no free times in the next 90 days`
      }
      role="status"
      action={
        <>
          {people > 1 && !groupFixed && (
            <Button variant="outline" onClick={() => onChoose({ people: 1 })}>
              Look for 1 person instead
            </Button>
          )}
          {otherSpecialists.map((other) => (
            <Button key={other.id} variant="outline" onClick={() => onChoose({ specialistId: other.id })}>
              See {other.name}'s times
            </Button>
          ))}
        </>
      }
    >
      {people > 1
        ? `Booking for ${peopleText(people)} needs ${people} appointments one after another with the same specialist.`
        : otherSpecialists.length > 0
          ? 'Another specialist here may be able to see you sooner.'
          : 'Bookings open 90 days ahead, so new times appear each day.'}
    </StatePanel>
  )
}

interface DayPanelProps {
  day: DayAvailability | null
  reason: (day: DayAvailability) => string
  firstAvailable: CalendarDate | null
  nearby: (date: CalendarDate) => { before: CalendarDate | null; after: CalendarDate | null }
  onChooseDate: (date: CalendarDate) => void
  renderTimes?: (date: CalendarDate, nextAvailable: CalendarDate | null) => ReactNode
}

/** The chosen day: its times, or why it can't be booked and the nearest days that can */
function DayPanel({ day, reason, firstAvailable, nearby, onChooseDate, renderTimes }: DayPanelProps) {
  if (!day) {
    return (
      <div className="flex flex-col items-start gap-3 self-start rounded-xl border border-dashed px-4 py-6 text-sm">
        <p className="text-muted-foreground">Choose a date to see the times.</p>
        {firstAvailable && (
          <Button variant="outline" onClick={() => onChooseDate(firstAvailable)}>
            First available: {formatDate(firstAvailable)}
          </Button>
        )}
      </div>
    )
  }

  if (day.status === 'available') {
    return (
      <div className="space-y-3 self-start">
        <h3 className="font-accent font-semibold">{formatDate(day.date, 'long')}</h3>
        {renderTimes?.(day.date, nearby(day.date).after)}
      </div>
    )
  }

  const { before, after } = nearby(day.date)
  return (
    <div aria-live="polite" className="space-y-3 self-start rounded-xl border px-4 py-4">
      <h3 className="font-accent font-semibold">{formatDate(day.date, 'long')}</h3>
      <p>{reason(day)}</p>
      {(before || after) && (
        <div className="flex flex-wrap gap-2">
          {after && (
            <Button onClick={() => onChooseDate(after)}>Next available: {formatDate(after)}</Button>
          )}
          {before && (
            <Button variant="outline" onClick={() => onChooseDate(before)}>
              Earlier: {formatDate(before)}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
