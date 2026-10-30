import { describe, expect, it } from 'vitest'
import { formatWallTime, parseWallTime } from './wallTime.js'

describe('parseWallTime', () => {
  it.each([
    ['10:40', 640],
    ['00:00', 0],
    ['9:05', 545],
    [' 18:00 ', 1080],
    ['23:30', 1410],
    ['24:00', 1440],
  ])('%j is %i minutes after midnight', (value, minutes) => {
    expect(parseWallTime(value)).toBe(minutes)
  })

  it.each(['24:01', '25:00', '10:60', '10.30', '1030', '10:3', '-1:00', '', 640, null])('rejects %j', (value) => {
    expect(parseWallTime(value)).toBeNull()
  })
})

describe('formatWallTime', () => {
  it('pads to HH:MM', () => {
    expect(formatWallTime(545)).toBe('09:05')
    expect(formatWallTime(0)).toBe('00:00')
    expect(formatWallTime(1440)).toBe('24:00')
  })
})
