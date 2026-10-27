import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, parseCalendarDate, weekdayOf } from './calendarDate.js'

describe('parseCalendarDate', () => {
  it('accepts a real date', () => {
    expect(parseCalendarDate('2026-11-03')).toBe('2026-11-03')
    expect(parseCalendarDate('2028-02-29')).toBe('2028-02-29')
  })

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-5', '03/11/2026', '2026-11-03T00:00', '', 20261103, null])(
    'rejects %j',
    (value) => {
      expect(parseCalendarDate(value)).toBeNull()
    },
  )
})

describe('date arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-10-27', 5)).toBe('2026-11-01')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-27', '2027-01-25')).toBe(90)
    expect(daysBetween('2026-10-27', '2026-10-26')).toBe(-1)
  })

  it('knows the day of the week', () => {
    expect(weekdayOf('2026-10-27')).toBe('tuesday')
    expect(weekdayOf('2026-11-01')).toBe('sunday')
  })
})
