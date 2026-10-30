import { describe, expect, it } from 'vitest'
import { loadBookingData, parseBookingData } from './data.js'

// Tuesday 27 October 2026: 10:00 in Bangkok, 08:45 in Kathmandu
const NOW = Date.parse('2026-10-27T03:00:00Z')
// 00:30 on the 28th in Bangkok, but still 23:15 on the 27th in Kathmandu
const LATE = Date.parse('2026-10-27T17:30:00Z')

describe('loadBookingData with task3-booking.json', () => {
  const data = loadBookingData(undefined, NOW)

  it('reads every provider and works out every time zone', () => {
    expect([...data.providers.values()].map((p) => [p.id, p.zone])).toEqual([
      [48, { kind: 'iana', id: 'Asia/Bangkok' }],
      [46, { kind: 'iana', id: 'Asia/Kathmandu' }],
      [112, { kind: 'iana', id: 'Asia/Kathmandu' }],
      [118, { kind: 'iana', id: 'Asia/Kathmandu' }],
      [121, { kind: 'iana', id: 'Asia/Kathmandu' }],
      [131, { kind: 'iana', id: 'Asia/Kolkata' }],
    ])
  })

  it('reports only the empty time zone', () => {
    expect(data.issues).toEqual(['provider 131: timezone "" unreadable; using its country\'s zone'])
  })

  it('keeps every booked slot', () => {
    expect(data.bookedSlots).toHaveLength(613)
  })

  it('turns dayOffset into dates', () => {
    expect([...data.providers.get(48)!.closures]).toEqual([['2026-11-08', 'Public holiday']])
    expect(data.existingBooking).toEqual({
      bookingId: 'BK-20261008-0042',
      providerId: 48,
      specialistId: '2a2f07eb-7886-4f83-82ab-ca56f415da44',
      date: '2026-10-30',
      start: 11 * 60 + 20,
      numberOfPeople: 1,
    })
  })

  it("counts dayOffset from each provider's own today", () => {
    const late = loadBookingData(undefined, LATE)
    // Bangkok is already on the 28th, Kathmandu is still on the 27th
    expect([...late.providers.get(48)!.closures.keys()]).toEqual(['2026-11-09'])
    expect([...late.providers.get(46)!.closures.keys()]).toEqual(['2026-10-31'])
  })
})

describe('parseBookingData with broken records', () => {
  const provider = {
    id: 1,
    country: 'TH',
    timezone: 'Asia/Bangkok',
    daySchedules: { monday: { startTime: '08:00', endTime: '20:00' } },
    specialists: [{ id: 'doc', consultation: { startTime: '10:00', endTime: '12:00', durationInMinutes: 30, bufferInMinutes: 0 } }],
  }

  it('skips what it cannot read and says why', () => {
    const data = parseBookingData(
      {
        providers: [
          provider,
          { ...provider }, // the same id again
          { ...provider, id: 2, timezone: '', country: 'XX' },
          { name: 'no id' },
        ],
        closures: [{ providerId: 99, dayOffset: 1 }, { providerId: 2, dayOffset: 1 }],
        bookedSlots: [
          { providerId: 1, specialistId: 'doc', dayOffset: 0, startTime: '10:00' },
          { providerId: 1, specialistId: 'nobody', dayOffset: 0, startTime: '10:00' },
          { providerId: 1, specialistId: 'doc', dayOffset: 'soon', startTime: '10:00' },
          { providerId: 1, specialistId: 'doc', dayOffset: 0, startTime: '10 am' },
          null,
        ],
        existingBooking: { bookingId: 'BK-1', providerId: 1, specialistId: 'doc', dayOffset: 2, startTime: '11:00' },
      },
      NOW,
    )

    expect([...data.providers.keys()]).toEqual([1, 2])
    expect(data.providers.get(2)!.zone).toBeNull()
    expect(data.bookedSlots).toHaveLength(1)
    // A missing group size counts as one person
    expect(data.existingBooking).toMatchObject({ bookingId: 'BK-1', date: '2026-10-29', numberOfPeople: 1 })
    expect(data.issues).toHaveLength(9)
  })
})
