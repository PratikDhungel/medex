import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { TimeZone } from '@shared/time/zone'
import { bookingProviderQuery } from '@/api/booking'
import { BookingSchedule } from '@/components/booking/BookingSchedule'
import type { SummaryBooking } from '@/components/booking/BookingSummary'
import { BookingView } from '@/components/booking/BookingView'
import { countryName } from '@/components/booking/copy'
import { PendingBooking } from '@/components/booking/PendingBooking'
import { ReviewPanel } from '@/components/booking/ReviewPanel'
import type { BookingProvider } from '@/domain/booking/model'
import { selectedSpecialist } from '@/domain/booking/selection'
import type { BookingRequest } from '@/domain/booking/submission'
import { useBookingSelection } from '@/hooks/useBookingSelection'
import { useBookingSubmission } from '@/hooks/useBookingSubmission'
import { useCustomerZone } from '@/hooks/useCustomerZone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf } from '@/hooks/loadStatus'
import { useNow } from '@/hooks/useNow'
import { useOnline } from '@/hooks/useOnline'
import { NotFoundPage } from './NotFoundPage'
import { PageHeading } from './PageHeading'

const SLOW_AFTER_MS = 3000

export function BookingPage() {
  const providerId = Number(useParams().providerId)
  return Number.isInteger(providerId) ? <ProviderBookingPage providerId={providerId} /> : <NotFoundPage />
}

/** A request as a summary, using the provider's details for names and hours */
function summaryOf(provider: BookingProvider & { zone: TimeZone }, request: BookingRequest): SummaryBooking | null {
  const specialist = provider.specialists.find((s) => s.id === request.specialistId)
  if (!specialist?.consultation) return null
  return {
    providerName: provider.name,
    zone: provider.zone,
    specialistName: specialist.name,
    consultation: specialist.consultation,
    date: request.date,
    start: request.start,
    people: request.numberOfPeople,
  }
}

function ProviderBookingPage({ providerId }: { providerId: number }) {
  const query = useQuery(bookingProviderQuery(providerId))
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)
  const customerZone = useCustomerZone()
  const now = useNow()
  const online = useOnline()
  const navigate = useNavigate()
  const [selection, choose] = useBookingSelection()
  const submission = useBookingSubmission(providerId)
  const { state } = submission
  const submittingSlow = useElapsed(state.kind === 'submitting', SLOW_AFTER_MS)

  const provider = query.data
  const { specialist, stale } = selectedSpecialist(provider?.specialists ?? [], selection.specialistId)
  useDocumentTitle(provider ? `Book at ${provider.name}` : 'Book an appointment')

  useEffect(() => {
    if (state.kind === 'booked') navigate(`/bookings/${encodeURIComponent(state.bookingId)}`, { state: { justBooked: true } })
  }, [state, navigate])

  // A conflict or failure is about the time it was for; choosing another time puts it away
  const { dismiss } = submission
  const settledFor = state.kind === 'conflict' || state.kind === 'failed' ? state.request : null
  useEffect(() => {
    if (settledFor && (selection.date !== settledFor.date || selection.time !== settledFor.start)) dismiss()
  }, [settledFor, selection.date, selection.time, dismiss])

  const zoned = provider?.zone ? { ...provider, zone: provider.zone } : null
  const request: BookingRequest | null =
    zoned && specialist && selection.date && selection.time !== null
      ? { providerId, specialistId: specialist.id, date: selection.date, start: selection.time, numberOfPeople: selection.people }
      : null

  const reviewBooking = zoned && request ? summaryOf(zoned, request) : null

  // The first try shows in the review; a try whose result we lost takes over the page
  const pending = state.kind === 'unknown' || (state.kind === 'submitting' && state.resend) ? state : null

  return (
    <div className="space-y-6">
      <PageHeading title={provider?.name ?? 'Book an appointment'}>{countryName(provider?.country ?? null)}</PageHeading>
      <BookingView
        status={status}
        provider={provider}
        customerZone={customerZone}
        now={now}
        slow={slow}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        selection={selection}
        specialist={specialist}
        staleSpecialist={stale}
        onChoose={choose}
        locked={pending !== null}
        notice={
          pending &&
          zoned && (
            <PendingBooking
              state={pending}
              booking={summaryOf(zoned, pending.attempt.request)}
              online={online}
              customerZone={customerZone}
              now={now}
              onCheck={submission.resend}
            />
          )
        }
      >
        {zoned && specialist && (
          <BookingSchedule
            // A new specialist starts from their own first available date
            key={specialist.id}
            provider={zoned}
            specialist={specialist}
            customerZone={customerZone}
            now={now}
            selection={selection}
            onChoose={choose}
            // Only when nothing else explains it: after a conflict the panel says the time was taken, and while
            // a booking is in flight or unknown, a "taken" time is most likely the customer's own
            chosenNotice={state.kind === 'idle' || state.kind === 'failed'}
            review={
              request &&
              reviewBooking && (
                <ReviewPanel
                  booking={reviewBooking}
                  state={state}
                  online={online}
                  slow={submittingSlow}
                  customerZone={customerZone}
                  now={now}
                  onConfirm={() => submission.submit(request)}
                  onPickAlternative={(choice) => choose({ date: choice.date, time: choice.start })}
                />
              )
            }
          />
        )}
      </BookingView>
    </div>
  )
}
