import { describe, expect, it } from 'vitest'
import { formatWallTime } from '../time/wallTime.js'
import { dayStatus, nearestAlternatives, type SpecialistDay } from './availability.js'
import { ARAVALI, BANGKOK, KOLKATA, MEHRA, RANA, RIVERSIDE, WONGSAKUL, t } from './fixtures.js'
import { consultationSlots } from './slots.js'

// Tuesday 27 October 2026, 10:00 in Bangkok
const NOW = Date.parse('2026-10-27T03:00:00Z')

const riverside = (date: string, overrides: Partial<SpecialistDay> = {}): SpecialistDay => ({
  date,
  zone: BANGKOK,
  schedule: RIVERSIDE,
  consultation: WONGSAKUL,
  bookedStarts: [],
  ...overrides,
})

describe('dayStatus: the 90-day window', () => {
  it('opens today and the next 89 days at the provider', () => {
    expect(dayStatus(riverside('2026-10-26'), 1, NOW)).toEqual({ kind: 'past' })
    expect(dayStatus(riverside('2027-01-23'), 1, NOW).kind).toBe('available') // day 88, a Saturday
    expect(dayStatus(riverside('2027-01-24'), 1, NOW).kind).toBe('closed') // day 89: in the window, but a Sunday
    expect(dayStatus(riverside('2027-01-25'), 1, NOW)).toEqual({ kind: 'outside-window' }) // day 90
  })

  it("counts the window from today at the provider, not on the customer's device", () => {
    // 23:30 on the 27th in Kathmandu is already the 28th in Bangkok, so the 27th is past there
    const lateEvening = Date.parse('2026-10-27T17:45:00Z')
    expect(dayStatus(riverside('2026-10-27'), 1, lateEvening)).toEqual({ kind: 'past' })
  })
})

describe('dayStatus: reasons a day is unavailable', () => {
  it('gives a closure its reason, even when bookings were recorded that day', () => {
    expect(dayStatus(riverside('2026-11-08', { closure: 'Public holiday', bookedStarts: [t('10:00')] }), 1, NOW)).toEqual({
      kind: 'closure',
      reason: 'Public holiday',
    })
  })

  it('shows a blank closure reason as "Closed"', () => {
    expect(dayStatus(riverside('2026-11-09', { closure: '  ' }), 1, NOW)).toEqual({ kind: 'closure', reason: 'Closed' })
  })

  it('marks the weekly closed day', () => {
    expect(dayStatus(riverside('2026-11-01'), 1, NOW)).toEqual({ kind: 'closed' }) // a Sunday
  })

  it("explains a specialist whose hours don't fit the day's opening hours (Dr. Rana on a Friday)", () => {
    expect(dayStatus(riverside('2026-10-30', { consultation: RANA }), 1, NOW)).toEqual({
      kind: 'specialist-unavailable',
      limit: { opensAt: null, closesAt: t('17:00') },
    })
  })

  it('marks a fully booked day', () => {
    const everySlot = consultationSlots(WONGSAKUL).map((slot) => slot.start)
    expect(dayStatus(riverside('2026-11-02', { bookedStarts: everySlot }), 1, NOW)).toEqual({ kind: 'fully-booked' })
  })

  it('marks today as over once every free slot has started, by the provider clock', () => {
    // 23:15 on the 27th in India (already the 28th in Bangkok): Dr. Mehra's last slot started at 23:00
    const now = Date.parse('2026-10-27T17:45:00Z')
    const day: SpecialistDay = { date: '2026-10-27', zone: KOLKATA, schedule: ARAVALI, consultation: MEHRA, bookedStarts: [] }
    expect(dayStatus(day, 1, now)).toEqual({ kind: 'no-time-left' })
  })

  it("says when free slots exist but not enough in a row for the group", () => {
    // Free: 10:00, 11:20, 12:40, 14:00, 15:20, none next to another
    const booked = [t('10:40'), t('12:00'), t('13:20'), t('14:40')]
    expect(dayStatus(riverside('2026-11-02', { bookedStarts: booked }), 2, NOW)).toEqual({
      kind: 'not-enough-in-a-row',
      people: 2,
    })
  })
})

describe('dayStatus: available days', () => {
  it('leaves out slots that have already started today', () => {
    const status = dayStatus(riverside('2026-10-27'), 1, NOW)
    expect(status.kind === 'available' && status.startTimes.map(formatWallTime)[0]).toBe('10:40')
  })

  it('offers only start times with room for the whole group', () => {
    const status = dayStatus(riverside('2026-11-02'), 4, NOW)
    expect(status.kind === 'available' && status.startTimes.map(formatWallTime)).toEqual([
      '10:00', '10:40', '11:20', '12:00', '12:40', '13:20',
    ])
  })
})

describe('nearestAlternatives', () => {
  const wanted = { date: '2026-11-02', start: t('12:00') }

  it('ranks by real time distance, earlier first on a tie, and leaves out the slot that was taken', () => {
    const candidates = [
      { date: '2026-11-02', start: t('10:00') },
      { date: '2026-11-02', start: t('11:20') },
      { date: '2026-11-02', start: t('12:00') },
      { date: '2026-11-02', start: t('12:40') },
      { date: '2026-11-03', start: t('12:00') },
    ]
    expect(nearestAlternatives(candidates, wanted, BANGKOK, 3)).toEqual([
      { date: '2026-11-02', start: t('11:20') },
      { date: '2026-11-02', start: t('12:40') },
      { date: '2026-11-02', start: t('10:00') },
    ])
  })

  it('counts a slot just after midnight as close to a late-evening one', () => {
    const late = { date: '2026-11-02', start: t('23:00') }
    const candidates = [
      { date: '2026-11-02', start: t('08:00') },
      { date: '2026-11-03', start: t('00:30') },
    ]
    expect(nearestAlternatives(candidates, late, KOLKATA, 1)).toEqual([{ date: '2026-11-03', start: t('00:30') }])
  })
})
