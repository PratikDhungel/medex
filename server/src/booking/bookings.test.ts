import { beforeEach, describe, expect, it } from 'vitest'
import { BookingService, type BookingRequest } from './bookings.js'
import { loadBookingData } from './data.js'

// Tuesday 27 October 2026, 10:00 in Bangkok
const NOW = Date.parse('2026-10-27T03:00:00Z')
const data = loadBookingData(undefined, NOW)

const RIVERSIDE = 48
const WONGSAKUL = '2a2f07eb-7886-4f83-82ab-ca56f415da44'
const EXISTING = 'BK-20261008-0042' // Dr. Wongsakul, Friday 30 October at 11:20

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

let bookings: BookingService

beforeEach(() => {
  bookings = new BookingService(data, () => NOW)
})

const request = (overrides: Partial<BookingRequest> = {}): BookingRequest => ({
  providerId: RIVERSIDE,
  specialistId: WONGSAKUL,
  date: '2026-11-11', // a Wednesday with no bookings for Dr. Wongsakul in the data
  start: t('12:00'),
  numberOfPeople: 1,
  ...overrides,
})

const bookedTimes = (date: string, rescheduling?: string) =>
  bookings
    .slots(RIVERSIDE, WONGSAKUL, date, rescheduling)
    .filter((slot) => slot.booked)
    .map((slot) => slot.start)

describe('availability', () => {
  it('covers 90 days from today at the provider, each with a reason', () => {
    const { today, days } = bookings.availability(RIVERSIDE, WONGSAKUL, 1)
    expect(today).toBe('2026-10-27')
    expect(days).toHaveLength(90)
    expect(days.at(-1)!.date).toBe('2027-01-24')
    expect(days.find((day) => day.date === '2026-11-01')!.status).toEqual({ kind: 'closed' })
    expect(days.find((day) => day.date === '2026-11-08')!.status).toEqual({ kind: 'closure', reason: 'Public holiday' })
  })

  it('offers no times today that have already started', () => {
    // 10:00 has started; 10:40 is booked in the data
    expect(bookedTimes('2026-10-27')).toContain(t('10:40'))
    const today = bookings.availability(RIVERSIDE, WONGSAKUL, 1).days[0].status
    expect(today.kind === 'available' && today.startTimes[0]).toBe(t('11:20'))
  })
})

describe('slots', () => {
  it("counts the existing booking as taken, though it isn't in bookedSlots", () => {
    expect(bookedTimes('2026-10-30')).toContain(t('11:20'))
  })

  it('counts it as free while that booking is being rescheduled', () => {
    expect(bookedTimes('2026-10-30', EXISTING)).not.toContain(t('11:20'))
  })

  it('offers nothing on a closure day, even with bookings recorded on it', () => {
    expect(bookings.slots(RIVERSIDE, WONGSAKUL, '2026-11-08')).toEqual([])
  })

  it('rejects an unknown provider or specialist', () => {
    expect(() => bookings.slots(999, WONGSAKUL, '2026-11-11')).toThrow(expect.objectContaining({ status: 404 }))
    expect(() => bookings.slots(RIVERSIDE, 'nobody', '2026-11-11')).toThrow(
      expect.objectContaining({ code: 'specialist_not_found' }),
    )
  })
})

describe('create', () => {
  it('books the slot so nobody else can', () => {
    expect(bookings.create(request())).toEqual({ bookingId: 'BK-20261027-0001' })
    expect(bookedTimes('2026-11-11')).toEqual([t('12:00')])
  })

  it('answers a taken slot with a conflict and the nearest alternatives', () => {
    bookings.create(request())
    expect(() => bookings.create(request())).toThrow(
      expect.objectContaining({
        status: 409,
        code: 'slot_taken',
        details: {
          alternatives: [
            { date: '2026-11-11', startTime: '11:20' },
            { date: '2026-11-11', startTime: '12:40' },
            { date: '2026-11-11', startTime: '10:40' },
          ],
        },
      }),
    )
  })

  it('holds one slot per person, one after another', () => {
    bookings.create(request({ numberOfPeople: 3 }))
    expect(bookedTimes('2026-11-11')).toEqual([t('12:00'), t('12:40'), t('13:20')])
  })

  it("refuses a group whose run would reach someone else's booking", () => {
    bookings.create(request({ start: t('12:40') }))
    expect(() => bookings.create(request({ numberOfPeople: 2 }))).toThrow(expect.objectContaining({ code: 'slot_taken' }))
  })

  it('refuses a group whose run would go past the last slot', () => {
    expect(() => bookings.create(request({ start: t('14:40'), numberOfPeople: 3 }))).toThrow(
      expect.objectContaining({ code: 'slot_unavailable' }),
    )
  })

  it.each([
    ['a slot that already started today', { date: '2026-10-27', start: t('10:00') }],
    ['a time off the slot grid', { start: t('12:10') }],
    ['a closed day', { date: '2026-11-01' }],
    ['a closure', { date: '2026-11-08' }],
  ])('refuses %s', (_case, overrides) => {
    expect(() => bookings.create(request(overrides))).toThrow(expect.objectContaining({ status: 409, code: 'slot_unavailable' }))
  })

  it('returns the same booking for a repeated key, and refuses the key for a different booking', () => {
    const first = bookings.create(request({ idempotencyKey: 'key-123456' }))
    expect(bookings.create(request({ idempotencyKey: 'key-123456' }))).toEqual(first)
    expect(bookedTimes('2026-11-11')).toEqual([t('12:00')])
    expect(() => bookings.create(request({ idempotencyKey: 'key-123456', start: t('14:00') }))).toThrow(
      expect.objectContaining({ code: 'idempotency_key_reused' }),
    )
  })

  it('meets a real conflict when someone else takes the slot first', () => {
    bookings.takeSlot({ providerId: RIVERSIDE, specialistId: WONGSAKUL, date: '2026-11-11', start: t('12:00') })
    expect(() => bookings.create(request())).toThrow(expect.objectContaining({ code: 'slot_taken' }))
  })
})

describe('reschedule', () => {
  it('moves the booking and frees its old slot', () => {
    const moved = bookings.reschedule(EXISTING, '2026-11-11', t('12:00'))
    expect(moved).toMatchObject({ date: '2026-11-11', start: t('12:00') })
    expect(bookedTimes('2026-10-30')).not.toContain(t('11:20'))
    expect(bookedTimes('2026-11-11')).toEqual([t('12:00')])
  })

  it('is harmless to send twice', () => {
    bookings.reschedule(EXISTING, '2026-11-11', t('12:00'))
    expect(bookings.reschedule(EXISTING, '2026-11-11', t('12:00')).start).toBe(t('12:00'))
  })

  it("lets a group move onto its own slots", () => {
    const { bookingId } = bookings.create(request({ numberOfPeople: 2 }))
    expect(bookings.reschedule(bookingId, '2026-11-11', t('12:40')).start).toBe(t('12:40'))
    expect(bookedTimes('2026-11-11')).toEqual([t('12:40'), t('13:20')])
  })

  it('refuses a slot someone else holds and leaves the booking where it was', () => {
    bookings.create(request())
    expect(() => bookings.reschedule(EXISTING, '2026-11-11', t('12:00'))).toThrow(expect.objectContaining({ code: 'slot_taken' }))
    expect(bookings.booking(EXISTING)).toMatchObject({ date: '2026-10-30', start: t('11:20') })
  })
})

describe('reset', () => {
  it('restores the seed bookings', () => {
    bookings.reschedule(EXISTING, '2026-11-11', t('12:00'))
    bookings.create(request({ start: t('14:00') }))
    bookings.reset()
    expect(bookings.booking(EXISTING)).toMatchObject({ date: '2026-10-30', start: t('11:20') })
    expect(bookedTimes('2026-11-11')).toEqual([])
  })
})
