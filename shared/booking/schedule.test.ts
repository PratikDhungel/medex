import { describe, expect, it } from 'vitest'
import { parseConsultation, parseWeeklySchedule } from './schedule.js'

describe('parseWeeklySchedule', () => {
  it('reads the API shape; a missing day means closed', () => {
    const { value, issues } = parseWeeklySchedule({
      monday: { startTime: '08:00', endTime: '20:00' },
      saturday: { startTime: '09:00', endTime: '13:00' },
    })
    expect(value).toEqual({ monday: { open: 480, close: 1200 }, saturday: { open: 540, close: 780 } })
    expect(issues).toEqual([])
  })

  it('accepts other spellings of a day', () => {
    const { value } = parseWeeklySchedule({
      Monday: { startTime: '08:00', endTime: '20:00' },
      ' TUE ': { startTime: '08:00', endTime: '20:00' },
    })
    expect(Object.keys(value)).toEqual(['monday', 'tuesday'])
  })

  it('treats a day it cannot read as closed and says why', () => {
    const { value, issues } = parseWeeklySchedule({
      monday: { startTime: '20:00', endTime: '08:00' },
      tuesday: { startTime: '9am', endTime: '17:00' },
      wednesday: { startTime: '08:00', endTime: '08:00' },
      thursday: null,
      funday: { startTime: '08:00', endTime: '20:00' },
    })
    expect(value).toEqual({})
    expect(issues).toHaveLength(5)
  })

  it('keeps the first of two entries for the same day', () => {
    const { value, issues } = parseWeeklySchedule({
      monday: { startTime: '08:00', endTime: '20:00' },
      Mon: { startTime: '10:00', endTime: '12:00' },
    })
    expect(value.monday).toEqual({ open: 480, close: 1200 })
    expect(issues).toHaveLength(1)
  })

  it('allows a closing time of 24:00', () => {
    expect(parseWeeklySchedule({ friday: { startTime: '18:00', endTime: '24:00' } }).value.friday).toEqual({
      open: 1080,
      close: 1440,
    })
  })

  it('treats a missing schedule as closed every day', () => {
    expect(parseWeeklySchedule(undefined).value).toEqual({})
    expect(parseWeeklySchedule([]).issues).toHaveLength(1)
  })
})

describe('parseConsultation', () => {
  const valid = { startTime: '10:00', endTime: '16:00', durationInMinutes: 30, bufferInMinutes: 10 }

  it('reads the API shape', () => {
    expect(parseConsultation(valid)).toEqual({
      value: { start: 600, end: 960, durationMinutes: 30, bufferMinutes: 10 },
      issues: [],
    })
  })

  it('accepts minutes typed as strings', () => {
    expect(parseConsultation({ ...valid, durationInMinutes: '30', bufferInMinutes: ' 10 ' }).value).toMatchObject({
      durationMinutes: 30,
      bufferMinutes: 10,
    })
  })

  it('treats a missing buffer as 0 and says so', () => {
    const { value, issues } = parseConsultation({ ...valid, bufferInMinutes: undefined })
    expect(value?.bufferMinutes).toBe(0)
    expect(issues).toHaveLength(1)
  })

  // A duration of 0 would make slot generation loop forever
  it.each([
    ['no consultation', undefined],
    ['reversed times', { ...valid, startTime: '16:00', endTime: '10:00' }],
    ['a bad time', { ...valid, endTime: '25:00' }],
    ['a duration of 0', { ...valid, durationInMinutes: 0 }],
    ['a negative duration', { ...valid, durationInMinutes: -30 }],
    ['a fractional duration', { ...valid, durationInMinutes: 22.5 }],
    ['a duration that is not a number', { ...valid, durationInMinutes: 'half an hour' }],
    ['a negative buffer', { ...valid, bufferInMinutes: -5 }],
  ])('rejects %s', (_case, raw) => {
    const { value, issues } = parseConsultation(raw)
    expect(value).toBeNull()
    expect(issues).toHaveLength(1)
  })
})
