import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import { customerTimeOf, deviceTimeZone, formatDate, formatTime, offsetDifferenceText, sameClock, zoneCity } from './clock'

const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const KOLKATA: TimeZone = { kind: 'iana', id: 'Asia/Kolkata' }
const NOW = Date.parse('2026-10-27T03:00:00Z')

describe('deviceTimeZone', () => {
  it("uses the current name for a device that reports an old one", () => {
    expect(deviceTimeZone(NOW, 'Asia/Katmandu', 345)).toEqual(KATHMANDU)
  })

  it("falls back to the device's offset when its zone can't be named", () => {
    expect(deviceTimeZone(NOW, '', 345)).toEqual({ kind: 'fixed', offsetMinutes: 345 })
  })
})

describe('zoneCity', () => {
  it.each([
    [BANGKOK, 'Bangkok'],
    [{ kind: 'iana', id: 'America/Argentina/Buenos_Aires' } as TimeZone, 'Buenos Aires'],
    [{ kind: 'iana', id: 'UTC' } as TimeZone, 'UTC'],
    [{ kind: 'fixed', offsetMinutes: 345 } as TimeZone, 'UTC+5:45'],
  ])('%j is %s', (zone, city) => {
    expect(zoneCity(zone)).toBe(city)
  })
})

describe('comparing the two clocks', () => {
  it('describes how far ahead or behind the provider is', () => {
    expect(offsetDifferenceText(BANGKOK, KATHMANDU, NOW)).toBe('1 hour 15 minutes ahead of you')
    expect(offsetDifferenceText(KOLKATA, KATHMANDU, NOW)).toBe('15 minutes behind you')
    expect(offsetDifferenceText(KATHMANDU, BANGKOK, NOW)).toBe('1 hour 15 minutes behind you')
    expect(offsetDifferenceText({ kind: 'fixed', offsetMinutes: 0 }, BANGKOK, NOW)).toBe('7 hours behind you')
  })

  it('treats a fixed offset and a named zone with the same offset as the same clock', () => {
    expect(sameClock({ kind: 'fixed', offsetMinutes: 345 }, KATHMANDU, NOW)).toBe(true)
    expect(offsetDifferenceText({ kind: 'fixed', offsetMinutes: 345 }, KATHMANDU, NOW)).toBeNull()
  })

  it("gives the customer's own date and time for a slot", () => {
    // Riverside 10:40 is 09:25 in Kathmandu
    expect(customerTimeOf(BANGKOK, '2026-11-02', 640, KATHMANDU)).toEqual({ date: '2026-11-02', time: 565 })
    // Dr. Mehra's 23:00 in India is 00:30 the next day in Bangkok
    expect(customerTimeOf(KOLKATA, '2026-11-02', 1380, BANGKOK)).toEqual({ date: '2026-11-03', time: 30 })
  })
})

describe('formatting', () => {
  it("follows the customer's 12- or 24-hour style", () => {
    expect(formatTime(1120, 'en-US')).toBe('6:40 PM')
    expect(formatTime(1120, 'en-GB')).toBe('18:40')
    expect(formatTime(0, 'en-GB')).toBe('00:00')
    expect(formatTime(545, 'en-GB')).toBe('09:05')
    expect(formatTime(545, 'en-US')).toBe('9:05 AM')
  })

  it('formats a calendar date without shifting it into a zone', () => {
    expect(formatDate('2026-11-02', 'short', 'en-GB')).toBe('Mon 2 Nov')
    expect(formatDate('2026-11-02', 'long', 'en-GB')).toBe('Monday, 2 November 2026')
  })
})
