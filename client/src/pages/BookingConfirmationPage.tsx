import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CloudOff, SearchX, WifiOff } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import { bookingProviderQuery, bookingQuery } from '@/api/booking'
import { ApiError } from '@/api/client'
import { failureMessage } from '@/api/failureMessage'
import { BookingSummary } from '@/components/booking/BookingSummary'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomerZone } from '@/hooks/useCustomerZone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { loadStatusOf, type LoadStatus } from '@/hooks/loadStatus'
import { useNow } from '@/hooks/useNow'
import { PageHeading } from './PageHeading'

/** A booking, read back from the server: after booking, or from a link */
export function BookingConfirmationPage() {
  const bookingId = useParams().bookingId ?? ''
  const justBooked = (useLocation().state as { justBooked?: boolean } | null)?.justBooked === true
  const customerZone = useCustomerZone()
  const now = useNow()

  const booking = useQuery(bookingQuery(bookingId))
  const provider = useQuery({ ...bookingProviderQuery(booking.data?.providerId ?? 0), enabled: booking.data !== undefined })
  const bookingStatus = loadStatusOf(booking)
  const status: LoadStatus = bookingStatus.kind === 'ready' ? loadStatusOf(provider) : bookingStatus
  const retry = () => void (booking.isError ? booking.refetch() : provider.refetch())

  const title = justBooked ? "You're booked" : 'Your booking'
  useDocumentTitle(title)

  const specialist = provider.data?.specialists.find((s) => s.id === booking.data?.specialistId)
  const zone = provider.data?.zone

  return (
    <div className="space-y-6">
      <PageHeading title={title}>
        {justBooked ? 'We have your appointment. The provider will expect you at the time below, their time.' : undefined}
      </PageHeading>

      {status.kind === 'loading' && <Skeleton aria-label="Loading your booking" className="h-56 rounded-xl" />}
      {status.kind === 'offline' && (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Your booking will show as soon as you're back online.
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
            action={<RetryButton retrying={booking.isFetching || provider.isFetching} onRetry={retry} />}
          >
            {failureMessage([status.error], 'your booking').body}
          </StatePanel>
        ))}

      {status.kind === 'ready' && booking.data && provider.data && (
        <section className="space-y-4 rounded-xl border px-4 py-5 sm:px-6">
          {justBooked && (
            <p role="status" className="flex items-center gap-2 font-medium text-emerald-700">
              <CircleCheck aria-hidden className="size-5" />
              Booking confirmed
            </p>
          )}
          {zone && specialist?.consultation ? (
            <BookingSummary
              reference={booking.data.bookingId}
              customerZone={customerZone}
              now={now}
              booking={{
                providerName: provider.data.name,
                zone,
                specialistName: specialist.name,
                consultation: specialist.consultation,
                date: booking.data.date,
                start: booking.data.start,
                people: booking.data.numberOfPeople,
              }}
            />
          ) : (
            <p className="text-sm">
              Booking ref <span className="font-mono">{booking.data.bookingId}</span> at {provider.data.name}. We can't show its
              time right now; please contact the provider.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/book">Book another appointment</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
