import { describe, expect, it } from 'vitest'
import { formatWallTime } from '../time/wallTime.js'
import { BANGKOK, CHAIYAPORN, MEHRA, RANA, RIVERSIDE, THAPA, WONGSAKUL, t } from './fixtures.js'
import type { Consultation } from './schedule.js'
import { consultationSlots, daySlots, groupStartTimes, hasStarted, hoursLimit, slotStep, type Slot } from './slots.js'

const starts = (slots: readonly Slot[]) => slots.map((slot) => formatWallTime(slot.start))
const times = (values: readonly number[]) => values.map(formatWallTime)

describe('consultationSlots: the slot rule', () => {
  it('repeats every duration + buffer (the brief example)', () => {
    expect(starts(consultationSlots(WONGSAKUL))).toEqual([
      '10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:40', '15:20',
    ])
  })

  it('stops at the last slot that ends by the end of consultation hours', () => {
    // 15:20 ends 15:50; 16:00 would end 16:30
    expect(consultationSlots(WONGSAKUL).at(-1)).toEqual({ start: t('15:20'), end: t('15:50') })
  })

  it('offers a last slot that ends exactly at the end', () => {
    expect(consultationSlots(THAPA).at(-1)).toEqual({ start: t('22:00'), end: t('22:30') })
  })

  it("doesn't need room for the buffer after the last slot", () => {
    // 10:40 ends at 11:10 exactly; its buffer would run to 11:20
    const tight: Consultation = { start: t('10:00'), end: t('11:10'), durationMinutes: 30, bufferMinutes: 10 }
    expect(starts(consultationSlots(tight))).toEqual(['10:00', '10:40'])
  })

  it('gives no slots when the hours are shorter than one consultation', () => {
    expect(consultationSlots({ start: t('10:00'), end: t('10:20'), durationMinutes: 30, bufferMinutes: 0 })).toEqual([])
  })
})

describe('daySlots: only what fits inside opening hours', () => {
  it('drops the evening slots after closing (Dr. Rana on a Monday)', () => {
    expect(starts(daySlots(RIVERSIDE.monday, RANA, []))).toEqual(['18:00', '18:20', '18:40', '19:00', '19:20', '19:40'])
  })

  it('offers nothing when the provider closes before the specialist starts (Dr. Rana on a Friday)', () => {
    expect(daySlots(RIVERSIDE.friday, RANA, [])).toEqual([])
  })

  it('drops the early slots before opening (Dr. Chaiyaporn on a Saturday)', () => {
    expect(starts(daySlots(RIVERSIDE.saturday, CHAIYAPORN, []))).toEqual(['09:00', '10:00', '11:00'])
  })

  it('offers nothing on a day the provider is closed', () => {
    expect(daySlots(RIVERSIDE.sunday, WONGSAKUL, [])).toEqual([])
  })

  it('marks booked slots', () => {
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, [t('10:40')])
    expect(slots.filter((slot) => slot.booked).map((slot) => formatWallTime(slot.start))).toEqual(['10:40'])
  })

  it('lets a booked time off the grid block every slot it overlaps', () => {
    // 10:30 holds the doctor until 11:10, over both the 10:00 and 10:40 slots
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, [t('10:30')])
    expect(slots.filter((slot) => slot.booked).map((slot) => formatWallTime(slot.start))).toEqual(['10:00', '10:40'])
  })

  it('ignores a booking outside the opening hours (Dr. Chaiyaporn at 07:00)', () => {
    expect(daySlots(RIVERSIDE.monday, CHAIYAPORN, [t('07:00')]).some((slot) => slot.booked)).toBe(false)
  })
})

describe('hoursLimit: why advertised hours are missing', () => {
  it('reports the closing time when evening slots are cut', () => {
    expect(hoursLimit(RIVERSIDE.monday!, RANA)).toEqual({ opensAt: null, closesAt: t('20:00') })
  })

  it('reports the opening time when morning slots are cut', () => {
    expect(hoursLimit(RIVERSIDE.saturday!, CHAIYAPORN)).toEqual({ opensAt: t('09:00'), closesAt: null })
  })

  it('is null when every slot fits', () => {
    expect(hoursLimit(RIVERSIDE.monday!, WONGSAKUL)).toBeNull()
  })

  it("is null for a last slot that ends exactly at closing time, as hours past the last slot don't matter", () => {
    expect(hoursLimit({ open: t('10:00'), close: t('22:30') }, THAPA)).toBeNull()
  })
})

describe('hasStarted: by the provider clock', () => {
  const now = Date.parse('2026-10-27T03:00:00Z') // 10:00 in Bangkok, 08:45 in Kathmandu

  it('counts a slot starting right now as started', () => {
    expect(hasStarted(BANGKOK, '2026-10-27', t('10:00'), now)).toBe(true)
    expect(hasStarted(BANGKOK, '2026-10-27', t('10:40'), now)).toBe(false)
  })

  it("uses the provider's time, not the customer's", () => {
    // In Kathmandu it's 08:45, so a customer's clock would say 09:30 hasn't come yet
    expect(hasStarted(BANGKOK, '2026-10-27', t('09:30'), now)).toBe(true)
  })
})

describe('groupStartTimes: N slots in a row with the same specialist', () => {
  const step = slotStep(WONGSAKUL)
  const free = (slot: { booked: boolean }) => !slot.booked

  it('offers every slot for one person', () => {
    expect(groupStartTimes(daySlots(RIVERSIDE.monday, WONGSAKUL, []), 1, step, free)).toHaveLength(9)
  })

  it('steps over the buffer: 10:00 and 10:40 are in a row', () => {
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, [])
    expect(times(groupStartTimes(slots, 4, step, free))).toEqual(['10:00', '10:40', '11:20', '12:00', '12:40', '13:20'])
  })

  it('skips start times whose run would include a booked slot', () => {
    // 10:40 would need 11:20 next, and 11:20 is taken
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, [t('11:20')])
    expect(times(groupStartTimes(slots, 2, step, free))).toEqual(['10:00', '12:00', '12:40', '13:20', '14:00', '14:40'])
  })

  it('stops a run at the last slot of the day', () => {
    // Dr. Mehra, 4 people: 21:00 to 22:55, or 21:30 to 23:25
    const slots = daySlots({ open: t('08:00'), close: t('23:30') }, MEHRA, [])
    expect(times(groupStartTimes(slots, 4, slotStep(MEHRA), free))).toEqual(['21:00', '21:30'])
  })

  it('breaks a run at a gap in the list', () => {
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, []).filter((slot) => slot.start !== t('12:00'))
    expect(times(groupStartTimes(slots, 2, step, free))).toEqual(['10:00', '10:40', '12:40', '13:20', '14:00', '14:40'])
  })

  it('offers nothing when the day has fewer slots than people', () => {
    expect(groupStartTimes(daySlots(RIVERSIDE.saturday, CHAIYAPORN, []), 4, slotStep(CHAIYAPORN), free)).toEqual([])
  })

  it("lets a reschedule count the booking's own slots as free", () => {
    // Moving a 2-person booking at 11:20 + 12:00 half an hour later reuses its own 12:00
    const slots = daySlots(RIVERSIDE.monday, WONGSAKUL, [t('11:20'), t('12:00')])
    const own = new Set([t('11:20'), t('12:00')])
    expect(times(groupStartTimes(slots, 2, step, (slot) => !slot.booked || own.has(slot.start)))).toContain('12:00')
  })
})
