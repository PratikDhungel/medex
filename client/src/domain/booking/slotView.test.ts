import { describe, expect, it } from 'vitest'
import type { TimeZone } from '@shared/time/zone'
import type { Slot } from './model'
import { bookingEnd, groupByPartOfDay, hoursLimitOn, partOfDay, slotViews, type SlotContext } from './slotView'

const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
const KATHMANDU: TimeZone = { kind: 'iana', id: 'Asia/Kathmandu' }
const KOLKATA: TimeZone = { kind: 'iana', id: 'Asia/Kolkata' }

const WONGSAKUL = { start: t('10:00'), end: t('16:00'), durationMinutes: 30, bufferMinutes: 10 }
const wongsakulSlots = (booked: string[] = []): Slot[] =>
  ['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:40', '15:20'].map((start) => ({
    start: t(start),
    end: t(start) + 30,
    booked: booked.includes(start),
  }))

const context = (overrides: Partial<SlotContext> = {}): SlotContext => ({
  date: '2026-11-02',
  zone: BANGKOK,
  customerZone: KATHMANDU,
  consultation: WONGSAKUL,
  people: 1,
  // Tuesday 27 October, 10:00 in Bangkok
  nowMs: Date.parse('2026-10-27T03:00:00Z'),
  ...overrides,
})

const states = (views: ReturnType<typeof slotViews>) => views.map((view) => view.state)

describe('slotViews', () => {
  it('shows booked slots as booked', () => {
    expect(states(slotViews(wongsakulSlots(['10:40']), context())).slice(0, 3)).toEqual(['available', 'booked', 'available'])
  })

  it("marks today's started slots by the provider's clock", () => {
    // 10:00 in Bangkok: the 10:00 slot has started, 10:40 hasn't
    const views = slotViews(wongsakulSlots(), context({ date: '2026-10-27' }))
    expect(states(views).slice(0, 2)).toEqual(['started', 'available'])
  })

  it("doesn't mark slots on other days as started", () => {
    expect(states(slotViews(wongsakulSlots(), context()))).not.toContain('started')
  })

  it('offers only starts with room for the whole group, across the buffers', () => {
    // 3 people need 3 slots in a row; 12:00 is booked
    const views = slotViews(wongsakulSlots(['12:00']), context({ people: 3 }))
    expect(states(views)).toEqual([
      'available', // 10:00, 10:40, 11:20
      'no-room', // 10:40 would need 12:00
      'no-room',
      'booked',
      'available', // 12:40, 13:20, 14:00
      'available',
      'available', // 14:00, 14:40, 15:20
      'no-room', // runs out of day
      'no-room',
    ])
  })

  it("doesn't start a group on a slot that has started, or let one run through it", () => {
    const views = slotViews(wongsakulSlots(), context({ date: '2026-10-27', people: 2 }))
    expect(states(views).slice(0, 2)).toEqual(['started', 'available'])
  })

  it("counts the booking being rescheduled as free for itself", () => {
    const views = slotViews(wongsakulSlots(['11:20']), context({ ownStarts: new Set([t('11:20')]) }))
    expect(views[2].state).toBe('available')
  })

  it("gives the customer's own time, with the next day where it applies", () => {
    expect(slotViews(wongsakulSlots(), context())[1].customer).toEqual({ date: '2026-11-02', time: t('09:25') })
    // Dr. Mehra's 23:00 in India is 00:30 the next day in Bangkok
    const late = slotViews([{ start: t('23:00'), end: t('23:25'), booked: false }], {
      ...context({ zone: KOLKATA, customerZone: BANGKOK }),
      consultation: { start: t('21:00'), end: t('23:30'), durationMinutes: 25, bufferMinutes: 5 },
    })
    expect(late[0].customer).toEqual({ date: '2026-11-03', time: t('00:30') })
  })
})

describe('parts of the day', () => {
  it('splits at noon and 5 PM, on the provider clock', () => {
    expect(partOfDay(t('11:59'))).toBe('morning')
    expect(partOfDay(t('12:00'))).toBe('afternoon')
    expect(partOfDay(t('16:59'))).toBe('afternoon')
    expect(partOfDay(t('17:00'))).toBe('evening')
  })

  it('leaves out parts with no slots', () => {
    const groups = groupByPartOfDay(wongsakulSlots())
    expect(groups.map((group) => [group.part, group.slots.length])).toEqual([
      ['morning', 3],
      ['afternoon', 6],
    ])
  })
})

describe('hoursLimitOn', () => {
  const RIVERSIDE = { monday: { open: t('08:00'), close: t('20:00') }, saturday: { open: t('09:00'), close: t('13:00') } }

  it("reports the provider's closing time when it cuts the specialist's evening (Dr. Rana on a Monday)", () => {
    const rana = { start: t('18:00'), end: t('21:00'), durationMinutes: 20, bufferMinutes: 0 }
    expect(hoursLimitOn('2026-11-02', RIVERSIDE, rana)).toEqual({ opensAt: null, closesAt: t('20:00') })
  })

  it('reports the opening time when it cuts the morning (Dr. Chaiyaporn on a Saturday)', () => {
    const chaiyaporn = { start: t('07:00'), end: t('12:00'), durationMinutes: 45, bufferMinutes: 15 }
    expect(hoursLimitOn('2026-11-07', RIVERSIDE, chaiyaporn)).toEqual({ opensAt: t('09:00'), closesAt: null })
  })

  it('is null when every advertised slot fits, or the provider is closed', () => {
    expect(hoursLimitOn('2026-11-02', RIVERSIDE, WONGSAKUL)).toBeNull()
    expect(hoursLimitOn('2026-11-01', RIVERSIDE, WONGSAKUL)).toBeNull()
  })
})

describe('bookingEnd', () => {
  it("ends with the last person's appointment, after the buffers between them", () => {
    // 3 people from 10:00: 10:00–10:30, 10:40–11:10, 11:20–11:50
    expect(bookingEnd(WONGSAKUL, t('10:00'), 3)).toBe(t('11:50'))
    expect(bookingEnd(WONGSAKUL, t('10:00'), 1)).toBe(t('10:30'))
  })
})
