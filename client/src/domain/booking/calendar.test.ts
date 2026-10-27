import { describe, expect, it } from 'vitest'
import {
  addMonths,
  bookingWindow,
  dayStatusOn,
  monthWeeks,
  moveFocus,
  nextAvailableDate,
  previousAvailableDate,
  windowMonths,
} from './calendar'
import type { DayAvailability } from './model'

const window = bookingWindow('2026-10-27')

describe('months', () => {
  it('lays a month out in weeks, Sunday first', () => {
    const weeks = monthWeeks('2026-11')
    // 1 November 2026 is a Sunday
    expect(weeks[0]).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
    expect(weeks.at(-1)).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null])
    expect(monthWeeks('2026-10')[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('adds months across a year', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
  })

  it('covers 90 days from today', () => {
    expect(window).toEqual({ first: '2026-10-27', last: '2027-01-24' })
    expect(windowMonths(window)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01'])
  })
})

describe('moveFocus: the date picker keys', () => {
  it.each([
    ['ArrowRight', '2026-11-11', '2026-11-12'],
    ['ArrowLeft', '2026-11-01', '2026-10-31'],
    ['ArrowDown', '2026-11-11', '2026-11-18'],
    ['ArrowUp', '2026-11-11', '2026-11-04'],
    ['Home', '2026-11-11', '2026-11-08'],
    ['End', '2026-11-11', '2026-11-14'],
    ['PageDown', '2026-11-11', '2026-12-11'],
    ['PageUp', '2026-12-11', '2026-11-11'],
  ] as const)('%s from %s goes to %s', (key, from, to) => {
    expect(moveFocus(from, key, window)).toBe(to)
  })

  it('keeps the day of the month where it exists', () => {
    expect(moveFocus('2026-12-31', 'PageDown', bookingWindow('2026-12-01'))).toBe('2027-01-31')
    expect(moveFocus('2027-01-31', 'PageDown', bookingWindow('2026-12-30'))).toBe('2027-02-28')
  })

  it('stays inside the bookable window', () => {
    expect(moveFocus('2026-10-27', 'ArrowLeft', window)).toBe('2026-10-27')
    expect(moveFocus('2026-10-28', 'PageUp', window)).toBe('2026-10-27')
    expect(moveFocus('2027-01-20', 'ArrowDown', window)).toBe('2027-01-24')
  })
})

describe('dayStatusOn', () => {
  const days = new Map<string, DayAvailability>([
    ['2026-10-27', { date: '2026-10-27', status: 'available', startCount: 3 }],
    ['2026-10-28', { date: '2026-10-28', status: 'closed' }],
  ])

  it("uses the server's status inside the window", () => {
    expect(dayStatusOn('2026-10-28', days, '2026-10-27', window)).toEqual({ date: '2026-10-28', status: 'closed' })
  })

  it("marks today past once midnight has passed at the provider, before the server is asked again", () => {
    expect(dayStatusOn('2026-10-27', days, '2026-10-28', window).status).toBe('past')
  })

  it('marks dates outside the window, and dates the server left out as unknown', () => {
    expect(dayStatusOn('2027-01-25', days, '2026-10-27', window).status).toBe('outside-window')
    expect(dayStatusOn('2026-11-02', days, '2026-10-27', window).status).toBe('unknown')
  })
})

describe('finding available dates', () => {
  const days: DayAvailability[] = [
    { date: '2026-10-27', status: 'available', startCount: 1 },
    { date: '2026-10-28', status: 'fully-booked' },
    { date: '2026-10-29', status: 'available', startCount: 4 },
    { date: '2026-10-30', status: 'closed' },
    { date: '2026-10-31', status: 'available', startCount: 2 },
  ]

  it('finds the next available date after a given one', () => {
    expect(nextAvailableDate(days, '2026-10-29', '2026-10-27')).toBe('2026-10-31')
    expect(nextAvailableDate(days, null, '2026-10-27')).toBe('2026-10-27')
    expect(nextAvailableDate(days, '2026-10-31', '2026-10-27')).toBeNull()
  })

  it("skips days that are past at the provider", () => {
    expect(nextAvailableDate(days, null, '2026-10-28')).toBe('2026-10-29')
  })

  it('finds the previous available date', () => {
    expect(previousAvailableDate(days, '2026-10-30', '2026-10-27')).toBe('2026-10-29')
    expect(previousAvailableDate(days, '2026-10-29', '2026-10-28')).toBeNull()
  })
})
