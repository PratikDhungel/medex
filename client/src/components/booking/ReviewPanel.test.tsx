import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import { formatDate, formatTime } from '@/domain/booking/clock'
import type { BookingRequest, SubmissionState } from '@/domain/booking/submission'
import type { SummaryBooking } from './BookingSummary'
import { PendingBooking } from './PendingBooking'
import { ReviewPanel } from './ReviewPanel'

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const at = (time: string) => formatTime(t(time))

const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const NOW = Date.parse('2026-10-27T03:00:00Z')

const booking: SummaryBooking = {
  providerName: 'Riverside International Hospital',
  zone: BANGKOK,
  specialistName: 'Dr. A. Wongsakul',
  consultation: { start: t('10:00'), end: t('16:00'), durationMinutes: 30, bufferMinutes: 10 },
  date: '2026-11-11',
  start: t('12:00'),
  people: 1,
}
const request: BookingRequest = { providerId: 48, specialistId: 'w', date: '2026-11-11', start: t('12:00'), numberOfPeople: 1 }
const attempt = { request, idempotencyKey: 'key-1' }

const review = (state: SubmissionState, overrides: Partial<Parameters<typeof ReviewPanel>[0]> = {}) =>
  renderToStaticMarkup(
    <ReviewPanel
      booking={booking}
      state={state}
      online
      slow={false}
      customerZone={KATHMANDU}
      now={NOW}
      onConfirm={() => {}}
      onPickAlternative={() => {}}
      {...overrides}
    />,
  )

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.:)])/g, '$1')

const confirmButton = (html: string) => /<button[^>]*>(?:(?!<\/button>).)*(Confirm booking|Booking…)/.exec(html)?.[0] ?? ''

describe('ReviewPanel: checking before booking', () => {
  it('shows the time on both clocks, each labelled', () => {
    const html = text(review({ kind: 'idle' }))
    expect(html).toContain(`When, in Bangkok ${formatDate('2026-11-11', 'long')} ${at('12:00')} – ${at('12:30')} Bangkok time`)
    expect(html).toContain(`Your time (Kathmandu) ${at('10:45')} – ${at('11:15')}`)
    expect(html).toContain('Riverside International Hospital, with Dr. A. Wongsakul')
  })

  it("lists each person's start time for a group, buffers included", () => {
    const html = text(review({ kind: 'idle' }, { booking: { ...booking, people: 3 } }))
    expect(html).toContain(`${at('12:00')} – ${at('13:50')} Bangkok time`)
    expect(html).toContain(`3 appointments back to back, starting at ${at('12:00')}, ${at('12:40')}, ${at('13:20')}`)
  })

  it("can't be confirmed offline", () => {
    const html = review({ kind: 'idle' }, { online: false })
    expect(confirmButton(html)).toContain('disabled')
    expect(text(html)).toContain("You're offline. You can confirm once you're back online.")
  })

  it("can't be confirmed twice, and says when booking is slow", () => {
    const html = review({ kind: 'submitting', attempt, resend: false }, { slow: true })
    expect(confirmButton(html)).toContain('disabled')
    expect(text(html)).toContain('Still booking. This is taking longer than usual, so please keep this page open.')
  })

  it('says nothing was booked when the request never left', () => {
    expect(text(review({ kind: 'failed', request, reason: 'offline' }))).toContain(
      'You were offline, so nothing was booked. Reconnect, then confirm again.',
    )
  })

  it('steps aside while the result is unknown', () => {
    expect(review({ kind: 'unknown', attempt, reason: 'network' })).toBe('')
  })
})

describe('ReviewPanel: someone else got there first', () => {
  const conflict: SubmissionState = {
    kind: 'conflict',
    request,
    code: 'slot_taken',
    alternatives: [
      { date: '2026-11-11', start: t('12:40') },
      { date: '2026-11-12', start: t('10:00') },
    ],
  }

  it('explains what happened, keeps the choices and offers the nearest times on both clocks', () => {
    const html = text(review(conflict))
    expect(html).toContain(`Someone else booked ${at('12:00')} a moment before you`)
    expect(html).toContain('Nothing was booked. Your specialist, group size and date are kept')
    expect(html).toContain(`${at('12:40')} Bangkok time, ${at('11:25')} your time`)
    // An alternative on another day says which
    expect(html).toContain(`${formatDate('2026-11-12')}, ${at('10:00')} Bangkok time`)
  })

  it('asks for another time when the server suggested none', () => {
    const html = text(review({ ...conflict, code: 'slot_unavailable', alternatives: [] }))
    expect(html).toContain(`${at('12:00')} can't be booked any more`)
    expect(html).toContain('Please choose another time.')
  })
})

describe('PendingBooking', () => {
  const pending = (online: boolean, state: SubmissionState = { kind: 'unknown', attempt, reason: 'network' }) =>
    renderToStaticMarkup(
      <PendingBooking
        state={state as Extract<SubmissionState, { kind: 'unknown' }>}
        booking={booking}
        online={online}
        customerZone={KATHMANDU}
        now={NOW}
        onCheck={() => {}}
      />,
    )

  it('says the result is unknown and that checking again is safe', () => {
    const html = text(pending(true))
    expect(html).toContain("We're not sure your booking went through yet")
    expect(html).toContain("Checking again is safe: you won't end up with two bookings.")
    expect(html).toContain(`${at('12:00')} – ${at('12:30')} Bangkok time`)
  })

  it('waits for a connection before checking', () => {
    const html = pending(false)
    expect(text(html)).toContain("You're offline. We'll check as soon as you reconnect")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Waiting for a connection/)
  })
})
