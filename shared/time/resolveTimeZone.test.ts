import { describe, expect, it } from 'vitest'
import { parseUtcOffset, resolveProviderTimeZone } from './resolveTimeZone.js'

const NOW = Date.UTC(2026, 9, 27, 6, 0)

describe('resolveProviderTimeZone: every value in task3-booking.json', () => {
  it.each([
    ['Riverside International Hospital', 'Asia/Bangkok', 'TH', 'Asia/Bangkok', 'iana'],
    ['Himal Neo Clinic', ' UTC+05:45', 'NP', 'Asia/Kathmandu', 'offset'],
    ['Annapurna Diagnostics', 'Nepal Standard Time', 'NP', 'Asia/Kathmandu', 'windows'],
    ['Pashupati Medical Centre', '(GMT+5:45)', 'NP', 'Asia/Kathmandu', 'offset'],
    ['Lumbini Polyclinic', 'Asia/Katmandu ', 'NP', 'Asia/Kathmandu', 'alias'],
    ['Aravali Hospital', '', 'IN', 'Asia/Kolkata', 'country'],
  ])('%s: %j', (_name, timezone, country, id, source) => {
    expect(resolveProviderTimeZone(timezone, country, NOW)).toEqual({ zone: { kind: 'iana', id }, source })
  })
})

describe('resolveProviderTimeZone: other values a provider could type', () => {
  it('fixes the case of an IANA name', () => {
    expect(resolveProviderTimeZone('asia/bangkok', 'TH', NOW)).toEqual({
      zone: { kind: 'iana', id: 'Asia/Bangkok' },
      source: 'alias',
    })
  })

  it('maps the old Calcutta spelling to Kolkata', () => {
    expect(resolveProviderTimeZone('Asia/Calcutta', 'IN', NOW)?.zone).toEqual({ kind: 'iana', id: 'Asia/Kolkata' })
  })

  it('keeps any other valid IANA name as typed', () => {
    expect(resolveProviderTimeZone('Europe/London', 'TH', NOW)).toEqual({
      zone: { kind: 'iana', id: 'Europe/London' },
      source: 'iana',
    })
  })

  it('collapses repeated spaces in a Windows name', () => {
    expect(resolveProviderTimeZone('  India   Standard Time ', 'IN', NOW)?.zone).toEqual({ kind: 'iana', id: 'Asia/Kolkata' })
  })

  it("reads Windows' display form, ignoring the city", () => {
    expect(resolveProviderTimeZone('(UTC+05:45) Kathmandu', 'NP', NOW)?.zone).toEqual({ kind: 'iana', id: 'Asia/Kathmandu' })
  })

  it("keeps an offset that doesn't match the country as a fixed offset", () => {
    expect(resolveProviderTimeZone('UTC+05:30', 'NP', NOW)).toEqual({
      zone: { kind: 'fixed', offsetMinutes: 330 },
      source: 'offset',
    })
  })

  it('keeps an offset as fixed when the country is unknown', () => {
    expect(resolveProviderTimeZone('GMT+7', 'XX', NOW)?.zone).toEqual({ kind: 'fixed', offsetMinutes: 420 })
  })

  it("doesn't trust abbreviations Intl would accept", () => {
    // Intl reads "IST" as Kolkata, but it also means Israel and Ireland
    expect(resolveProviderTimeZone('IST', 'IN', NOW)?.source).toBe('country')
    // ...and "EST" as Panama
    expect(resolveProviderTimeZone('EST', 'TH', NOW)?.zone).toEqual({ kind: 'iana', id: 'Asia/Bangkok' })
  })

  it('falls back to the country for an unknown name or an impossible offset', () => {
    expect(resolveProviderTimeZone('Mars/Olympus_Mons', 'NP', NOW)?.source).toBe('country')
    expect(resolveProviderTimeZone('UTC+15:00', 'NP', NOW)?.source).toBe('country')
    expect(resolveProviderTimeZone('Bangkok', 'TH', NOW)?.source).toBe('country')
  })

  it('falls back to the country when timezone is missing or not a string', () => {
    expect(resolveProviderTimeZone(undefined, 'TH', NOW)?.source).toBe('country')
    expect(resolveProviderTimeZone(null, 'TH', NOW)?.source).toBe('country')
    expect(resolveProviderTimeZone(7, 'TH', NOW)?.source).toBe('country')
    expect(resolveProviderTimeZone('   ', ' np ', NOW)?.zone).toEqual({ kind: 'iana', id: 'Asia/Kathmandu' })
  })

  it('gives up when neither timezone nor country can be understood', () => {
    expect(resolveProviderTimeZone('', 'XX', NOW)).toBeNull()
    expect(resolveProviderTimeZone('somewhere', undefined, NOW)).toBeNull()
  })
})

describe('parseUtcOffset', () => {
  it.each([
    ['UTC+05:45', 345],
    ['(GMT+5:45)', 345],
    ['GMT +0545', 345],
    ['+7', 420],
    ['UTC+07:00', 420],
    ['UTC-03:30', -210],
    ['UTC−03:30', -210],
    ['utc+14', 840],
    ['UTC-12', -720],
  ])('%j is %i minutes', (value, minutes) => {
    expect(parseUtcOffset(value)).toBe(minutes)
  })

  it.each(['UTC', '05:45', 'UTC+15', 'UTC+05:60', 'UTC+5:4', 'UTC+05:45:00', 'Nepal'])('rejects %j', (value) => {
    expect(parseUtcOffset(value)).toBeNull()
  })
})
