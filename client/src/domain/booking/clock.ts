import { calendarDateToUtcMs, type CalendarDate } from '@shared/time/calendarDate'
import { resolveProviderTimeZone } from '@shared/time/resolveTimeZone'
import type { WallTime } from '@shared/time/wallTime'
import { formatUtcOffset, instantOf, offsetMinutesAt, zonedDateTimeAt, type TimeZone } from '@shared/time/zone'

// The two clocks: the provider's, where the appointment happens, and the
// customer's own. Everything here is display; the booking itself only ever
// uses the provider's date and time.

/**
 * The customer's zone, from the device. Intl reports old names such as
 * "Asia/Katmandu", so the name goes through the same table as providers'
 * zones. If the device's zone can't be named, its current offset is used.
 */
export function deviceTimeZone(
  nowMs: number,
  deviceZoneId: string | undefined = Intl.DateTimeFormat().resolvedOptions().timeZone,
  deviceOffsetMinutes = -new Date(nowMs).getTimezoneOffset(),
): TimeZone {
  return resolveProviderTimeZone(deviceZoneId, undefined, nowMs)?.zone ?? { kind: 'fixed', offsetMinutes: deviceOffsetMinutes }
}

/** "Bangkok", "Buenos Aires", or "UTC+5:45" for a zone with no city */
export function zoneCity(zone: TimeZone): string {
  if (zone.kind === 'fixed') return formatUtcOffset(zone.offsetMinutes)
  if (!zone.id.includes('/')) return zone.id
  return zone.id.slice(zone.id.lastIndexOf('/') + 1).replaceAll('_', ' ')
}

/** Whether both clocks read the same at that moment, so one clock is enough */
export function sameClock(a: TimeZone, b: TimeZone, atMs: number): boolean {
  return offsetMinutesAt(a, atMs) === offsetMinutesAt(b, atMs)
}

const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts = [hours && `${hours} ${hours === 1 ? 'hour' : 'hours'}`, rest && `${rest} ${rest === 1 ? 'minute' : 'minutes'}`]
  return parts.filter(Boolean).join(' ')
}

/** "1 hour 15 minutes ahead of you", or null when the clocks agree */
export function offsetDifferenceText(provider: TimeZone, customer: TimeZone, atMs: number): string | null {
  const difference = offsetMinutesAt(provider, atMs) - offsetMinutesAt(customer, atMs)
  if (difference === 0) return null
  return `${duration(Math.abs(difference))} ${difference > 0 ? 'ahead of' : 'behind'} you`
}

/** The customer's date and time when a provider's slot starts */
export function customerTimeOf(provider: TimeZone, date: CalendarDate, time: WallTime, customer: TimeZone) {
  return zonedDateTimeAt(customer, instantOf(provider, date, time))
}

const timeFormats = new Map<string, Intl.DateTimeFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function cached(cache: Map<string, Intl.DateTimeFormat>, locale: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`
  let format = cache.get(key)
  if (!format) {
    // UTC on both sides: the date and time are already the right wall-clock values
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    cache.set(key, format)
  }
  return format
}

/**
 * A wall-clock time in the customer's own style: "6:40 PM" or "18:40".
 * `locale` is for tests; the app uses the browser's.
 */
export function formatTime(time: WallTime, locale?: string): string {
  return timeFormat(locale).format(Date.UTC(2000, 0, 1, 0, time))
}

const timeFormatByLocale = new Map<string, Intl.DateTimeFormat>()

function timeFormat(locale: string | undefined): Intl.DateTimeFormat {
  let format = timeFormatByLocale.get(locale ?? '')
  if (!format) {
    // A 24-hour clock reads "09:05", not "9:05"
    const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions()
    const hour = hourCycle === 'h23' || hourCycle === 'h24' ? '2-digit' : 'numeric'
    format = cached(timeFormats, locale, { hour, minute: '2-digit' })
    timeFormatByLocale.set(locale ?? '', format)
  }
  return format
}

export type DateStyle = 'short' | 'long'

/** "Mon 2 Nov" or "Monday, 2 November 2026", in the customer's own style */
export function formatDate(date: CalendarDate, style: DateStyle = 'short', locale?: string): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  return cached(dateFormats, locale, options).format(calendarDateToUtcMs(date))
}
