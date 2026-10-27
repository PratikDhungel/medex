import { useQuery } from '@tanstack/react-query'
import { CloudOff, TriangleAlert, WifiOff } from 'lucide-react'
import type { CalendarDate } from '@shared/time/calendarDate'
import type { WallTime } from '@shared/time/wallTime'
import { zonedDateTimeAt, type TimeZone } from '@shared/time/zone'
import { daySlotsQuery } from '@/api/booking'
import { failureMessage } from '@/api/failureMessage'
import { RetryButton } from '@/components/common/RetryButton'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime, sameClock, zoneCity } from '@/domain/booking/clock'
import type { BookingProvider, Specialist } from '@/domain/booking/model'
import { hoursLimitOn, slotViews, type SlotView } from '@/domain/booking/slotView'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf, type LoadStatus } from '@/hooks/loadStatus'
import { availableText, hoursNote } from './slotCopy'
import { SlotPicker, SlotPickerSkeleton } from './SlotPicker'

/** Other customers book while this page is open; check for that this often */
const REFRESH_MS = 30_000
const SLOW_AFTER_MS = 3000

type BookableSpecialist = Specialist & { consultation: NonNullable<Specialist['consultation']> }

export interface DayTimesProps {
  provider: BookingProvider & { zone: TimeZone }
  specialist: BookableSpecialist
  date: CalendarDate
  people: number
  selected: WallTime | null
  onSelect: (time: WallTime) => void
  customerZone: TimeZone
  now: number
  /** The next bookable date after this one, for when this day has nothing left */
  nextAvailable: CalendarDate | null
  onChooseDate: (date: CalendarDate) => void
  /** While rescheduling: the booking, and the start times it holds on this date */
  rescheduling?: { bookingId: string; ownStarts: ReadonlySet<WallTime> }
}

/** Loads the chosen day's times and keeps them fresh */
export function DayTimes(props: DayTimesProps) {
  const { provider, specialist, date, rescheduling } = props
  const query = useQuery({
    ...daySlotsQuery({ providerId: provider.id, specialistId: specialist.id, date, rescheduling: rescheduling?.bookingId }),
    refetchInterval: REFRESH_MS,
  })
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  const views = query.data
    ? slotViews(query.data.slots, {
        date,
        zone: provider.zone,
        customerZone: props.customerZone,
        consultation: specialist.consultation,
        people: props.people,
        nowMs: props.now,
        ownStarts: rescheduling?.ownStarts,
      })
    : []

  return <DayTimesView {...props} status={status} views={views} slow={slow} retrying={query.isFetching} onRetry={() => void query.refetch()} />
}

export interface DayTimesViewProps extends DayTimesProps {
  status: LoadStatus
  views: SlotView[]
  slow: boolean
  retrying: boolean
  onRetry: () => void
}

export function DayTimesView(props: DayTimesViewProps) {
  const { status, slow, retrying, onRetry } = props

  switch (status.kind) {
    case 'loading':
      return (
        <div aria-busy className="space-y-2">
          <p role="status" className="text-sm text-muted-foreground">
            {slow ? 'Still loading times. This is taking longer than usual.' : 'Loading times…'}
          </p>
          <SlotPickerSkeleton />
        </div>
      )
    case 'offline':
      return (
        <p role="status" className="flex items-start gap-2 rounded-lg border px-3 py-3 text-sm">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          You're offline. The times will load as soon as you're back online.
        </p>
      )
    case 'error': {
      const message = failureMessage([status.error], 'the times for this day')
      return (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
          <p className="flex items-start gap-2">
            <CloudOff aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              <strong>{message.title}.</strong> {message.body} Your choices are kept.
            </span>
          </p>
          <RetryButton retrying={retrying} onRetry={onRetry} variant="outline" />
        </div>
      )
    }
    case 'ready':
      return (
        <>
          {status.refreshFailed && (
            <p className="flex items-start gap-2 text-sm text-amber-700">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              We couldn't check for new bookings just now, so these times may be out of date.
            </p>
          )}
          <Times {...props} />
        </>
      )
  }
}

function Times({ provider, specialist, date, people, selected, onSelect, customerZone, now, views, nextAvailable, onChooseDate }: DayTimesViewProps) {
  const available = views.filter((view) => view.state === 'available')
  const chosen = selected === null ? undefined : views.find((view) => view.start === selected)
  const note = hoursNote(hoursLimitOn(date, provider.schedule, specialist.consultation), date, {
    providerName: provider.name,
    specialistName: specialist.name,
    consultation: specialist.consultation,
    firstStart: views[0]?.start ?? null,
    lastStart: views.at(-1)?.start ?? null,
  })

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {available.length > 0 ? `${availableText(views, people)}.` : ''}
      </p>

      {chosen && chosen.state !== 'available' && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
          {chosen.state === 'booked'
            ? `Someone has just booked ${formatTime(chosen.start)}. Please choose another time.`
            : chosen.state === 'started'
              ? `${formatTime(chosen.start)} has started. Please choose a later time.`
              : `${formatTime(chosen.start)} no longer has room for ${people} people in a row. Please choose another time.`}
        </p>
      )}
      {selected !== null && !chosen && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
          {formatTime(selected)} isn't offered on this day. Please choose one of the times below.
        </p>
      )}

      {available.length === 0 && (
        <div className="space-y-3 rounded-lg border px-4 py-4 text-sm">
          <p>{nothingLeftText(views, people, provider.zone, now)}</p>
          {nextAvailable && <Button onClick={() => onChooseDate(nextAvailable)}>Next available: {formatDate(nextAvailable)}</Button>}
        </div>
      )}

      {views.length > 0 && (
        <SlotPicker
          date={date}
          views={views}
          selected={selected}
          onSelect={onSelect}
          people={people}
          providerCity={zoneCity(provider.zone)}
          customerCity={sameClock(provider.zone, customerZone, now) ? null : zoneCity(customerZone)}
          hoursNote={note}
        />
      )}
    </div>
  )
}

/** Why a day the calendar offered has nothing to choose now, most specific first */
function nothingLeftText(views: SlotView[], people: number, zone: TimeZone, now: number): string {
  if (views.length === 0) return 'There are no times on this day.'
  if (views.some((view) => view.state === 'no-room')) {
    return `There aren't ${people} times in a row free on this day any more. Try another day, or fewer people.`
  }
  if (views.some((view) => view.state === 'started')) {
    return `There are no times left today. It's ${formatTime(zonedDateTimeAt(zone, now).time)} in ${zoneCity(zone)}.`
  }
  return 'Every time on this day has just been booked.'
}
