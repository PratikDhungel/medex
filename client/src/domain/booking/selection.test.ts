import { describe, expect, it } from 'vitest'
import { choose, readSelection, selectedSpecialist, writeSelection, type BookingSelection } from './selection'

const selection: BookingSelection = { specialistId: 'doc', people: 2, date: '2026-11-02', time: 640 }

describe('readSelection', () => {
  it('reads every choice from the URL', () => {
    expect(readSelection(new URLSearchParams('specialist=doc&people=2&date=2026-11-02&time=10:40'))).toEqual(selection)
  })

  it('starts empty, for one person', () => {
    expect(readSelection(new URLSearchParams())).toEqual({ specialistId: null, people: 1, date: null, time: null })
  })

  it('drops values it cannot read', () => {
    expect(readSelection(new URLSearchParams('specialist=&people=9&date=2026-02-30&time=25:00'))).toEqual({
      specialistId: null,
      people: 1,
      date: null,
      time: null,
    })
    expect(readSelection(new URLSearchParams('people=2.5&time=9:00')).people).toBe(1)
    expect(readSelection(new URLSearchParams('time=9:00')).time).toBeNull()
  })
})

describe('writeSelection', () => {
  it('round-trips, leaving the defaults out and other parameters alone', () => {
    const written = writeSelection(new URLSearchParams('mockDelay=3000&time=09:00'), { ...selection, people: 1, time: null })
    expect(written.toString()).toBe('mockDelay=3000&specialist=doc&date=2026-11-02')
    expect(readSelection(writeSelection(new URLSearchParams(), selection))).toEqual(selection)
  })
})

describe('choose', () => {
  it('keeps the date but clears the time when the specialist, group size or date changes', () => {
    expect(choose(selection, { specialistId: 'other' })).toEqual({ ...selection, specialistId: 'other', time: null })
    expect(choose(selection, { people: 3 })).toEqual({ ...selection, people: 3, time: null })
    expect(choose(selection, { date: '2026-11-03' })).toEqual({ ...selection, date: '2026-11-03', time: null })
  })

  it('keeps the time when nothing it depends on changed', () => {
    expect(choose(selection, { specialistId: 'doc' })).toEqual(selection)
  })

  it('takes a date and time chosen together', () => {
    expect(choose(selection, { date: '2026-11-03', time: 680 })).toEqual({ ...selection, date: '2026-11-03', time: 680 })
  })
})

describe('selectedSpecialist', () => {
  const consultation = { start: 600, end: 960, durationMinutes: 30, bufferMinutes: 10 }
  const a = { id: 'a', consultation }
  const b = { id: 'b', consultation }
  const unreadable = { id: 'c', consultation: null }

  it('uses the chosen specialist', () => {
    expect(selectedSpecialist([a, b], 'b')).toEqual({ specialist: b, stale: false })
  })

  it('needs a choice when several can be booked', () => {
    expect(selectedSpecialist([a, b], null)).toEqual({ specialist: null, stale: false })
  })

  it('chooses the only bookable specialist', () => {
    expect(selectedSpecialist([a, unreadable], null)).toEqual({ specialist: a, stale: false })
  })

  it("flags a chosen specialist who can't be booked or isn't listed", () => {
    expect(selectedSpecialist([a, b, unreadable], 'c')).toEqual({ specialist: null, stale: true })
    expect(selectedSpecialist([a, b], 'gone')).toEqual({ specialist: null, stale: true })
  })
})
