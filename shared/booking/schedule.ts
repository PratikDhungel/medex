import { WEEKDAYS, type Weekday } from '../time/calendarDate.js'
import { MINUTES_PER_DAY, parseWallTime, type WallTime } from '../time/wallTime.js'

/**
 * Opening hours and consultation hours, read from the raw API shapes.
 * Providers type these in by hand, so every field is checked. A day or a
 * specialist that can't be read is left out and the problem is reported in
 * `issues`. Hours are never guessed at, because a guessed time is a booking at
 * the wrong time.
 */

export interface OpeningHours {
  open: WallTime
  close: WallTime
}

export type WeeklySchedule = Partial<Record<Weekday, OpeningHours>>

export interface Consultation {
  start: WallTime
  end: WallTime
  durationMinutes: number
  bufferMinutes: number
}

export interface Parsed<T> {
  value: T
  issues: string[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** "monday", "Monday", " MON " all mean Monday */
function parseWeekday(key: string): Weekday | null {
  const lower = key.trim().toLowerCase()
  return WEEKDAYS.find((day) => day === lower || day.slice(0, 3) === lower) ?? null
}

/** Start before end, both valid. Overnight hours ("22:00"–"02:00") aren't supported and are rejected. */
function parseTimeRange(value: unknown): OpeningHours | null {
  if (!isObject(value)) return null
  const open = parseWallTime(value.startTime)
  const close = parseWallTime(value.endTime)
  if (open === null || close === null || open >= close || open === MINUTES_PER_DAY) return null
  return { open, close }
}

/** `daySchedules`. A missing day means closed that day. */
export function parseWeeklySchedule(raw: unknown): Parsed<WeeklySchedule> {
  const schedule: WeeklySchedule = {}
  const issues: string[] = []
  if (!isObject(raw)) return { value: schedule, issues: ['daySchedules is missing; treated as closed every day'] }

  for (const [key, entry] of Object.entries(raw)) {
    const day = parseWeekday(key)
    if (!day) {
      issues.push(`daySchedules has an unknown day "${key}"; ignored`)
      continue
    }
    if (schedule[day]) {
      issues.push(`daySchedules lists ${day} twice; the first entry is used`)
      continue
    }
    const hours = parseTimeRange(entry)
    if (!hours) {
      issues.push(`daySchedules.${key} has unreadable or reversed times; treated as closed`)
      continue
    }
    schedule[day] = hours
  }
  return { value: schedule, issues }
}

/** A whole number, from a number or a numeric string such as "30" */
function parseMinutes(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isInteger(number) ? number : null
}

/**
 * A specialist's `consultation`, or null when slots can't be worked out from
 * it. A missing buffer counts as 0, because "no buffer" is the obvious reading.
 */
export function parseConsultation(raw: unknown): Parsed<Consultation | null> {
  if (!isObject(raw)) return { value: null, issues: ['consultation is missing'] }

  const range = parseTimeRange(raw)
  if (!range) return { value: null, issues: ['consultation has unreadable or reversed times'] }

  const durationMinutes = parseMinutes(raw.durationInMinutes)
  if (durationMinutes === null || durationMinutes <= 0) {
    return { value: null, issues: ['consultation.durationInMinutes must be a whole number above 0'] }
  }

  const issues: string[] = []
  let bufferMinutes = parseMinutes(raw.bufferInMinutes)
  if (raw.bufferInMinutes === undefined || raw.bufferInMinutes === null) {
    bufferMinutes = 0
    issues.push('consultation.bufferInMinutes is missing; treated as 0')
  } else if (bufferMinutes === null || bufferMinutes < 0) {
    return { value: null, issues: ['consultation.bufferInMinutes must be a whole number, 0 or more'] }
  }

  return { value: { start: range.open, end: range.close, durationMinutes, bufferMinutes }, issues }
}
