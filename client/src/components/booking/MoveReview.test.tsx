import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import { formatDate, formatTime } from '@/domain/booking/clock'
import type { BookingRequest, SubmissionState } from '@/domain/booking/submission'
import type { SummaryBooking } from './BookingSummary'
import { MoveReview } from './MoveReview'

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const at = (time: string) => formatTime(t(time))

const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const NOW = Date.parse('2026-10-27T03:00:00Z')

// The existing booking: Dr. Wongsakul, Friday 30 October at 11:20
const from: SummaryBooking = {
  providerName: 'Riverside International Hospital',
  zone: BANGKOK,
  specialistName: 'Dr. A. Wongsakul',
  consultation: { start: t('10:00'), end: t('16:00'), durationMinutes: 30, bufferMinutes: 10 },
  date: '2026-10-30',
  start: t('11:20'),
  people: 1,
}
const to: SummaryBooking = { ...from, date: '2026-11-11', start: t('14:00') }
const request: BookingRequest = { providerId: 48, specialistId: 'w', date: '2026-11-11', start: t('14:00'), numberOfPeople: 1 }

const render = (state: SubmissionState, overrides: Partial<Parameters<typeof MoveReview>[0]> = {}) =>
  renderToStaticMarkup(
    <MoveReview
      from={from}
      to={to}
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

const moveButton = (html: string) => /<button[^>]*>(?:(?!<\/button>).)*(Move my booking|Moving…)/.exec(html)?.[0] ?? ''

describe('MoveReview', () => {
  it('heads the change with which way it moves', () => {
    expect(text(render({ kind: 'idle' }))).toContain('Check the change 12 days later')
  })

  it('shows where the booking is now, struck through, next to where it moves, on both clocks', () => {
    const html = render({ kind: 'idle' })
    expect(text(html)).toContain(
      `Your booking now ${formatDate('2026-10-30', 'long')} ${at('11:20')} – ${at('11:50')} Bangkok time ${at('10:05')} – ${at('10:35')} your time`,
    )
    expect(text(html)).toContain(
      `Moving to ${formatDate('2026-11-11', 'long')} ${at('14:00')} – ${at('14:30')} Bangkok time ${at('12:45')} – ${at('13:15')} your time`,
    )
    expect(html).toContain('line-through')
  })

  it("can't move a booking to where it already is", () => {
    expect(moveButton(render({ kind: 'idle' }, { to: from }))).toContain('disabled')
  })

  it("can't be confirmed offline or twice", () => {
    expect(moveButton(render({ kind: 'idle' }, { online: false }))).toContain('disabled')
    expect(moveButton(render({ kind: 'submitting', attempt: { request, idempotencyKey: 'k' }, resend: false }))).toContain('disabled')
  })

  it('after a conflict, says the booking has not moved and where it still is', () => {
    const html = text(render({ kind: 'conflict', request, code: 'slot_taken', alternatives: [{ date: '2026-11-11', start: t('14:40') }] }))
    expect(html).toContain(`Someone else booked ${at('14:00')} a moment before you`)
    expect(html).toContain(`Your booking hasn't changed: it's still ${formatDate('2026-10-30', 'long')}, ${at('11:20')} Bangkok time`)
    expect(html).not.toContain('Nothing was booked')
  })
})
