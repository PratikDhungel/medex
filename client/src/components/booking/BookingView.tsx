import { CalendarX, CloudOff, SearchX, Users, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { TimeZone } from '@shared/time/zone'
import { ApiError } from '@/api/client'
import { failureMessage } from '@/api/failureMessage'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { BookingProvider, Specialist } from '@/domain/booking/model'
import type { BookingSelection } from '@/domain/booking/selection'
import type { LoadStatus } from '@/hooks/loadStatus'
import { consultationText, zoneTimeLabel } from './copy'
import { PeoplePicker } from './PeoplePicker'
import { SpecialistPicker, SpecialistPickerSkeleton } from './SpecialistPicker'
import { ZoneLegend, ZoneLegendSkeleton } from './ZoneLegend'

export interface BookingViewProps {
  status: LoadStatus
  provider: BookingProvider | undefined
  customerZone: TimeZone
  now: number
  /** The first load has taken longer than usual */
  slow: boolean
  retrying: boolean
  onRetry: () => void
  selection: BookingSelection
  /** The specialist being booked: chosen, or the only one */
  specialist: Specialist | null
  /** The URL named a specialist who can't be booked */
  staleSpecialist: boolean
  onChoose: (change: Partial<BookingSelection>) => void
  /** The calendar and times for the chosen specialist */
  children?: ReactNode
}

const otherProviders = (
  <Button asChild variant="outline">
    <Link to="/book">See other providers</Link>
  </Button>
)

function statusText({ status, slow, provider }: BookingViewProps): string {
  if (status.kind === 'loading') {
    return slow ? 'Still loading. This is taking longer than usual.' : 'Loading the provider…'
  }
  return status.kind === 'ready' && provider ? `Booking at ${provider.name}` : ''
}

/** The booking page around the calendar: the provider, both clocks, the specialist and the group size */
export function BookingView(props: BookingViewProps) {
  return (
    <div className="space-y-6">
      {/* Always mounted so screen readers announce every change */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusText(props)}
      </p>
      <BookingBody {...props} />
    </div>
  )
}

function BookingBody(props: BookingViewProps) {
  const { status, provider, retrying, onRetry } = props

  switch (status.kind) {
    case 'loading':
      return <BookingSkeleton />

    case 'offline':
      return (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          The provider's times will load as soon as you're back online.
        </StatePanel>
      )

    case 'error': {
      if (status.error instanceof ApiError && status.error.status === 404) {
        return (
          <StatePanel icon={SearchX} title="We couldn't find this provider" action={otherProviders}>
            The link may be old, or the provider no longer takes bookings through MedEx.
          </StatePanel>
        )
      }
      const message = failureMessage([status.error], "the provider's details")
      return (
        <StatePanel icon={CloudOff} title={message.title} tone="error" role="alert" action={<RetryButton retrying={retrying} onRetry={onRetry} />}>
          {message.body} Anything you've chosen so far is kept.
        </StatePanel>
      )
    }

    case 'ready':
      return provider ? <ProviderBooking {...props} provider={provider} /> : null
  }
}

function ProviderBooking({
  provider,
  customerZone,
  now,
  selection,
  specialist,
  staleSpecialist,
  onChoose,
  children,
}: BookingViewProps & { provider: BookingProvider }) {
  if (!provider.zone) {
    // Showing times in a guessed zone could put the customer at the clinic at the wrong hour
    return (
      <StatePanel icon={CalendarX} title="Online booking isn't available here" action={otherProviders}>
        We can't confirm which time zone {provider.name} uses, so we can't show appointment times you can rely on. Please
        contact them to book.
      </StatePanel>
    )
  }

  const bookable = provider.specialists.filter((s) => s.consultation !== null)
  if (bookable.length === 0) {
    return (
      <StatePanel icon={Users} title="No specialists take online bookings here yet" action={otherProviders}>
        Please contact {provider.name} to book, or choose another provider.
      </StatePanel>
    )
  }

  return (
    <div className="space-y-8">
      <ZoneLegend provider={provider.zone} customer={customerZone} now={now} />

      {staleSpecialist && (
        <p role="status" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          The specialist in your link isn't taking online bookings any more. Please choose another.
        </p>
      )}

      {provider.specialists.length > 1 ? (
        <SpecialistPicker
          specialists={provider.specialists}
          zone={provider.zone}
          selectedId={specialist?.id ?? null}
          onSelect={(specialistId) => onChoose({ specialistId })}
        />
      ) : (
        specialist?.consultation && (
          <section aria-labelledby="specialist-title" className="space-y-1">
            <h2 id="specialist-title" className="font-accent text-lg font-semibold">
              Your specialist
            </h2>
            <p>
              <span className="font-medium">{specialist.name}</span>
              {specialist.speciality && `, ${specialist.speciality}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {consultationText(specialist.consultation)} ({zoneTimeLabel(provider.zone)})
            </p>
          </section>
        )
      )}

      <PeoplePicker people={selection.people} onChange={(people) => onChoose({ people })} />

      {specialist ? (
        children
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Choose a specialist to see the dates and times they can see you.
        </p>
      )}
    </div>
  )
}

/** Placeholder while the provider loads: the same shapes in the same places, so nothing jumps */
export function BookingSkeleton() {
  return (
    <div aria-hidden className="space-y-8">
      <ZoneLegendSkeleton />
      <SpecialistPickerSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-48 rounded-full" />
      </div>
    </div>
  )
}
