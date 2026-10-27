import type { TimeZone } from '../time/zone.js'
import type { Consultation, WeeklySchedule } from './schedule.js'

/** Parsed copies of records in server/data/task3-booking.json, for tests */

const hours = (open: string, close: string) => {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return { open: minutes(open), close: minutes(close) }
}

export const BANGKOK: TimeZone = { kind: 'iana', id: 'Asia/Bangkok' }
export const KOLKATA: TimeZone = { kind: 'iana', id: 'Asia/Kolkata' }

/** Riverside International Hospital: closed on Sundays */
export const RIVERSIDE: WeeklySchedule = {
  monday: hours('08:00', '20:00'),
  tuesday: hours('08:00', '20:00'),
  wednesday: hours('08:00', '20:00'),
  thursday: hours('08:00', '20:00'),
  friday: hours('08:00', '17:00'),
  saturday: hours('09:00', '13:00'),
}

/** Aravali Hospital: closed on Sundays */
export const ARAVALI: WeeklySchedule = {
  monday: hours('08:00', '23:30'),
  tuesday: hours('08:00', '23:30'),
  wednesday: hours('08:00', '23:30'),
  thursday: hours('08:00', '23:30'),
  friday: hours('08:00', '23:30'),
  saturday: hours('08:00', '23:30'),
}

const consultation = (start: string, end: string, durationMinutes: number, bufferMinutes: number): Consultation => {
  const { open, close } = hours(start, end)
  return { start: open, end: close, durationMinutes, bufferMinutes }
}

export const WONGSAKUL = consultation('10:00', '16:00', 30, 10)
export const RANA = consultation('18:00', '21:00', 20, 0)
export const CHAIYAPORN = consultation('07:00', '12:00', 45, 15)
export const THAPA = consultation('20:00', '22:30', 30, 0)
export const MEHRA = consultation('21:00', '23:30', 25, 5)

/** "10:40" → 640, to keep tests readable */
export const t = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
