import { describe, expect, it } from 'vitest'
import {
  normaliseAvailability,
  normaliseBooking,
  normaliseDaySlots,
  normaliseProvider,
  readAlternatives,
} from './normalise'

const NOW = Date.parse('2026-10-27T03:00:00Z')

// Shaped like records in server/data/task3-booking.json
const himalNeo = {
  id: 46,
  name: 'Himal Neo Clinic',
  country: 'NP',
  timezone: ' UTC+05:45',
  daySchedules: { sunday: { startTime: '07:00', endTime: '19:00' }, friday: { startTime: '07:00', endTime: '15:00' } },
  specialists: [
    {
      id: '402253e0-9cee-48ac-aa46-a1fb676cd766',
      name: 'Dr. S. Shrestha',
      speciality: 'General Practice',
      consultation: { startTime: '07:00', endTime: '19:00', durationInMinutes: 15, bufferInMinutes: 5 },
    },
  ],
}

describe('normaliseProvider', () => {
  it('reads a provider, its zone and its specialists', () => {
    expect(normaliseProvider(himalNeo, NOW)).toEqual({
      id: 46,
      name: 'Himal Neo Clinic',
      country: 'NP',
      zone: { kind: 'iana', id: 'Asia/Kathmandu' },
      zoneSource: 'offset',
      schedule: { sunday: { open: 420, close: 1140 }, friday: { open: 420, close: 900 } },
      specialists: [
        {
          id: '402253e0-9cee-48ac-aa46-a1fb676cd766',
          name: 'Dr. S. Shrestha',
          speciality: 'General Practice',
          consultation: { start: 420, end: 1140, durationMinutes: 15, bufferMinutes: 5 },
        },
      ],
    })
  })

  it('falls back to the country for an empty time zone', () => {
    expect(normaliseProvider({ ...himalNeo, timezone: '', country: 'IN' }, NOW)).toMatchObject({
      zone: { kind: 'iana', id: 'Asia/Kolkata' },
      zoneSource: 'country',
    })
  })

  it('keeps a provider whose zone cannot be worked out, with no zone, so it can say it cannot be booked', () => {
    expect(normaliseProvider({ ...himalNeo, timezone: '??', country: undefined }, NOW)).toMatchObject({
      zone: null,
      zoneSource: null,
      country: null,
    })
  })

  it('keeps a specialist with unreadable hours but marks them unbookable, and drops ones with no id or a repeated id', () => {
    const provider = normaliseProvider(
      {
        ...himalNeo,
        specialists: [
          { id: 'a', name: 'Dr. A', consultation: { startTime: '10:00', endTime: '12:00', durationInMinutes: 0 } },
          { name: 'No id' },
          { id: 'a', name: 'Dr. A again' },
          'nonsense',
        ],
      },
      NOW,
    )
    expect(provider?.specialists).toEqual([{ id: 'a', name: 'Dr. A', speciality: null, consultation: null }])
  })

  it('rejects a record with no numeric id', () => {
    expect(normaliseProvider({ ...himalNeo, id: '46' }, NOW)).toBeNull()
    expect(normaliseProvider(null, NOW)).toBeNull()
  })
})

describe('normaliseAvailability', () => {
  it('reads each kind of day', () => {
    expect(
      normaliseAvailability({
        today: '2026-10-27',
        days: [
          { date: '2026-10-28', status: 'available', availableStartTimes: 5 },
          { date: '2026-10-27', status: 'no-time-left' },
          { date: '2026-11-08', status: 'closure', reason: ' Public holiday ' },
          { date: '2026-10-30', status: 'specialist-unavailable', opensAt: null, closesAt: '17:00' },
        ],
      }),
    ).toEqual({
      today: '2026-10-27',
      days: [
        { date: '2026-10-27', status: 'no-time-left' },
        { date: '2026-10-28', status: 'available', startCount: 5 },
        { date: '2026-10-30', status: 'specialist-unavailable', opensAt: null, closesAt: 1020 },
        { date: '2026-11-08', status: 'closure', reason: 'Public holiday' },
      ],
    })
  })

  it('shows an unknown status, or an "available" day with nothing to book, as unavailable', () => {
    const result = normaliseAvailability({
      today: '2026-10-27',
      days: [
        { date: '2026-10-27', status: 'maintenance' },
        { date: '2026-10-28', status: 'available', availableStartTimes: 0 },
      ],
    })
    expect(result?.days.map((day) => day.status)).toEqual(['unknown', 'unknown'])
  })

  it('drops days without a real date and rejects a body without today', () => {
    expect(normaliseAvailability({ today: '2026-10-27', days: [{ date: '2026-02-30', status: 'past' }] })?.days).toEqual([])
    expect(normaliseAvailability({ days: [] })).toBeNull()
  })
})

describe('normaliseDaySlots', () => {
  it('reads, sorts and de-duplicates slots', () => {
    expect(
      normaliseDaySlots({
        date: '2026-11-02',
        slots: [
          { startTime: '10:40', endTime: '11:10', isBooked: true },
          { startTime: '10:00', endTime: '10:30', isBooked: false },
          { startTime: '10:00', endTime: '10:30', isBooked: false },
        ],
      }),
    ).toEqual({
      date: '2026-11-02',
      slots: [
        { start: 600, end: 630, booked: false },
        { start: 640, end: 670, booked: true },
      ],
    })
  })

  it('treats a slot without a clear isBooked: false as booked', () => {
    const result = normaliseDaySlots({ date: '2026-11-02', slots: [{ startTime: '10:00', endTime: '10:30' }] })
    expect(result?.slots[0].booked).toBe(true)
  })

  it('drops slots with unreadable or reversed times', () => {
    const result = normaliseDaySlots({
      date: '2026-11-02',
      slots: [
        { startTime: '10am', endTime: '10:30', isBooked: false },
        { startTime: '11:00', endTime: '10:30', isBooked: false },
      ],
    })
    expect(result?.slots).toEqual([])
  })
})

describe('normaliseBooking', () => {
  it('reads a booking', () => {
    expect(
      normaliseBooking({
        bookingId: 'BK-20261008-0042',
        providerId: 48,
        specialistId: 'x',
        date: '2026-10-30',
        startTime: '11:20',
        numberOfPeople: 1,
      }),
    ).toEqual({ bookingId: 'BK-20261008-0042', providerId: 48, specialistId: 'x', date: '2026-10-30', start: 680, numberOfPeople: 1 })
  })

  it('rejects a booking without a usable time', () => {
    expect(normaliseBooking({ bookingId: 'BK-1', providerId: 48, specialistId: 'x', date: '2026-10-30', startTime: '' })).toBeNull()
  })
})

describe('readAlternatives', () => {
  it('reads the alternatives a conflict carries and drops unreadable ones', () => {
    expect(
      readAlternatives({
        alternatives: [{ date: '2026-11-11', startTime: '11:20' }, { date: 'soon', startTime: '12:40' }, null],
      }),
    ).toEqual([{ date: '2026-11-11', start: 680 }])
    expect(readAlternatives(undefined)).toEqual([])
  })
})
