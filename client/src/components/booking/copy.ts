import type { Consultation } from '@shared/booking/schedule'
import type { TimeZone } from '@shared/time/zone'
import { formatTime, zoneCity } from '@/domain/booking/clock'

// Customer-facing wording for booking, kept in one place so it stays consistent.

const regionNames = new Intl.DisplayNames('en', { type: 'region' })

/** "Thailand" for TH; the code itself when Intl doesn't know it */
export function countryName(code: string | null): string | null {
  if (!code) return null
  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

/** "Bangkok time": the name every provider time on screen is labelled with */
export const zoneTimeLabel = (zone: TimeZone) => `${zoneCity(zone)} time`

/** "10:00 – 16:00" */
export const timeRange = (start: number, end: number) => `${formatTime(start)} – ${formatTime(end)}`

/** "10:00 – 16:00 · 30-minute appointments" */
export function consultationText(consultation: Consultation): string {
  return `${timeRange(consultation.start, consultation.end)} · ${consultation.durationMinutes}-minute appointments`
}

export const peopleText = (people: number) => (people === 1 ? '1 person' : `${people} people`)
