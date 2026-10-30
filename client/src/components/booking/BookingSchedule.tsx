import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { slotStep } from '@shared/booking/slots'
import { todayIn, type TimeZone } from '@shared/time/zone'
import { availabilityQuery } from '@/api/booking'
import type { Booking, BookingProvider, Specialist } from '@/domain/booking/model'
import type { BookingSelection } from '@/domain/booking/selection'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf } from '@/hooks/loadStatus'
import { DayTimes } from './DayTimes'
import { ScheduleView } from './ScheduleView'

const SLOW_AFTER_MS = 3000

interface BookingScheduleProps {
  provider: BookingProvider & { zone: TimeZone }
  specialist: Specialist
  customerZone: TimeZone
  now: number
  selection: BookingSelection
  onChoose: (change: Partial<BookingSelection>) => void
  /** The booking being rescheduled: its own slots count as free for it, and its specialist and group can't change */
  rescheduling?: Booking
  /** Shown under the times once one is chosen: the review and confirm step */
  review?: ReactNode
  /** Whether the times say so when the chosen one has gone; off when something else already does */
  chosenNotice?: boolean
}

/** Loads the specialist's 90 days for the group size and shows the calendar */
export function BookingSchedule({ provider, specialist, customerZone, now, selection, onChoose, rescheduling, review, chosenNotice }: BookingScheduleProps) {
  const query = useQuery(
    availabilityQuery({
      providerId: provider.id,
      specialistId: specialist.id,
      numberOfPeople: selection.people,
      rescheduling: rescheduling?.bookingId,
      asOf: todayIn(provider.zone, now),
    }),
  )
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  const { consultation } = specialist
  if (!consultation) return null

  return (
    <ScheduleView
      status={status}
      availability={query.data}
      slow={slow}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
      providerName={provider.name}
      zone={provider.zone}
      customerZone={customerZone}
      now={now}
      specialist={{ ...specialist, consultation }}
      otherSpecialists={rescheduling ? [] : provider.specialists.filter((s) => s.id !== specialist.id && s.consultation !== null)}
      groupFixed={rescheduling !== undefined}
      selection={selection}
      onChoose={onChoose}
      renderTimes={(date, nextAvailable) => (
        <>
          <DayTimes
            provider={provider}
            specialist={{ ...specialist, consultation }}
            date={date}
            people={selection.people}
            selected={selection.date === date ? selection.time : null}
            onSelect={(time) => onChoose({ date, time })}
            customerZone={customerZone}
            now={now}
            nextAvailable={nextAvailable}
            onChooseDate={(next) => onChoose({ date: next })}
            rescheduling={
              rescheduling && {
                bookingId: rescheduling.bookingId,
                // One slot per person, one after another
                ownStarts: new Set(
                  rescheduling.date === date
                    ? Array.from({ length: rescheduling.numberOfPeople }, (_, i) => rescheduling.start + i * slotStep(consultation))
                    : [],
                ),
                currentStart: rescheduling.date === date ? rescheduling.start : undefined,
              }
            }
            chosenNotice={chosenNotice}
          />
          {selection.date === date && selection.time !== null && review}
        </>
      )}
    />
  )
}
