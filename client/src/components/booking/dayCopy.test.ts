import { describe, expect, it } from 'vitest'
import { formatTime } from '@/domain/booking/clock'
import { dayReason, dayShortLabel, type DayContext } from './dayCopy'

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const at = (time: string) => formatTime(t(time))

const rana: DayContext = {
  providerName: 'Riverside International Hospital',
  specialistName: 'Dr. N. Rana',
  consultation: { start: t('18:00'), end: t('21:00'), durationMinutes: 20, bufferMinutes: 0 },
  people: 1,
  city: 'Bangkok',
  providerTimeNow: t('20:37'),
}
const chaiyaporn: DayContext = {
  ...rana,
  specialistName: 'Dr. P. Chaiyaporn',
  consultation: { start: t('07:00'), end: t('12:00'), durationMinutes: 45, bufferMinutes: 15 },
}

describe('dayReason', () => {
  it('names the weekly closed day', () => {
    expect(dayReason({ date: '2026-11-01', status: 'closed' }, rana)).toBe('Riverside International Hospital is closed on Sundays.')
  })

  it("gives a closure the provider's reason", () => {
    expect(dayReason({ date: '2026-11-08', status: 'closure', reason: 'Public holiday' }, rana)).toBe(
      'Riverside International Hospital is closed that day: Public holiday.',
    )
  })

  it('explains a specialist whose hours start after closing (Dr. Rana on a Friday)', () => {
    expect(dayReason({ date: '2026-10-30', status: 'specialist-unavailable', opensAt: null, closesAt: t('17:00') }, rana)).toBe(
      `Riverside International Hospital closes at ${at('17:00')} on Fridays, before Dr. N. Rana's hours start at ${at('18:00')}.`,
    )
  })

  it('explains a closing time too early for any appointment', () => {
    const late = { ...rana, consultation: { ...rana.consultation, start: t('16:30') } }
    expect(dayReason({ date: '2026-10-30', status: 'specialist-unavailable', opensAt: null, closesAt: t('17:00') }, late)).toBe(
      `Riverside International Hospital closes at ${at('17:00')} on Fridays, too early for any of Dr. N. Rana's appointments.`,
    )
  })

  it('explains an opening time after the specialist has finished', () => {
    const early = { ...chaiyaporn, consultation: { ...chaiyaporn.consultation, end: t('08:30') } }
    expect(dayReason({ date: '2026-10-31', status: 'specialist-unavailable', opensAt: t('09:00'), closesAt: null }, early)).toBe(
      `Riverside International Hospital opens at ${at('09:00')} on Saturdays, after Dr. P. Chaiyaporn's hours end at ${at('08:30')}.`,
    )
  })

  it('explains today once its last time has started, with the time at the provider', () => {
    expect(dayReason({ date: '2026-10-27', status: 'no-time-left' }, rana)).toBe(
      `Dr. N. Rana's last time today has already started. It's ${at('20:37')} in Bangkok.`,
    )
  })

  it('suggests fewer people when the group does not fit', () => {
    expect(dayReason({ date: '2026-11-02', status: 'not-enough-in-a-row' }, { ...rana, people: 3 })).toBe(
      "Dr. N. Rana doesn't have 3 times in a row free that day for your group. Try another day, or fewer people.",
    )
  })

  it('covers the remaining statuses', () => {
    expect(dayReason({ date: '2026-10-26', status: 'past' }, rana)).toBe('This day has already passed in Bangkok.')
    expect(dayReason({ date: '2026-11-02', status: 'fully-booked' }, rana)).toBe('Dr. N. Rana is fully booked that day.')
    expect(dayReason({ date: '2027-02-01', status: 'outside-window' }, rana)).toBe('Bookings open 90 days ahead.')
    expect(dayReason({ date: '2026-11-02', status: 'available', startCount: 1 }, rana)).toBe('1 time available.')
  })
})

describe('dayShortLabel', () => {
  it('gives every unavailable day a word that fits in a calendar cell', () => {
    expect(dayShortLabel({ date: '2026-11-01', status: 'closed' })).toBe('Closed')
    expect(dayShortLabel({ date: '2026-11-08', status: 'closure', reason: 'Public holiday' })).toBe('Closed')
    expect(dayShortLabel({ date: '2026-10-30', status: 'specialist-unavailable', opensAt: null, closesAt: 1020 })).toBe('Off')
    expect(dayShortLabel({ date: '2026-11-02', status: 'fully-booked' })).toBe('Full')
    expect(dayShortLabel({ date: '2026-10-27', status: 'no-time-left' })).toBe('Ended')
    expect(dayShortLabel({ date: '2026-11-02', status: 'not-enough-in-a-row' })).toBe('Too few')
    expect(dayShortLabel({ date: '2026-11-02', status: 'available', startCount: 2 })).toBeNull()
  })
})
