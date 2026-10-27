import { Hourglass, RotateCw } from 'lucide-react'
import type { TimeZone } from '@shared/time/zone'
import { Button } from '@/components/ui/button'
import type { SubmissionState } from '@/domain/booking/submission'
import { BookingSummary, type SummaryBooking } from './BookingSummary'

interface PendingBookingProps {
  state: Extract<SubmissionState, { kind: 'unknown' | 'submitting' }>
  /** The booking being checked, which may not be what's chosen on the page now */
  booking: SummaryBooking | null
  online: boolean
  customerZone: TimeZone
  now: number
  onCheck: () => void
}

/**
 * A booking whose result we don't know yet. While this shows, nothing else
 * can be booked from the page: the request may have gone through, and
 * booking again could give the customer two appointments.
 */
export function PendingBooking({ state, booking, online, customerZone, now, onCheck }: PendingBookingProps) {
  const checking = state.kind === 'submitting'
  return (
    <section
      aria-labelledby="pending-title"
      data-autofocus
      tabIndex={-1}
      className="space-y-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/5 px-4 py-4 outline-none"
    >
      <h2 id="pending-title" className="flex items-center gap-2 font-accent text-lg font-semibold">
        <Hourglass aria-hidden className="size-5 text-amber-600" />
        We're not sure your booking went through yet
      </h2>
      <p role="status" aria-live="polite" className="text-sm">
        {checking
          ? 'Checking with the provider…'
          : online
            ? "We lost touch with the server while booking. Checking again is safe: you won't end up with two bookings."
            : "You're offline. We'll check as soon as you reconnect, and you won't end up with two bookings."}
      </p>
      {booking && <BookingSummary booking={booking} customerZone={customerZone} now={now} />}
      <p className="text-sm text-muted-foreground">You can choose another time once we know what happened to this one.</p>
      <Button variant="outline" onClick={onCheck} disabled={checking || !online}>
        <RotateCw aria-hidden className={checking ? 'animate-spin' : undefined} />
        {checking ? 'Checking…' : online ? 'Check now' : 'Waiting for a connection'}
      </Button>
    </section>
  )
}
