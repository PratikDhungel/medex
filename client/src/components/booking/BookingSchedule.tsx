import { useQuery } from '@tanstack/react-query'
import type { CalendarDate } from '@shared/time/calendarDate'
import { todayIn, type TimeZone } from '@shared/time/zone'
import type { ReactNode } from 'react'
import { availabilityQuery } from '@/api/booking'
import type { BookingProvider, Specialist } from '@/domain/booking/model'
import type { BookingSelection } from '@/domain/booking/selection'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf } from '@/hooks/loadStatus'
import { ScheduleView } from './ScheduleView'

const SLOW_AFTER_MS = 3000

interface BookingScheduleProps {
  provider: BookingProvider & { zone: TimeZone }
  specialist: Specialist
  customerZone: TimeZone
  now: number
  selection: BookingSelection
  onChoose: (change: Partial<BookingSelection>) => void
  /** While rescheduling, that booking's own slots count as free */
  rescheduling?: string
  renderTimes?: (date: CalendarDate) => ReactNode
}

/** Loads the specialist's 90 days for the group size and shows the calendar */
export function BookingSchedule({ provider, specialist, customerZone, now, selection, onChoose, rescheduling, renderTimes }: BookingScheduleProps) {
  const query = useQuery(
    availabilityQuery({
      providerId: provider.id,
      specialistId: specialist.id,
      numberOfPeople: selection.people,
      rescheduling,
      asOf: todayIn(provider.zone, now),
    }),
  )
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  if (!specialist.consultation) return null

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
      specialist={{ ...specialist, consultation: specialist.consultation }}
      otherSpecialists={provider.specialists.filter((s) => s.id !== specialist.id && s.consultation !== null)}
      selection={selection}
      onChoose={onChoose}
      renderTimes={renderTimes}
    />
  )
}
