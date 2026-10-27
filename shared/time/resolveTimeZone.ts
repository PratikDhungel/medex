import { isSupportedZoneId, offsetMinutesAt, type TimeZone } from './zone.js'

/**
 * Reads a provider's `timezone`, which providers type in by hand. The data has
 * IANA names, offsets in several formats, a Windows zone name, an old IANA
 * spelling with a trailing space, and an empty string.
 *
 * Order: IANA name (old spellings mapped to current ones), Windows name,
 * UTC offset, then the provider's country. Abbreviations such as "IST" are
 * not trusted even though Intl accepts some: "IST" is India, Israel or
 * Ireland, and Intl quietly maps "EST" to Panama.
 */

/** How the zone was worked out, for logs and the README, not for customers */
export type ZoneSource = 'iana' | 'alias' | 'windows' | 'offset' | 'country'

export interface ResolvedTimeZone {
  zone: TimeZone
  source: ZoneSource
}

/**
 * One zone per country MedEx operates in. All three use a single zone with no
 * daylight saving, so the country alone is enough to know the time.
 */
export const COUNTRY_ZONES: Record<string, string> = {
  TH: 'Asia/Bangkok',
  NP: 'Asia/Kathmandu',
  IN: 'Asia/Kolkata',
}

/**
 * Current spellings, keyed by lowercase name. Intl itself still reports
 * Asia/Katmandu and Asia/Calcutta, so names can't be taken from Intl to show
 * to customers. Only zones near MedEx's markets are listed. Other valid names
 * are kept as typed.
 */
const IANA_NAMES: Record<string, string> = {
  'asia/kathmandu': 'Asia/Kathmandu',
  'asia/katmandu': 'Asia/Kathmandu',
  'asia/kolkata': 'Asia/Kolkata',
  'asia/calcutta': 'Asia/Kolkata',
  'asia/bangkok': 'Asia/Bangkok',
  'asia/dhaka': 'Asia/Dhaka',
  'asia/dacca': 'Asia/Dhaka',
  'asia/thimphu': 'Asia/Thimphu',
  'asia/thimbu': 'Asia/Thimphu',
  'asia/yangon': 'Asia/Yangon',
  'asia/rangoon': 'Asia/Yangon',
  'asia/ho_chi_minh': 'Asia/Ho_Chi_Minh',
  'asia/saigon': 'Asia/Ho_Chi_Minh',
}

/** Windows zone ids, keyed by lowercase name. Again only MedEx's region. */
const WINDOWS_ZONES: Record<string, string> = {
  'nepal standard time': 'Asia/Kathmandu',
  'india standard time': 'Asia/Kolkata',
  'se asia standard time': 'Asia/Bangkok',
  'bangladesh standard time': 'Asia/Dhaka',
  'myanmar standard time': 'Asia/Yangon',
}

// "UTC+05:45", "(GMT+5:45)", "GMT +0545", "+7", "UTC−03:30", and Windows'
// display form "(UTC+05:45) Kathmandu", where the name after the bracket is ignored
const OFFSET_PATTERN = /^\(?\s*(?:UTC|GMT)?\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?\s*\)?(?:\s+\D*)?$/i

/** Real offsets run from UTC-12 to UTC+14 */
const MAX_OFFSET_MINUTES = 14 * 60

export function parseUtcOffset(value: string): number | null {
  const match = OFFSET_PATTERN.exec(value.trim())
  if (!match) return null

  const hours = Number(match[2])
  const minutes = match[3] === undefined ? 0 : Number(match[3])
  if (minutes > 59) return null

  const total = (hours * 60 + minutes) * (match[1] === '+' ? 1 : -1)
  return Math.abs(total) <= MAX_OFFSET_MINUTES ? total : null
}

function resolveIanaName(name: string): ResolvedTimeZone | null {
  const known = IANA_NAMES[name.toLowerCase()]
  if (known) {
    return { zone: { kind: 'iana', id: known }, source: known === name ? 'iana' : 'alias' }
  }
  // Region/City names, plus the two unambiguous abbreviations
  const looksLikeIana = name.includes('/') || /^(UTC|GMT)$/i.test(name)
  if (looksLikeIana && isSupportedZoneId(name)) {
    return { zone: { kind: 'iana', id: name }, source: 'iana' }
  }
  return null
}

/**
 * The provider's zone, or null when neither its `timezone` nor its `country`
 * can be understood. Then the provider can't be booked: guessing a zone would
 * put appointments at the wrong time.
 *
 * `nowMs` matters for offsets only: an offset that matches the country's zone
 * right now becomes that zone, so customers see "Kathmandu" instead of
 * "UTC+5:45". An offset that doesn't match is kept as stated.
 */
export function resolveProviderTimeZone(timezone: unknown, country: unknown, nowMs: number): ResolvedTimeZone | null {
  const raw = typeof timezone === 'string' ? timezone.trim().replace(/\s+/g, ' ') : ''
  const countryZone = typeof country === 'string' ? COUNTRY_ZONES[country.trim().toUpperCase()] : undefined

  if (raw) {
    const iana = resolveIanaName(raw)
    if (iana) return iana

    const windows = WINDOWS_ZONES[raw.toLowerCase()]
    if (windows) return { zone: { kind: 'iana', id: windows }, source: 'windows' }

    const offset = parseUtcOffset(raw)
    if (offset !== null) {
      const matchesCountry = countryZone && offsetMinutesAt({ kind: 'iana', id: countryZone }, nowMs) === offset
      return {
        zone: matchesCountry ? { kind: 'iana', id: countryZone } : { kind: 'fixed', offsetMinutes: offset },
        source: 'offset',
      }
    }
  }

  return countryZone ? { zone: { kind: 'iana', id: countryZone }, source: 'country' } : null
}
