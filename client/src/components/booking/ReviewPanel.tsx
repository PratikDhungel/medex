import { CalendarCheck, TriangleAlert, WifiOff } from 'lucide-react'
import type { TimeZone } from '@shared/time/zone'
import { Button } from '@/components/ui/button'
import { customerTimeOf, formatDate, formatTime, sameClock, zoneCity } from '@/domain/booking/clock'
import type { SlotChoice } from '@/domain/booking/model'
import type { SubmissionState } from '@/domain/booking/submission'
import { BookingSummary, type SummaryBooking } from './BookingSummary'

interface ReviewPanelProps {
  booking: SummaryBooking
  state: SubmissionState
  online: boolean
  /** The request has taken longer than usual */
  slow: boolean
  customerZone: TimeZone
  now: number
  onConfirm: () => void
  onPickAlternative: (choice: SlotChoice) => void
}

/**
 * The chosen time, checked over before booking, and what happened when the
 * customer pressed Confirm. An unknown result is shown at the top of the
 * page instead, since it locks the whole page.
 */
export function ReviewPanel({ booking, state, online, slow, customerZone, now, onConfirm, onPickAlternative }: ReviewPanelProps) {
  if (state.kind === 'conflict') {
    return <ConflictPanel booking={booking} state={state} customerZone={customerZone} now={now} onPick={onPickAlternative} />
  }
  if (state.kind === 'unknown' || state.kind === 'booked') return null

  const submitting = state.kind === 'submitting'
  return (
    <section aria-labelledby="review-title" className="space-y-4 rounded-xl border-2 border-primary/40 px-4 py-4">
      <h3 id="review-title" tabIndex={-1} className="flex items-center gap-2 font-accent font-semibold outline-none">
        <CalendarCheck aria-hidden className="size-4 text-primary" />
        Check your booking
      </h3>
      <BookingSummary booking={booking} customerZone={customerZone} now={now} />

      {state.kind === 'failed' && (
        <p role="alert" className="flex items-start gap-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          {state.reason === 'offline'
            ? "You were offline, so nothing was booked. Reconnect, then confirm again."
            : "We couldn't book this time, and nothing was booked. Please try again, or choose another time."}
        </p>
      )}
      {!online && !submitting && (
        <p role="status" className="flex items-start gap-2 text-sm">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          You're offline. You can confirm once you're back online.
        </p>
      )}

      <div className="space-y-2">
        <Button className="w-full sm:w-auto" onClick={onConfirm} disabled={submitting || !online} aria-describedby="review-status">
          {submitting ? 'Booking…' : 'Confirm booking'}
        </Button>
        <p id="review-status" role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {submitting && (slow ? 'Still booking. This is taking longer than usual, so please keep this page open.' : 'Booking your appointment…')}
        </p>
      </div>
    </section>
  )
}

export interface ConflictPanelProps {
  booking: SummaryBooking
  state: Extract<SubmissionState, { kind: 'conflict' }>
  customerZone: TimeZone
  now: number
  onPick: (choice: SlotChoice) => void
  /** What stayed as it was; defaults to the wording for a new booking */
  keptText?: string
}

/** Someone else got there first: say so, keep everything else, and offer the nearest times */
export function ConflictPanel({
  booking,
  state,
  customerZone,
  now,
  onPick,
  keptText = 'Nothing was booked. Your specialist, group size and date are kept',
}: ConflictPanelProps) {
  const { zone } = booking
  const taken = formatTime(state.request.start)
  const showCustomer = !sameClock(zone, customerZone, now)

  return (
    <section
      role="alert"
      aria-labelledby="conflict-title"
      className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/5 px-4 py-4"
    >
      <h3 id="conflict-title" className="flex items-center gap-2 font-accent font-semibold">
        <TriangleAlert aria-hidden className="size-4 text-amber-600" />
        {state.code === 'slot_taken'
          ? `Someone else booked ${taken} a moment before you`
          : `${taken} can't be booked any more`}
      </h3>
      <p className="text-sm">
        {keptText}
        {state.alternatives.length > 0 ? '. These are the closest times still free:' : '. Please choose another time.'}
      </p>
      {state.alternatives.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {state.alternatives.map((choice) => {
            const yours = customerTimeOf(zone, choice.date, choice.start, customerZone)
            return (
              <li key={`${choice.date} ${choice.start}`}>
                <Button variant="outline" className="h-auto flex-col items-start py-2" onClick={() => onPick(choice)}>
                  <span>
                    {choice.date !== state.request.date && `${formatDate(choice.date)}, `}
                    {formatTime(choice.start)} <span className="sr-only">{zoneCity(zone)} time</span>
                  </span>
                  {showCustomer && (
                    <span className="text-xs font-normal text-muted-foreground">
                      <span className="sr-only">, </span>
                      {formatTime(yours.time)}
                      {yours.date !== choice.date && `, ${formatDate(yours.date)}`} your time
                    </span>
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
