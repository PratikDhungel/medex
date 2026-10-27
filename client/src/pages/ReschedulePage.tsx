import { useQuery } from '@tanstack/react-query'
import { CalendarX, CloudOff, SearchX, WifiOff } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { todayIn, type TimeZone } from '@shared/time/zone'
import { bookingProviderQuery, bookingQuery, rescheduleBooking } from '@/api/booking'
import { ApiError } from '@/api/client'
import { failureMessage } from '@/api/failureMessage'
import { BookingSchedule } from '@/components/booking/BookingSchedule'
import { BookingSummary, type SummaryBooking } from '@/components/booking/BookingSummary'
import { MoveReview } from '@/components/booking/MoveReview'
import { PendingBooking } from '@/components/booking/PendingBooking'
import { ZoneLegend } from '@/components/booking/ZoneLegend'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Booking, BookingProvider, Specialist } from '@/domain/booking/model'
import type { Attempt, BookingRequest } from '@/domain/booking/submission'
import { useBookingSelection } from '@/hooks/useBookingSelection'
import { useBookingSubmission } from '@/hooks/useBookingSubmission'
import { useCustomerZone } from '@/hooks/useCustomerZone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf, type LoadStatus } from '@/hooks/loadStatus'
import { useNow } from '@/hooks/useNow'
import { useOnline } from '@/hooks/useOnline'
import { PageHeading } from './PageHeading'

const SLOW_AFTER_MS = 3000

/** Choosing a new time for an existing booking, with the same specialist and group */
export function ReschedulePage() {
  const bookingId = useParams().bookingId ?? ''
  useDocumentTitle('Change your booking')
  const booking = useQuery(bookingQuery(bookingId))
  const provider = useQuery({ ...bookingProviderQuery(booking.data?.providerId ?? 0), enabled: booking.data !== undefined })
  const bookingStatus = loadStatusOf(booking)
  const status: LoadStatus = bookingStatus.kind === 'ready' ? loadStatusOf(provider) : bookingStatus

  return (
    <div className="space-y-6">
      <PageHeading title="Change your booking">
        {booking.data ? `Booking ref ${booking.data.bookingId}. Choose a new date and time; everything else stays the same.` : undefined}
      </PageHeading>
      {status.kind === 'loading' && <Skeleton aria-label="Loading your booking" className="h-64 rounded-xl" />}
      {status.kind === 'offline' && (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Your booking will load as soon as you're back online.
        </StatePanel>
      )}
      {status.kind === 'error' &&
        (status.error instanceof ApiError && status.error.status === 404 ? (
          <StatePanel icon={SearchX} title="We couldn't find this booking">
            Please check the booking reference.
          </StatePanel>
        ) : (
          <StatePanel
            icon={CloudOff}
            title={failureMessage([status.error], 'your booking').title}
            tone="error"
            role="alert"
            action={
              <RetryButton
                retrying={booking.isFetching || provider.isFetching}
                onRetry={() => void (booking.isError ? booking.refetch() : provider.refetch())}
              />
            }
          >
            {failureMessage([status.error], 'your booking').body}
          </StatePanel>
        ))}
      {status.kind === 'ready' && booking.data && provider.data && <Reschedule booking={booking.data} provider={provider.data} />}
    </div>
  )
}

function Reschedule({ booking, provider }: { booking: Booking; provider: BookingProvider }) {
  const customerZone = useCustomerZone()
  const now = useNow()
  const specialist = provider.specialists.find((s) => s.id === booking.specialistId)
  const zone = provider.zone

  if (!zone || !specialist?.consultation) {
    return (
      <StatePanel icon={CalendarX} title="This booking can't be changed online" action={<BackToBooking id={booking.bookingId} />}>
        Please contact {provider.name} to change it.
      </StatePanel>
    )
  }
  if (booking.date < todayIn(zone, now)) {
    return (
      <StatePanel icon={CalendarX} title="This appointment has already passed" action={<BackToBooking id={booking.bookingId} />}>
        Only upcoming appointments can be changed.
      </StatePanel>
    )
  }
  return <RescheduleForm booking={booking} provider={{ ...provider, zone }} specialist={specialist} customerZone={customerZone} now={now} />
}

function BackToBooking({ id }: { id: string }) {
  return (
    <Button asChild variant="outline">
      <Link to={`/bookings/${encodeURIComponent(id)}`}>Back to your booking</Link>
    </Button>
  )
}

interface RescheduleFormProps {
  booking: Booking
  provider: BookingProvider & { zone: TimeZone }
  specialist: Specialist
  customerZone: TimeZone
  now: number
}

function RescheduleForm({ booking, provider, specialist, customerZone, now }: RescheduleFormProps) {
  const navigate = useNavigate()
  const online = useOnline()
  const [urlSelection, choose] = useBookingSelection()
  // The specialist and group are the booking's; the calendar opens on its current day
  const selection = {
    ...urlSelection,
    specialistId: specialist.id,
    people: booking.numberOfPeople,
    date: urlSelection.date ?? booking.date,
  }

  const send = useCallback(
    async ({ request }: Attempt, signal: AbortSignal) => (await rescheduleBooking(booking.bookingId, request.date, request.start, signal)).bookingId,
    [booking.bookingId],
  )
  const submission = useBookingSubmission(provider.id, { send, storageKey: `medex.booking.reschedule.${booking.bookingId}` })
  const { state, dismiss } = submission
  const slow = useElapsed(state.kind === 'submitting', SLOW_AFTER_MS)

  useEffect(() => {
    if (state.kind === 'booked') {
      navigate(`/bookings/${encodeURIComponent(state.bookingId)}`, {
        state: { movedFrom: { date: booking.date, start: booking.start } },
      })
    }
  }, [state, navigate, booking.date, booking.start])

  const settledFor = state.kind === 'conflict' || state.kind === 'failed' ? state.request : null
  useEffect(() => {
    if (settledFor && (selection.date !== settledFor.date || selection.time !== settledFor.start)) dismiss()
  }, [settledFor, selection.date, selection.time, dismiss])

  const summary = (date: string, start: number): SummaryBooking => ({
    providerName: provider.name,
    zone: provider.zone,
    specialistName: specialist.name,
    consultation: specialist.consultation!,
    date,
    start,
    people: booking.numberOfPeople,
  })
  const current = summary(booking.date, booking.start)
  const request: BookingRequest | null =
    selection.time !== null
      ? { providerId: provider.id, specialistId: specialist.id, date: selection.date, start: selection.time, numberOfPeople: booking.numberOfPeople }
      : null
  const pending = state.kind === 'unknown' || (state.kind === 'submitting' && state.resend) ? state : null

  return (
    <div className="space-y-8">
      {pending && (
        <PendingBooking
          state={pending}
          booking={summary(pending.attempt.request.date, pending.attempt.request.start)}
          online={online}
          customerZone={customerZone}
          now={now}
          onCheck={submission.resend}
        />
      )}
      <ZoneLegend provider={provider.zone} customer={customerZone} now={now} />

      <div inert={pending !== null} className={pending ? 'space-y-8 opacity-50' : 'space-y-8'}>
        <section aria-labelledby="current-title" className="space-y-3 rounded-xl border bg-muted/30 px-4 py-4">
          <h2 id="current-title" className="font-accent text-lg font-semibold">
            Your booking now
          </h2>
          <BookingSummary booking={current} customerZone={customerZone} now={now} reference={booking.bookingId} />
        </section>

        <BookingSchedule
          provider={provider}
          specialist={specialist}
          customerZone={customerZone}
          now={now}
          selection={selection}
          onChoose={(change) => choose({ date: change.date ?? selection.date, time: change.time ?? null })}
          rescheduling={booking}
          chosenNotice={state.kind === 'idle' || state.kind === 'failed'}
          review={
            request && (
              <MoveReview
                from={current}
                to={summary(request.date, request.start)}
                state={state}
                online={online}
                slow={slow}
                customerZone={customerZone}
                now={now}
                onConfirm={() => submission.submit(request)}
                onPickAlternative={(choice) => choose({ date: choice.date, time: choice.start })}
              />
            )
          }
        />
      </div>
    </div>
  )
}
