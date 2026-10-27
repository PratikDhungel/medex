import { ArrowDown, ArrowRight, CalendarClock, TriangleAlert, WifiOff } from 'lucide-react'
import type { TimeZone } from '@shared/time/zone'
import { Button } from '@/components/ui/button'
import { customerTimeOf, formatDate, formatTime, sameClock, zoneCity } from '@/domain/booking/clock'
import type { SlotChoice } from '@/domain/booking/model'
import { moveBetween, moveSummary } from '@/domain/booking/move'
import { bookingEnd } from '@/domain/booking/slotView'
import type { SubmissionState } from '@/domain/booking/submission'
import { cn } from '@/lib/utils'
import type { SummaryBooking } from './BookingSummary'
import { ConflictPanel } from './ReviewPanel'

interface MoveReviewProps {
  /** Where the booking is now */
  from: SummaryBooking
  /** Where it would move to */
  to: SummaryBooking
  state: SubmissionState
  online: boolean
  slow: boolean
  customerZone: TimeZone
  now: number
  onConfirm: () => void
  onPickAlternative: (choice: SlotChoice) => void
}

/**
 * The change, before it's made: where the booking is now (struck through)
 * next to where it's moving, both on both clocks, under a one-line headline
 * of which way it moves.
 */
export function MoveReview({ from, to, state, online, slow, customerZone, now, onConfirm, onPickAlternative }: MoveReviewProps) {
  if (state.kind === 'conflict') {
    return (
      <ConflictPanel
        booking={to}
        state={state}
        customerZone={customerZone}
        now={now}
        onPick={onPickAlternative}
        keptText={`Your booking hasn't changed: it's still ${formatDate(from.date, 'long')}, ${formatTime(from.start)} ${zoneCity(from.zone)} time`}
      />
    )
  }
  if (state.kind === 'unknown' || state.kind === 'booked') return null

  const submitting = state.kind === 'submitting'
  const move = moveBetween(from, to)
  const unchanged = move.days === 0 && move.minutes === 0

  return (
    <section aria-labelledby="move-title" className="space-y-4 rounded-xl border-2 border-primary/40 px-4 py-4">
      <div className="space-y-1">
        <h3 id="move-title" tabIndex={-1} className="flex items-center gap-2 font-accent font-semibold outline-none">
          <CalendarClock aria-hidden className="size-4 text-primary" />
          Check the change
        </h3>
        <p className="text-lg font-semibold">{moveSummary(move)}</p>
      </div>

      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <TimeCard label="Your booking now" booking={from} customerZone={customerZone} now={now} old />
        <ArrowRight aria-hidden className="mx-auto hidden size-5 text-muted-foreground sm:block" />
        <ArrowDown aria-hidden className="mx-auto size-5 text-muted-foreground sm:hidden" />
        <TimeCard label="Moving to" booking={to} customerZone={customerZone} now={now} />
      </div>

      <p className="text-sm text-muted-foreground">
        Same specialist, same group. Your current time is given up only once the change is confirmed.
      </p>

      {state.kind === 'failed' && (
        <p role="alert" className="flex items-start gap-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          {state.reason === 'offline'
            ? 'You were offline, so nothing changed. Reconnect, then try again.'
            : "We couldn't move your booking, and nothing changed. Please try again, or choose another time."}
        </p>
      )}
      {!online && !submitting && (
        <p role="status" className="flex items-start gap-2 text-sm">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          You're offline. You can confirm the change once you're back online.
        </p>
      )}

      <div className="space-y-2">
        <Button className="w-full sm:w-auto" onClick={onConfirm} disabled={submitting || !online || unchanged} aria-describedby="move-status">
          {submitting ? 'Moving…' : 'Move my booking'}
        </Button>
        <p id="move-status" role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {submitting && (slow ? 'Still saving the change. This is taking longer than usual, so please keep this page open.' : 'Moving your booking…')}
        </p>
      </div>
    </section>
  )
}

interface TimeCardProps {
  label: string
  booking: SummaryBooking
  customerZone: TimeZone
  now: number
  /** The time being given up: struck through and muted */
  old?: boolean
}

function TimeCard({ label, booking, customerZone, now, old = false }: TimeCardProps) {
  const { zone, date, start, consultation, people } = booking
  const end = bookingEnd(consultation, start, people)
  const yours = customerTimeOf(zone, date, start, customerZone)
  const yoursEnd = customerTimeOf(zone, date, end, customerZone)

  return (
    <div className={cn('rounded-lg px-3 py-3', old ? 'border border-dashed bg-muted/40 text-muted-foreground' : 'border-2 border-primary bg-primary/5')}>
      <p className="text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className={cn(old && 'line-through decoration-1')}>
        <p className="font-semibold">{formatDate(date, 'long')}</p>
        <p className="font-semibold tabular-nums">
          {formatTime(start)} – {formatTime(end)} {zoneCity(zone)} time
        </p>
      </div>
      {!sameClock(zone, customerZone, now) && (
        <p className={cn('text-sm tabular-nums', !old && 'text-muted-foreground', old && 'line-through decoration-1')}>
          {yours.date !== date && `${formatDate(yours.date)}, `}
          {formatTime(yours.time)} – {formatTime(yoursEnd.time)} your time
        </p>
      )}
    </div>
  )
}
