import { describe, expect, it } from 'vitest'
import { formatUtcOffset, instantOf, offsetMinutesAt, todayIn, zonedDateTimeAt, type TimeZone } from './zone.js'

const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const KOLKATA: TimeZone = { kind: 'iana', id: 'Asia/Kolkata' }
const NEW_YORK: TimeZone = { kind: 'iana', id: 'America/New_York' }

const utc = (iso: string) => Date.parse(`${iso}Z`)

describe('offsetMinutesAt', () => {
  it('knows the three markets, including the 45- and 30-minute offsets', () => {
    const now = utc('2026-10-27T06:00:00')
    expect(offsetMinutesAt(BANGKOK, now)).toBe(420)
    expect(offsetMinutesAt(KATHMANDU, now)).toBe(345)
    expect(offsetMinutesAt(KOLKATA, now)).toBe(330)
  })

  it('returns a fixed offset as is', () => {
    expect(offsetMinutesAt({ kind: 'fixed', offsetMinutes: -210 }, 0)).toBe(-210)
  })

  it("isn't thrown off by milliseconds", () => {
    expect(offsetMinutesAt(KATHMANDU, utc('2026-10-27T06:00:59.999'))).toBe(345)
  })

  it('follows daylight saving where a zone has it', () => {
    expect(offsetMinutesAt(NEW_YORK, utc('2026-01-15T12:00:00'))).toBe(-300)
    expect(offsetMinutesAt(NEW_YORK, utc('2026-07-15T12:00:00'))).toBe(-240)
  })
})

describe('what "today" means', () => {
  it('can be a different date at the provider than for the customer', () => {
    // 22:45 on the 27th in Kathmandu is already 00:00 on the 28th in Bangkok
    const now = utc('2026-10-27T17:00:00')
    expect(todayIn(KATHMANDU, now)).toBe('2026-10-27')
    expect(todayIn(BANGKOK, now)).toBe('2026-10-28')
  })

  it('turns over exactly at midnight at the provider', () => {
    expect(zonedDateTimeAt(KOLKATA, utc('2026-10-27T18:29:59'))).toEqual({ date: '2026-10-27', time: 23 * 60 + 59 })
    expect(zonedDateTimeAt(KOLKATA, utc('2026-10-27T18:30:00'))).toEqual({ date: '2026-10-28', time: 0 })
  })
})

describe('instantOf', () => {
  it("places a provider's wall-clock time", () => {
    // Riverside 10:40 is 09:25 in Kathmandu
    const ms = instantOf(BANGKOK, '2026-11-03', 10 * 60 + 40)
    expect(ms).toBe(utc('2026-11-03T03:40:00'))
    expect(zonedDateTimeAt(KATHMANDU, ms)).toEqual({ date: '2026-11-03', time: 9 * 60 + 25 })
  })

  it('moves a late-evening slot onto the next day elsewhere', () => {
    // Dr. Mehra's 23:00 in India is 00:30 the next day in Bangkok
    const ms = instantOf(KOLKATA, '2026-11-03', 23 * 60)
    expect(zonedDateTimeAt(BANGKOK, ms)).toEqual({ date: '2026-11-04', time: 30 })
    expect(zonedDateTimeAt(KATHMANDU, ms)).toEqual({ date: '2026-11-03', time: 23 * 60 + 15 })
  })

  it('handles a fixed offset', () => {
    expect(instantOf({ kind: 'fixed', offsetMinutes: 345 }, '2026-11-03', 6 * 60)).toBe(utc('2026-11-03T00:15:00'))
  })

  it('round-trips every 5 minutes of a day', () => {
    for (let time = 0; time < 24 * 60; time += 5) {
      expect(zonedDateTimeAt(KATHMANDU, instantOf(KATHMANDU, '2026-12-31', time))).toEqual({ date: '2026-12-31', time })
    }
  })

  it('reads a time skipped by daylight saving as just after the gap', () => {
    // 02:30 doesn't happen in New York on 8 March 2026; it means 03:30 EDT
    expect(instantOf(NEW_YORK, '2026-03-08', 2 * 60 + 30)).toBe(utc('2026-03-08T07:30:00'))
  })

  it('reads a time that happens twice as the first one', () => {
    // 01:30 happens twice in New York on 1 November 2026; the first is EDT
    expect(instantOf(NEW_YORK, '2026-11-01', 60 + 30)).toBe(utc('2026-11-01T05:30:00'))
  })
})

describe('formatUtcOffset', () => {
  it.each([
    [420, 'UTC+7'],
    [345, 'UTC+5:45'],
    [330, 'UTC+5:30'],
    [-210, 'UTC-3:30'],
    [0, 'UTC'],
  ])('%i is %s', (minutes, label) => {
    expect(formatUtcOffset(minutes)).toBe(label)
  })
})
